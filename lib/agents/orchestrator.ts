import { marketTrendsAgent } from './market-trends';
import { competitiveAgent } from './competitive';
import { winLossAgent } from './win-loss';
import { pricingAgent } from './pricing';
import { positioningAgent } from './positioning';
import { adjacentAgent } from './adjacent';
import { executionEngineAgent } from './execution/execution-engine';
import { mirofishAgent } from './mirofish';
import { mirofishLiveAgent } from './mirofish-live';
import { generateHuggingFaceJson, generateHuggingFaceText } from './gemini';
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
import { resolveAgentSet } from '@/lib/agents/adaptive-selection';
import { planMission } from '@/lib/agents/mission-planner';
import { shouldRunExecution as planExecution } from '@/lib/agents/execution-planner';
import { buildMissionSummary } from '@/lib/agents/mission-summary';
import { getWorkflowExecutor } from '@/lib/agents/workflow';
import {
  classifyQuery,
  isUnclearOrGibberishPrompt,
} from '@/lib/agents/classify';
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

export type { ExecutionTier } from '@/lib/agents/classify';
export { isUnclearOrGibberishPrompt } from '@/lib/agents/classify';

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

interface OrchestrateOptions {
  injectedContext?: string; // extra context injected into agents and synthesizer (e.g. feedback loop)
  forceExecution?: boolean; // force stage-2 execution even when classifier says false
  followUpMode?: 'full' | 'targeted'; // targeted runs only classifier-selected research domains
  selectedAgents?: string[]; // optional UI-selected domains from client
  forceFullSweep?: boolean; // bypass adaptive cost-aware selection
  /** Live status lines for the UI (e.g. “Reasoning…”, “Orchestrating…”). */
  onOrchestrationLog?: (message: string) => void | Promise<void>;
  /** Fired once mission plan + estimates are ready (pre fan-out). */
  onMissionSummary?: (summary: import('@/lib/agents/mission-summary').MissionSummary) => void | Promise<void>;
  /** Async cancel check between mission waves */
  shouldCancel?: () => boolean | Promise<boolean>;
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

async function generateDirectAnswer(
  query: string,
  history: ConversationMessage[],
  memoryContext?: string,
): Promise<string> {
  if (isUnclearOrGibberishPrompt(query)) {
    return `I couldn't understand your input ("${query}"). It appears to be a typo or unrecognized prompt.\n\nPlease enter a specific question about your product, competitors, or market strategy (for example: "Compare Notion and Linear pricing" or "What features should Vector Agents build?").`;
  }

  const priorContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const systemPrompt = `You are Veracity AI, an authoritative executive growth intelligence consultant. Answer the user's question directly, clearly, and helpfully in plain English prose (<100 words). Do not use buzzwords like "agentic", "cognitive load", or "verticalize".`;

  const userPrompt = `${memoryContext ? `${memoryContext}\n\n` : ''}${priorContext ? `Conversation history:\n${priorContext}\n\n` : ''}User question: "${query}"`;
  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  try {
    const text = await generateHuggingFaceText(combinedPrompt, {
      maxNewTokens: 256,
      temperature: 0.2,
    });
    return text.trim();
  } catch {
    return `Hello! I am Veracity AI, your executive growth intelligence platform. Ask me any question to analyze competitors, compare positioning, audit pricing, or forecast market trends.`;
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

  const { product, competitor, productUrl, competitorUrl, intent, runExecution, tier } = classification;
  log?.(`Classified product: ${product}${competitor ? ` vs ${competitor}` : ''} — Tier ${tier} (${intent})`);
  if (isPlaceholderProduct(product)) {
    log?.(`Warning: product name looks like a placeholder ("${product}") — search quality may be low.`);
  }

  const forceFull = options?.forceFullSweep === true;

  // Tier 0 Fast-Path Execution (<1.0s latency, 0 search agent runs)
  if (tier === 0 && !forceFull) {
    log?.('Tier 0 Direct Answer fast-path — generating instant response…');
    const directAnswer = await generateDirectAnswer(query, history, memoryContext);
    const latencyMs = Date.now() - orchestrationStart;

    return {
      query,
      product,
      competitor,
      agentRuns: [],
      outputs: [],
      synthesizedAnswer: directAnswer,
      topRecommendations: [],
      suggestedFollowUps: [
        'What product or competitor would you like to analyze today?',
        'Compare your product against a key market rival.',
        'Explore market trends for your industry.',
      ],
      totalConfidence: 'high',
      generatedAt: new Date().toISOString(),
      selectionMeta: {
        mode: 'adaptive',
        savedVsFull: 6,
        researchIds: [],
        tier: 0,
        tierLabel: 'TIER 0 · DIRECT RESPONSE',
      },
      metrics: {
        totalLatencyMs: latencyMs,
        agentLatencies: {},
        estimatedCostUsd: EST_COST_PER_MODEL_CALL * 2,
        toolCallCount: 0,
        geminiCallCount: 2,
        agentCount: 0,
        completedAgentCount: 0,
        failedAgentCount: 0,
      },
    };
  }

  const minAgents = tier === 1 ? 1 : tier === 2 ? 2 : tier === 0 ? 0 : 3;

  const resolved = resolveAgentSet({
    uiSelected: options?.selectedAgents?.length
      ? options.selectedAgents
      : ALL_AGENTS.map((a) => a.id),
    classifierDomains: (classification.domains ?? []) as IntelligenceDomain[],
    forceFullSweep: forceFull,
    minAgents,
  });

  const execGate = planExecution({
    query,
    classifierRunExecution: runExecution,
    executionAgentSelected: resolved.executionSelected,
    forceExecution: options?.forceExecution,
  });
  const shouldRunExecution = execGate.run;
  if (!shouldRunExecution) {
    log?.(execGate.reason);
  }

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

  const scratchpad = {
    productFacts: [] as string[],
    competitorFacts: [] as string[],
    openQuestions: [] as string[],
  };

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
    scratchpad,
  };

  // Step 2: Select research agents (cost-aware adaptive, or targeted follow-up)
  let researchIds = resolved.researchIds;
  if (options?.followUpMode === 'targeted') {
    const classifiedDomains = new Set(classification.domains ?? []);
    const targeted = researchIds.filter((id) => classifiedDomains.has(id));
    if (targeted.length > 0) researchIds = targeted;
  }

  const agentsToRun = ALL_AGENTS.filter((a) => researchIds.includes(a.id as IntelligenceDomain));
  const missionSteps = planMission([
    ...researchIds,
    ...(shouldRunExecution ? (['execution-engine'] as IntelligenceDomain[]) : []),
  ]);
  const missionSummary = buildMissionSummary({
    steps: missionSteps,
    product,
    competitor,
    includeExecution: shouldRunExecution,
  });
  await options?.onMissionSummary?.(missionSummary);
  log?.(
    `Mission plan: ${missionSummary.agentCount} agents · ~${missionSummary.estimatedSeconds}s · ~$${missionSummary.estimatedCostUsd}`,
  );
  for (const step of missionSummary.steps) {
    log?.(`• ${step.label}`);
  }
  if (resolved.mode === 'adaptive' && resolved.savedVsFull > 0) {
    log?.(`Adaptive selection saved ${resolved.savedVsFull} agent(s) vs full sweep`);
  }

  const sweepLabel =
    options?.followUpMode === 'targeted'
      ? 'targeted follow-up'
      : resolved.mode === 'adaptive'
        ? 'adaptive research sweep'
        : 'full research sweep';
  log?.(`Dividing work across ${agentsToRun.length} specialist agents (${sweepLabel})…`);
  log?.('Orchestrating parallel research — search, fetch, and extract…');

  // Step 3: Fan-out via WorkflowExecutor (CurrentExecutor today; LangGraph optional later)
  const researchOnlySteps = missionSteps.filter((s) => s.agentId !== 'execution-engine');
  const executor = getWorkflowExecutor();
  const waveResult = await executor.execute(
    {
      steps: researchOnlySteps,
      agents: agentsToRun,
      context: agentContext,
      scratchpad,
    },
    {
      onAgentUpdate: (run) => onAgentUpdate?.(run),
      onOrchestrationLog: log,
      shouldCancel: options?.shouldCancel,
    },
  );
  const agentRuns: AgentRun[] = [...waveResult.agentRuns];
  const outputs: AgentOutput[] = [...waveResult.outputs];
  const agentLatencies: Record<string, number> = { ...waveResult.agentLatencies };

  // Each research agent makes ~1 model call
  modelCallCount += agentsToRun.length;

  // ── Stage 2: Execution Engine (only if execution intent detected) ──────────
  if (shouldRunExecution) {
    if (options?.shouldCancel && (await options.shouldCancel())) {
      log?.('Cancel requested — skipping execution engine.');
      throw new Error('Job cancelled');
    }
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
        researchOutputs: outputs,
        scratchpad,
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
    missionPlan: {
      steps: missionSteps.map((s) => ({
        id: s.id,
        label: s.label,
        agentId: s.agentId,
        dependsOn: s.dependsOn,
        rationale: s.rationale,
      })),
    },
    selectionMeta: {
      mode: resolved.mode,
      savedVsFull: resolved.savedVsFull,
      researchIds: researchIds as string[],
    },
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
