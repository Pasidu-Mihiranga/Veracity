import { marketTrendsAgent } from './market-trends';
import { competitiveAgent } from './competitive';
import { winLossAgent } from './win-loss';
import { pricingAgent } from './pricing';
import { positioningAgent } from './positioning';
import { adjacentAgent } from './adjacent';
import { executionEngineAgent } from './execution/execution-engine';
import { mirofishAgent } from './mirofish';
import { mirofishLiveAgent } from './mirofish-live';
import { detectExecutionIntent } from './execution-intent';
import { generateHuggingFaceJson, generateHuggingFaceText } from './gemini';
import {
  extractEntitiesFromQuery,
  resolveCompetitorName,
  resolveProductName,
} from './extract-entities';
import { isPlaceholderProduct } from './entity-url';
import { isSynthesisFailureInterpretation } from './synthesis-fallback';
import { normalizeMindMapTree } from './mind-map-normalize';
import { filterAndRankSources } from '@/lib/tools/source-validator';
import {
  applyEntitySourceFilterToOutputs,
  applyOutputQualityGate,
} from '@/lib/agents/output-quality';
import { bindEvidenceToSources } from '@/lib/agents/bind-evidence';
import { computeEvidenceCoverage } from '@/lib/agents/evidence-coverage';
import { logger } from '@/lib/logger';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  AgentRun,
  OrchestratorOutput,
  RunMetrics,
  Recommendation,
  ConversationMessage,
  ConfidenceLevel,
  IntelligenceDomain,
  ImageAttachment,
  MindMapOutput,
  MindMapNode,
} from './types';
import { scoreToLevel } from './types';

// ── Cost estimation constants ───────────────────────────────────────────────
// Lightweight model-call estimate used for the UI metrics readout.
// The exact provider cost varies, so this intentionally stays heuristic.
const EST_INPUT_TOKENS_PER_CALL = 2000;
const EST_OUTPUT_TOKENS_PER_CALL = 1000;
const COST_PER_INPUT_TOKEN = 0.10 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.40 / 1_000_000;
const EST_COST_PER_MODEL_CALL =
  EST_INPUT_TOKENS_PER_CALL * COST_PER_INPUT_TOKEN +
  EST_OUTPUT_TOKENS_PER_CALL * COST_PER_OUTPUT_TOKEN;

// Gemini model is resolved inside lib/agents/gemini.ts via GEMINI_MODEL env
// var (default: gemini-2.5-flash). We deliberately don't override per-call
// so that one env change switches every agent at once.

// ── All registered domain agents (6 fast Stage-1 agents) ────────────────────
const ALL_AGENTS: AgentConfig[] = [
  marketTrendsAgent,
  competitiveAgent,
  winLossAgent,
  pricingAgent,
  positioningAgent,
  adjacentAgent,
];
// mirofishAgent is opt-in and runs separately after the main result is sent
// (see runMirofishAgent below)

// ── Query classifier ──────────────────────────────────────────────────────────
interface ClassificationResult {
  product: string;
  competitor?: string;
  productUrl?: string;
  competitorUrl?: string;
  domains: IntelligenceDomain[];
  intent: string;
  runExecution: boolean;  // true when query is execution-intent (write copy, outreach, variants, brief)
}

const VALID_DOMAINS: IntelligenceDomain[] = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
];

interface OrchestrateOptions {
  injectedContext?: string; // extra context injected into agents and synthesizer (e.g. feedback loop)
  forceExecution?: boolean; // force stage-2 execution even when classifier says false
  followUpMode?: 'full' | 'targeted'; // targeted runs only classifier-selected research domains
  selectedAgents?: string[]; // optional UI-selected domains from client
  /** Live status lines for the UI (e.g. “Reasoning…”, “Orchestrating…”). */
  onOrchestrationLog?: (message: string) => void;
}

async function classifyQuery(
  query: string,
  history: ConversationMessage[],
  images: ImageAttachment[] = [],
  memoryContext?: string,
): Promise<ClassificationResult> {
  // Build context from prior messages
  const priorContext = history
    .slice(-6) // last 3 turns
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  const heuristic = extractEntitiesFromQuery(query);
  const regexExecution = detectExecutionIntent(query);

  const systemPrompt = `You are a query classifier for a growth intelligence system. Extract structured information using conversation history and persistent user memory. Always return valid JSON. Never use placeholder product names like "the current product" or "the product" — extract real brand names from the query when present. Prefer company/product entities over people with the same name. If the query only mentions an ambiguous personal name with no product category, still return the name but keep domains focused and do not invent a competitor.`;

  const userPrompt = `${memoryContext ? `${memoryContext}\n\n` : ''}Conversation history:
${priorContext || 'None'}

Current query: "${query}"
${images.length > 0 ? `\nAttached images: ${images.length}. Use them as contextual metadata only; the specialist agents inspect the actual image content.` : ''}
${heuristic.product ? `\nHeuristic hint — product: "${heuristic.product}"${heuristic.competitor ? `, competitor: "${heuristic.competitor}"` : ''}. Prefer these when they match the query.` : ''}

Respond with JSON:
{
  "product": string,         // The product being analysed (real brand name; infer from context if not explicit)
  "competitor": string | null,  // Competitor name if mentioned or inferable from context
  "productUrl": string | null,  // Product website if known (e.g. vectoragents.ai)
  "competitorUrl": string | null,
  "domains": string[],       // Which intelligence domains to activate. Options: market-trends, competitive, win-loss, pricing, positioning, adjacent
  "intent": string,          // One-line description of what the user wants to know
  "runExecution": boolean    // true if the query is execution-intent (write copy, draft outreach, campaign brief, cold email, LinkedIn post, variants, one-pager, positioning guide, outreach sequence)
}

Domain selection rules:
- "vs", "compare", "competitive", "compete with" → include competitive, win-loss, positioning
- "market", "trend", "category", "growing" → include market-trends
- "pricing", "cost", "expensive" → include pricing
- "messaging", "positioning", "marketing" → include positioning
- "disruption", "threat", "outside", "adjacent" → include adjacent
- "build", "roadmap", "strategy" → include market-trends, competitive, adjacent
- Vague / broad queries → include all 6 domains
- Always include at least 3 domains

Execution intent detection (set runExecution: true if ANY of these apply):
- Generation verbs ("write", "draft", "create", "generate", "produce", "craft", "compose", "build", "make", "give me", "show me", "send me") combined with any marketing or outreach artifact (cold email, email, LinkedIn post, outreach sequence, copy, message, ad, campaign, brief, one-pager, landing page, pitch, CTA, hook, headline, tagline, DM, nurture, outbound)
- Standalone phrases: "campaign brief", "one-pager", "positioning guide", "strategy doc", "messaging guide", "launch plan", "go-to-market plan", "GTM plan"
- A/B testing language: "variants", "A/B", "AB test", "hypothesis", "test angles", "message variants", "falsifiable"
- Deployment verbs ("ship", "launch", "deploy", "roll out") combined with campaign/outreach/sequence/copy/message/post/ad
- Bare imperatives that start with a generation verb ("Write...", "Draft...", "Generate...", "Create...", "Compose...")

Set runExecution: false for pure research questions ("compare X vs Y", "what is the market for X", "is X growing", "who are the competitors of X").`;

  try {
    const parsed = await generateHuggingFaceJson<Record<string, unknown>>(systemPrompt, userPrompt, {
      maxNewTokens: 512,
      temperature: 0.1,
    });
    const product = resolveProductName(parsed.product, heuristic);
    const competitor = resolveCompetitorName(parsed.competitor, heuristic);
    if (isPlaceholderProduct(product)) {
      logger.warn('classify.placeholder_product', { query, product, heuristic });
    }
    return {
      product,
      competitor,
      productUrl: (parsed.productUrl as string) || undefined,
      competitorUrl: (parsed.competitorUrl as string) || undefined,
      domains: normalizeDomains(parsed.domains),
      intent: (parsed.intent as string) || query,
      runExecution: Boolean(parsed.runExecution) || regexExecution,
    };
  } catch (err) {
    logger.error('classify.failed', {
      query,
      error: err instanceof Error ? err.message : String(err),
      heuristic,
    });
    // Fallback: activate all domains. Prefer regex/heuristic entities so
    // "Notion vs Linear" still searches the right brands when Gemini errors.
    return {
      product: resolveProductName(undefined, heuristic, 'unknown product'),
      competitor: resolveCompetitorName(undefined, heuristic),
      domains: ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'],
      intent: query,
      runExecution: regexExecution,
    };
  }
}

// Strip markdown code fences Gemini sometimes wraps around JSON
function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(stripJsonFences(raw));
  } catch {
    // Try extracting first JSON object/array from the string
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    return {};
  }
}

function normalizeDomains(rawDomains: unknown): IntelligenceDomain[] {
  if (!Array.isArray(rawDomains)) {
    return ['market-trends', 'competitive', 'win-loss'];
  }
  const filtered = rawDomains
    .filter((domain): domain is IntelligenceDomain =>
      typeof domain === 'string' && VALID_DOMAINS.includes(domain as IntelligenceDomain),
    );
  if (filtered.length >= 3) return filtered;
  const merged = [...new Set([...filtered, 'market-trends', 'competitive', 'win-loss'])];
  return merged.slice(0, 6) as IntelligenceDomain[];
}

// ── Synthesizer — merges all agent outputs into a final answer ────────────────
async function synthesize(
  query: string,
  outputs: AgentOutput[],
  history: ConversationMessage[],
  images: ImageAttachment[] = [],
  memoryContext?: string,
  product?: string,
  competitor?: string,
): Promise<{ answer: string; recommendations: Recommendation[]; followUps: string[] }> {
  const priorSummary = history
    .slice(-4)
    .filter(m => m.role === 'assistant')
    .map(m => m.content.slice(0, 300))
    .join('\n');

  const outputSummaries = outputs.map(o => ({
    domain: o.domain,
    confidence: o.confidence,
    facts: o.facts.slice(0, 4),
    interpretation: o.interpretation.slice(0, 3),
    sources: o.sources.slice(0, 4).map(s => ({ title: s.title, url: s.url })),
  }));

  const citedTitles = outputs
    .flatMap(o => o.sources)
    .slice(0, 16)
    .map(s => s.title)
    .filter(Boolean);

  const prompt = `You are the synthesis layer of a multi-agent growth intelligence system. Write a clear, simple answer a busy founder can understand in 30 seconds — plain English, not consultant jargon.

Original query: "${query}"
Resolved product: "${product ?? 'unknown'}"${competitor ? `\nResolved competitor: "${competitor}"` : ''}
${memoryContext ? `${memoryContext}\n` : ''}${priorSummary ? `Prior conversation context:\n${priorSummary}\n` : ''}
Agent findings from ${outputs.length} specialist agents:
${JSON.stringify(outputSummaries, null, 2)}

Available source titles (for grounding only — do not invent URLs):
${JSON.stringify(citedTitles, null, 2)}

Rules:
1. Lead with the direct recommendation or answer in sentence 1 — BUT only if findings clearly support it.
2. LANGUAGE (mandatory):
   - Use short sentences and everyday words.
   - Avoid buzzwords: "opinionated", "system of action", "system of record", "agentic", "cognitive load", "verticalize", "commoditize", "ICP" unless you immediately explain in plain words.
   - Prefer "what to do" and "why it matters" over abstract strategy language.
3. ANTI-HALLUCINATION (mandatory):
   - Use ONLY facts present in agent findings / source titles above.
   - Do NOT invent product categories, vertical pivots, rebrands, or competitors not supported by findings.
   - Do NOT mention other products from memory (e.g. Lilian) unless they appear in the current query or findings.
   - If sources look like people, resumes, or LinkedIn personal profiles for "${product ?? 'the product'}", say evidence is ambiguous and ask for the official company URL instead of inventing strategy.
   - If evidence is thin or conflicting, set recommendation confidence to "low", avoid "immediate" priority, and state uncertainty in plain language.
   - Never claim a market growth % or industry ranking unless it appears in the findings.
4. Clean prose only — no [WEB]/[NEWS]/[REDDIT] labels.
5. Be specific when evidence supports it: name products, buyer types, workflows, pricing from the findings. Avoid vague filler.
6. Keep "answer" under 120 words.
7. Exactly 2-3 recommendations. Each title must be a simple action (verb-first, ≤8 words). Evidence must quote a concrete finding (or say "not enough evidence").
8. Prefer recommendations tagged immediate ONLY when findings strongly support shipping now.
9. Follow-ups must be simple decision questions about THIS product/competitor only.

Return ONLY valid JSON:
{
  "answer": "string",
  "recommendations": [
    {
      "title": "string",
      "rationale": "string",
      "evidence": ["string"],
      "confidence": "high" | "medium" | "low",
      "priority": "immediate" | "short-term" | "strategic"
    }
  ],
  "followUps": ["string", "string", "string"]
}`;

  try {
    const imageNote = images.length > 0
      ? `\nThe user has also attached ${images.length} image(s). Reference their visual content (text, UI elements, charts, pricing tables, etc.) directly in your answer.`
      : '';
    const raw = await generateHuggingFaceText(prompt + imageNote, {
      maxNewTokens: 768,
      temperature: 0.15,
    });
    const parsed = safeParseJson(raw);
    return {
      answer: (parsed.answer as string) || buildFallbackAnswer(outputs, query),
      recommendations: (parsed.recommendations as Recommendation[]) ?? [],
      followUps: (parsed.followUps as string[]) ?? [],
    };
  } catch (err) {
    logger.error('orchestrator.synthesis_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      answer: buildFallbackAnswer(outputs, query),
      recommendations: [],
      followUps: [],
    };
  }
}

function buildFallbackAnswer(outputs: AgentOutput[], query: string): string {
  if (outputs.length === 0) {
    return `I couldn't retrieve signal data for "${query}". Please check your API keys and try again.`;
  }

  const synthesisFailures = outputs.filter((o) => isSynthesisFailureInterpretation(o.interpretation));
  const errorLines = synthesisFailures
    .map((o) => o.interpretation.find((line) => line.startsWith('SYNTHESIS_ERROR:')))
    .filter((line): line is string => Boolean(line));

  if (synthesisFailures.length === outputs.length && errorLines.length > 0) {
    const uniqueErrors = [...new Set(errorLines)].slice(0, 3);
    return [
      `I collected live search signals for "${query}", but AI analysis failed for every domain.`,
      '',
      'Exception(s):',
      ...uniqueErrors.map((e) => `• ${e.replace(/^SYNTHESIS_ERROR:\s*/, '')}`),
      '',
      'Check GEMINI_API_KEY / GEMINI_MODEL. Prefer gemini-flash-latest or gemini-3.5-flash (free). gemini-2.5-flash is blocked for many new keys. Then rerun. Domain cards still show raw snippets only.',
    ].join('\n');
  }

  // Produce clean prose from agent outputs, filtering out raw tool prefixes
  const cleanFacts = outputs
    .flatMap(o => o.facts)
    .filter(f => !f.startsWith('[') && !f.startsWith('SYNTHESIS_ERROR:'))
    .slice(0, 4);
  const domains = outputs.map(o => o.domain.replace(/-/g, ' ')).join(', ');
  const warning = synthesisFailures.length > 0
    ? `\n\nWarning: AI synthesis failed for ${synthesisFailures.length}/${outputs.length} domains (${errorLines[0]?.replace(/^SYNTHESIS_ERROR:\s*/, '') ?? 'see domain cards'}).`
    : '';
  if (cleanFacts.length > 0) {
    return `Based on intelligence gathered across ${domains}:\n\n${cleanFacts.map(f => `• ${f}`).join('\n')}${warning}`;
  }
  return `Intelligence gathered from ${outputs.length} agents covering: ${domains}. Expand the Agent Findings below for detailed insights.${warning}`;
}

// ── Mind map generator — executive strategy / issue-tree map ─────────────────
async function generateMindMap(
  query: string,
  product: string,
  outputs: AgentOutput[],
): Promise<MindMapOutput | null> {
  if (outputs.length === 0) return null;

  const outputSummaries = outputs.map(o => ({
    domain: o.domain,
    confidence: o.confidence,
    confidenceScore: o.confidenceScore,
    facts: o.facts.slice(0, 5),
    interpretation: o.interpretation.slice(0, 3),
  }));

  const systemPrompt = `You build executive strategy mind maps (issue-tree / pillar style), not decorative spider diagrams.
Return valid JSON only. Prefer short keyword labels. Put long explanation in "detail".`;

  const userPrompt = `Product: "${product}"
Query: "${query}"
Agent findings:
${JSON.stringify(outputSummaries, null, 2)}

Build a STRATEGY MIND MAP that answers the query.

STRUCTURE (strict):
- centralTopic: rephrase the USER QUESTION as 3-6 words (NOT a domain name like "Market Trend Alignment")
- Exactly 5 branches (pillars). Prefer this decision set when the query is about what to build:
  1) Specialize / ICP workflow to ship
  2) Prove ROI / reliability
  3) Pricing model
  4) Positioning narrative
  5) Avoid / do-not-build
- Each branch: 2-3 children max. No grandchildren unless essential (max 1 level of grandchildren).
- Branch labels: 2-5 words. Child labels: 3-7 words. Imperative or noun phrases — NOT full sentences.
- Branch labels MUST be unique and MUST NOT equal centralTopic.
- Every node needs non-empty "detail" (1 sentence evidence).
- Each branch sets sourceAgent to the best matching domain and confidence from findings.
- sentiment: positive | neutral | negative | warning

Return JSON:
{
  "centralTopic": "string",
  "summary": "string — one line thesis",
  "branches": [
    {
      "id": "branch-1",
      "label": "string",
      "detail": "string",
      "sentiment": "positive" | "neutral" | "negative" | "warning",
      "confidence": "high" | "medium" | "low",
      "sourceAgent": "market-trends" | "competitive" | "win-loss" | "pricing" | "positioning" | "adjacent",
      "children": [
        {
          "id": "leaf-1-1",
          "label": "string",
          "detail": "string",
          "sentiment": "positive" | "neutral" | "negative" | "warning"
        }
      ]
    }
  ]
}`;

  try {
    const parsed = await generateHuggingFaceJson<Record<string, unknown>>(systemPrompt, userPrompt, {
      maxNewTokens: 2048,
      temperature: 0.15,
    });

    const normalized = normalizeMindMapTree({
      centralTopic: parsed.centralTopic,
      summary: parsed.summary,
      branches: parsed.branches,
      product,
      query,
    });
    if (normalized.branches.length === 0) return null;

    const avgScore = outputs.reduce((s, o) => s + o.confidenceScore, 0) / outputs.length;

    return {
      agentId: 'mind-map-synthesis',
      domain: 'market-trends',
      confidence: scoreToLevel(avgScore),
      confidenceScore: avgScore,
      facts: [],
      interpretation: [],
      sources: filterAndRankSources(outputs.flatMap(o => o.sources), 10),
      generatedAt: new Date().toISOString(),
      artifactType: 'mind-map',
      centralTopic: normalized.centralTopic,
      branches: normalized.branches,
      summary: normalized.summary,
    };
  } catch (err) {
    logger.error('mindmap.generation_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
export async function orchestrate(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  options?: OrchestrateOptions,
): Promise<OrchestratorOutput> {
  const orchestrationStart = Date.now();
  const log = options?.onOrchestrationLog;

  // Step 1: Classify query and extract context  (1 model call)
  log?.('Reasoning about your query and selecting intelligence domains…');
  const classification = await classifyQuery(query, history, images, memoryContext);
  let modelCallCount = 1;

  const { product, competitor, productUrl, competitorUrl, intent, runExecution } = classification;
  log?.(`Classified product: ${product}${competitor ? ` vs ${competitor}` : ''} — ${intent}`);
  if (isPlaceholderProduct(product)) {
    log?.(`Warning: product name looks like a placeholder ("${product}") — search quality may be low.`);
  }
  const allowedAgents = new Set(options?.selectedAgents?.length ? options.selectedAgents : ALL_AGENTS.map(a => a.id));
  const executionEnabled = allowedAgents.has('execution-engine');
  const shouldRunExecution = executionEnabled && (runExecution || options?.forceExecution === true);

  // Build prior context string for agents
  const priorContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const combinedPriorContext = [priorContext, options?.injectedContext]
    .filter(Boolean)
    .join('\n\n');

  const synthesisMemoryContext = [memoryContext, options?.injectedContext]
    .filter(Boolean)
    .join('\n\n') || undefined;

  // Keep the user's original wording for search/synthesis (not only the LLM intent rewrite).
  const agentContext: AgentContext = {
    query,
    product,
    competitor,
    productUrl,
    competitorUrl,
    priorContext: combinedPriorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: memoryContext || undefined,
  };

  // Step 2: Select research agents.
  // Main queries default to full sweep; follow-ups may run targeted domains.
  const classifiedDomains = new Set(classification.domains ?? []);
  const availableResearchAgents = ALL_AGENTS.filter(agent => allowedAgents.has(agent.id));
  const targetedAgents = availableResearchAgents.filter(agent => classifiedDomains.has(agent.id as IntelligenceDomain));
  const agentsToRun = options?.followUpMode === 'targeted'
    ? (targetedAgents.length > 0 ? targetedAgents : availableResearchAgents)
    : availableResearchAgents;

  const sweepLabel = options?.followUpMode === 'targeted' ? 'targeted follow-up' : 'full research sweep';
  log?.(`Dividing work across ${agentsToRun.length} specialist agents (${sweepLabel})…`);
  log?.('Orchestrating parallel research — search, fetch, and extract…');

  // Initialise agent run tracking
  const agentRuns: AgentRun[] = agentsToRun.map(a => ({
    agentId: a.id,
    name: a.name,
    status: 'pending',
  }));

  // Step 3: Fan-out — all selected agents run in parallel
  const agentLatencies: Record<string, number> = {};
  const agentPromises = agentsToRun.map(async (agent, i): Promise<AgentOutput | null> => {
    // Mark as running
    const agentStart = Date.now();
    agentRuns[i] = { ...agentRuns[i], status: 'running', startedAt: new Date().toISOString() };
    onAgentUpdate?.(agentRuns[i]);

    try {
      const output = await agent.run(agentContext);
      agentLatencies[agent.id] = Date.now() - agentStart;
      const synthError = output.interpretation.find((line) => line.startsWith('SYNTHESIS_ERROR:'));
      if (synthError) {
        agentRuns[i] = {
          ...agentRuns[i],
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: synthError.replace(/^SYNTHESIS_ERROR:\s*/, ''),
        };
      } else {
        agentRuns[i] = { ...agentRuns[i], status: 'completed', completedAt: new Date().toISOString() };
      }
      onAgentUpdate?.(agentRuns[i]);
      return output;
    } catch (err) {
      agentLatencies[agent.id] = Date.now() - agentStart;
      const error = err instanceof Error ? err.message : String(err);
      agentRuns[i] = { ...agentRuns[i], status: 'failed', completedAt: new Date().toISOString(), error };
      onAgentUpdate?.(agentRuns[i]);
      return null;
    }
  });

  const settledOutputs = await Promise.allSettled(agentPromises);
  const outputs: AgentOutput[] = settledOutputs
    .filter((r): r is PromiseFulfilledResult<AgentOutput> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value as AgentOutput);

  // Each research agent makes ~1 model call
  modelCallCount += agentsToRun.length;

  // ── Stage 2: Execution Engine (only if execution intent detected) ──────────
  if (shouldRunExecution) {
    log?.('Execution intent detected — running execution engine for deliverables…');
    const execStart = Date.now();
    const execRun: AgentRun = {
      agentId: 'execution-engine',
      name: 'Execution Engine',
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    agentRuns.push(execRun);
    onAgentUpdate?.(execRun);

    try {
      const executionOutput = await executionEngineAgent.run({
        ...agentContext,
        researchOutputs: outputs,   // pass stage-1 findings as grounding
      });
      agentLatencies['execution-engine'] = Date.now() - execStart;
      execRun.status = 'completed';
      execRun.completedAt = new Date().toISOString();
      outputs.push(executionOutput);
      modelCallCount += 3; // 3 sub-agents
    } catch (err) {
      agentLatencies['execution-engine'] = Date.now() - execStart;
      execRun.status = 'failed';
      execRun.error = err instanceof Error ? err.message : String(err);
    }
    onAgentUpdate?.(execRun);
  }

  // Step 4: Entity-filter sources before synthesis so the model sees less noise
  const filtered = applyEntitySourceFilterToOutputs(outputs, product, competitor);
  const researchOutputs = filtered.outputs;

  // Step 5: Synthesise + generate mind map in parallel (2 model calls)
  log?.('Reasoning over findings — synthesizing answer and strategic mind map…');
  const [synthesisResult, mindMapResult] = await Promise.all([
    synthesize(query, researchOutputs, history, images, synthesisMemoryContext, product, competitor),
    generateMindMap(query, product, researchOutputs),
  ]);
  modelCallCount += 2; // synthesis + mind map

  // Append mind map to outputs if generated successfully
  if (mindMapResult) {
    researchOutputs.push(mindMapResult);
  }

  // Step 6: URL hygiene + entity relevance ranking
  for (const output of researchOutputs) {
    output.sources = filterAndRankSources(output.sources, 8);
  }

  // Step 7: Post-synthesis quality gate (anti-hallucination / abstain)
  const allSources = researchOutputs.flatMap((o) => o.sources);
  const agentConfidenceAvg = researchOutputs.length > 0
    ? researchOutputs.reduce((sum, o) => sum + o.confidenceScore, 0) / researchOutputs.length
    : 0.5;
  const guarded = applyOutputQualityGate({
    product,
    competitor,
    sources: allSources,
    answer: synthesisResult.answer,
    recommendations: synthesisResult.recommendations,
    followUps: synthesisResult.followUps,
    agentConfidenceAvg,
  });
  if (guarded.quality.shouldAbstainFromStrongClaims) {
    logger.warn('orchestrator.quality_abstain', {
      product,
      competitor,
      flags: guarded.quality.flags,
      matchRatio: guarded.quality.sourceMatchRatio,
      matched: guarded.quality.matchedSourceCount,
      total: guarded.quality.totalSourceCount,
    });
    log?.('Evidence quality check flagged thin or ambiguous grounding — softening claims…');
  }

  const answer = guarded.answer;
  const followUps = guarded.followUps;
  const totalConfidence = guarded.totalConfidence;
  const outputsFinal = researchOutputs;

  // Step 7b: Bind recommendation evidence → source URLs (Evidence Trail)
  const recommendations = bindEvidenceToSources(
    guarded.recommendations,
    allSources,
    product,
    competitor,
  );

  // Step 7c: Evidence Coverage Radar scores
  const evidenceCoverage = computeEvidenceCoverage(
    outputsFinal,
    agentRuns,
    product,
    competitor,
  );

  // Step 8: Build run metrics
  // Tool call count: each successful agent typically makes 2-4 tool calls.
  // We estimate based on completed agents (a rough heuristic — agents don't
  // currently report exact tool call counts back).
  const completedAgents = agentRuns.filter(r => r.status === 'completed').length;
  const failedAgents = agentRuns.filter(r => r.status === 'failed').length;
  const toolCallCount = completedAgents * 3; // conservative average

  const metrics: RunMetrics = {
    totalLatencyMs: Date.now() - orchestrationStart,
    agentLatencies,
    estimatedCostUsd: Number.parseFloat((modelCallCount * EST_COST_PER_MODEL_CALL).toFixed(5)),
    toolCallCount,
    geminiCallCount: modelCallCount,
    agentCount: agentRuns.length,
    completedAgentCount: completedAgents,
    failedAgentCount: failedAgents,
  };

  return {
    query,
    product,
    competitor,
    agentRuns,
    outputs: outputsFinal,
    synthesizedAnswer: answer,
    topRecommendations: recommendations,
    suggestedFollowUps: followUps,
    totalConfidence,
    generatedAt: new Date().toISOString(),
    metrics,
    quality: guarded.quality,
    evidenceCoverage,
  };
}

// ── Optional MiroFish agent — runs independently after main result ────────────
// Called by the route handler only when the user has toggled "MiroFish Forecast".
// This keeps orchestrate() fast (6 agents) while MiroFish completes in the
// background with the stream still open.
export async function runMirofishAgent(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  onOrchestrationLog?: (message: string) => void,
): Promise<AgentOutput | null> {
  // Re-classify so mirofish has the same product context as the main run
  onOrchestrationLog?.('MiroFish: refreshing product context…');
  const classification = await classifyQuery(query, history, images, memoryContext);
  const { product, competitor, productUrl, competitorUrl, intent } = classification;

  const priorContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const agentContext: AgentContext = {
    query: intent,
    product,
    competitor,
    productUrl,
    competitorUrl,
    priorContext: priorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: memoryContext || undefined,
  };

  const run: AgentRun = { agentId: mirofishAgent.id, name: mirofishAgent.name, status: 'running', startedAt: new Date().toISOString() };
  onAgentUpdate?.(run);

  try {
    onOrchestrationLog?.('MiroFish: running forecast agent…');
    const output = await mirofishAgent.run(agentContext);
    onAgentUpdate?.({ ...run, status: 'completed', completedAt: new Date().toISOString() });
    return output;
  } catch (err) {
    onAgentUpdate?.({ ...run, status: 'failed', completedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ── MiroFish Live agent — real VPS only, no synthetic fallback ────────────────
// Dispatched only when the user has toggled "MiroFish Live" in the UI.
export async function runMirofishLiveAgent(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  onOrchestrationLog?: (message: string) => void,
): Promise<AgentOutput | null> {
  const isUnavailableLiveOutput = (output: AgentOutput): boolean => {
    const forecastLike = output as AgentOutput & { rationale?: string; swarmSize?: number };
    const interpretation = Array.isArray(output.interpretation) ? output.interpretation : [];
    const rationale = typeof forecastLike.rationale === 'string' ? forecastLike.rationale : '';
    const swarmSize = typeof forecastLike.swarmSize === 'number' ? forecastLike.swarmSize : undefined;
    return (
      interpretation.some(line => /mirofish live unavailable|live swarm unavailable|live swarm interviews failed/i.test(line)) ||
      /unavailable|interviews failed|no responses/i.test(rationale) ||
      swarmSize === 0
    );
  };

  onOrchestrationLog?.('MiroFish Live: connecting via MIROFISH_LIVE_BASE_URL…');
  const classification = await classifyQuery(query, history, images, memoryContext);
  const { product, competitor, productUrl, competitorUrl, intent } = classification;

  const priorContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const agentContext: AgentContext = {
    query: intent,
    product,
    competitor,
    productUrl,
    competitorUrl,
    priorContext: priorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: memoryContext || undefined,
  };

  const liveRun: AgentRun = {
    agentId: mirofishLiveAgent.id,
    name: mirofishLiveAgent.name,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  onAgentUpdate?.(liveRun);

  try {
    onOrchestrationLog?.('MiroFish Live: interviewing live swarm…');
    const output = await mirofishLiveAgent.run(agentContext);
    const failed = isUnavailableLiveOutput(output);
    onAgentUpdate?.({
      ...liveRun,
      status: failed ? 'failed' : 'completed',
      completedAt: new Date().toISOString(),
      ...(failed ? { error: (output as AgentOutput & { rationale?: string }).rationale ?? 'Live swarm unavailable' } : {}),
    });
    return output;
  } catch (err) {
    onAgentUpdate?.({
      ...liveRun,
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
