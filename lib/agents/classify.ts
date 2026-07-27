import { detectExecutionIntent } from '@/lib/agents/execution-intent';
import { generateHuggingFaceJson } from '@/lib/agents/gemini';
import {
  extractEntitiesFromQuery,
  resolveCompetitorName,
  resolveProductName,
} from '@/lib/agents/extract-entities';
import { isPlaceholderProduct } from '@/lib/agents/entity-url';
import { logger } from '@/lib/logger';
import type {
  ConversationMessage,
  ImageAttachment,
  IntelligenceDomain,
} from '@/lib/agents/types';

export type ExecutionTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface ClassificationResult {
  product: string;
  competitor?: string;
  productUrl?: string;
  competitorUrl?: string;
  domains: IntelligenceDomain[];
  intent: string;
  runExecution: boolean;
  tier: ExecutionTier;
  tierReason: string;
}

const VALID_DOMAINS: IntelligenceDomain[] = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
];

export function isUnclearOrGibberishPrompt(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 2) return true;

  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (/^(hi|hello|hey|help|cac|nrr|ltv|roi|saas|gtm|sdr|icp|pricing|clay|linear|notion|figma|apollo)$/i.test(w)) {
      return false;
    }
    const vowels = w.match(/[aeiou]/gi);
    if (!vowels && w.length >= 3) return true;
    if (vowels && (w.length / vowels.length > 4) && w.length >= 6) return true;
    if (/(.)\1{3,}/.test(w)) return true;
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(w)) return true;
  }
  return false;
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

export async function classifyQuery(
  query: string,
  history: ConversationMessage[],
  images: ImageAttachment[] = [],
  memoryContext?: string,
): Promise<ClassificationResult> {
  const qLower = query.trim().toLowerCase();

  if (isUnclearOrGibberishPrompt(query)) {
    return {
      product: 'Veracity AI',
      intent: 'Unclear or typo input',
      domains: [],
      runExecution: false,
      tier: 0,
      tierReason: 'Layer 1 Match: Gibberish/Typo Input',
    };
  }

  const heuristic = extractEntitiesFromQuery(query);
  const regexExecution = detectExecutionIntent(query);

  const isMetaPlatformQuery =
    /\b(your|yourself|this app|this platform|veracity|you use|you work|you provide|your api|api provider|api povider|your backend|your model|your LLM|your engine|your stack|your system|your pricing|your features)\b/i.test(qLower) &&
    !heuristic.product &&
    !heuristic.competitor;

  const isDirectGreetingOrConcept =
    (/^(hi|hello|hey|greetings|help|who are you|what can you do|what type of|what do you do|how do you work|what are your|explain what|tell me about|what is cac|what is nrr|explain cac|explain churn)\b/i.test(qLower) ||
     /(can you|capabilities|help me|features|you provide|your purpose|yourself|api provider|api povider)\b/i.test(qLower) ||
     isMetaPlatformQuery) &&
    !heuristic.product &&
    !heuristic.competitor;

  if (isDirectGreetingOrConcept) {
    return {
      product: 'Veracity AI',
      intent: query,
      domains: [],
      runExecution: false,
      tier: 0,
      tierReason: 'Layer 1 Deterministic Match: Tier 0 Direct Answer (0ms)',
    };
  }

  const priorContext = history
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

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
  "runExecution": boolean,   // true if the query is execution-intent (write copy, draft outreach, campaign brief, cold email, LinkedIn post, variants)
  "tier": number             // Execution tier: 0 (direct chat <1s), 1 (single search ~2.5s), 2 (targeted 2-agent ~5s), 3 (full swarm ~12s), 4 (execution engine ~18s), 5 (persona simulation ~35s)
}

Domain selection & Tier rules:
- Tier 0 (Direct Answer, 0 domains): Conversational greetings, meta-questions about Veracity AI or what it can do/capabilities, generic business concept definitions without a specific target company.
- Tier 1 (1 domain): Single factual metric lookup for 1 company (e.g. pricing).
- Tier 2 (2-3 domains): Focused comparison or positioning analysis between 2 companies (include competitive, win-loss, positioning, and pricing when both products are software).
- Tier 3 (Full Swarm): Complex multi-domain strategic research prompts (e.g. "What should Vector Agents build?").
- Tier 4: Deliverable creation prompts (write copy, campaign brief, cold email, variants).
- Tier 5: Persona panel simulation prompts.`;

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
    let rawTier = Number(parsed.tier);
    if (isNaN(rawTier)) {
      rawTier = regexExecution ? 4 : 3;
    }

    const hasExplicitBrandInQuery = heuristic.product || heuristic.competitor || /\b(clay|notion|linear|figma|apollo|vector agents|lilian|gong|hubspot|salesforce)\b/i.test(qLower);
    if (!hasExplicitBrandInQuery && /\b(your|yourself|this app|this platform|you use|you work|api provider|api povider|your model|your engine|backend|system)\b/i.test(qLower)) {
      rawTier = 0;
    } else if ((!product || isPlaceholderProduct(product) || product === 'Veracity AI') && !competitor) {
      if (/^(hi|hello|hey|greetings|help|who are you|what can you do|what type of|what do you do|how do you work)\b/i.test(qLower)) {
        rawTier = 0;
      }
    }

    const tier: ExecutionTier = (rawTier >= 0 && rawTier <= 5) ? (rawTier as ExecutionTier) : (regexExecution ? 4 : 3);
    const domains = tier === 0 ? [] : normalizeDomains(parsed.domains);

    return {
      product,
      competitor,
      productUrl: (parsed.productUrl as string) || undefined,
      competitorUrl: (parsed.competitorUrl as string) || undefined,
      domains,
      intent: (parsed.intent as string) || query,
      runExecution: Boolean(parsed.runExecution) || regexExecution,
      tier,
      tierReason: `Layer 2 LLM Match: Tier ${tier}`,
    };
  } catch (err) {
    logger.error('classify.failed', {
      query,
      error: err instanceof Error ? err.message : String(err),
      heuristic,
    });
    return {
      product: resolveProductName(undefined, heuristic, 'unknown product'),
      competitor: resolveCompetitorName(undefined, heuristic),
      domains: ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'],
      intent: query,
      runExecution: regexExecution,
      tier: regexExecution ? 4 : 3,
      tierReason: 'Layer 3 Safety Fallback: Tier 3 Full Swarm',
    };
  }
}
