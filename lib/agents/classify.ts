import { detectExecutionIntent } from '@/lib/agents/execution-intent';
import { generateHuggingFaceJson } from '@/lib/agents/gemini';
import {
  extractEntitiesFromQuery,
  resolveCompetitorName,
  resolveProductName,
} from '@/lib/agents/extract-entities';
import { isPlaceholderProduct } from '@/lib/agents/entity-url';
import {
  filterHistoryForQueryScope,
  gateMemoryContext,
  reconcileResearchTier,
} from '@/lib/agents/query-scope';
import { logger } from '@/lib/logger';
import type {
  ConversationMessage,
  ImageAttachment,
  IntelligenceDomain,
} from '@/lib/agents/types';

export type { ExecutionTier } from '@/lib/agents/query-scope';

export interface ClassificationResult {
  product: string;
  competitor?: string;
  productUrl?: string;
  competitorUrl?: string;
  domains: IntelligenceDomain[];
  intent: string;
  runExecution: boolean;
  tier: import('@/lib/agents/query-scope').ExecutionTier;
  tierReason: string;
  needsResearch?: boolean;
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
    if (/^(hi|hello|hey|help|cac|nrr|ltv|roi|saas|gtm|sdr|icp|pricing)$/i.test(w)) {
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

/** Fast path only when no company/product entities appear in the query. */
export function isMetaOrGreetingWithoutEntities(query: string, heuristic: ReturnType<typeof extractEntitiesFromQuery>): boolean {
  if (heuristic.product || heuristic.competitor) return false;
  const qLower = query.trim().toLowerCase();
  const isMetaPlatformQuery =
    /\b(your|yourself|this app|this platform|veracity|you use|you work|you provide|your api|api provider|your backend|your model|your engine|your stack|your system|your pricing|your features)\b/i.test(qLower);
  return (
    /^(hi|hello|hey|greetings|help|who are you|what can you do|what type of|what do you do|how do you work|what are your|explain what|tell me about|what is cac|what is nrr|explain cac|explain churn)\b/i.test(qLower)
    || /(can you|capabilities|help me|features|you provide|your purpose|yourself|api provider)\b/i.test(qLower)
    || isMetaPlatformQuery
  );
}

export async function classifyQuery(
  query: string,
  history: ConversationMessage[],
  images: ImageAttachment[] = [],
  memoryContext?: string,
): Promise<ClassificationResult> {
  const qLower = query.trim().toLowerCase();
  const heuristic = extractEntitiesFromQuery(query);
  const regexExecution = detectExecutionIntent(query);

  if (isUnclearOrGibberishPrompt(query)) {
    return {
      product: 'Veracity AI',
      intent: 'Unclear or typo input',
      domains: [],
      runExecution: false,
      tier: 0,
      tierReason: 'Deterministic: unclear input',
      needsResearch: false,
    };
  }

  if (isMetaOrGreetingWithoutEntities(query, heuristic)) {
    return {
      product: 'Veracity AI',
      intent: query,
      domains: [],
      runExecution: false,
      tier: 0,
      tierReason: 'Deterministic: meta/greeting (no entities)',
      needsResearch: false,
    };
  }

  const scopedMemory = gateMemoryContext(query, memoryContext, heuristic);
  const scopedHistory = filterHistoryForQueryScope(history, heuristic, 6);
  const priorContext = scopedHistory
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are a query classifier for a growth intelligence system. Extract structured information from the CURRENT query first; use history/memory only when the current query is ambiguous and refers to the same entities.

Always return valid JSON. Never use placeholder product names. Prefer company/product entities over people with the same name. Never replace brands named in the current query with brands from memory or prior turns.`;

  const userPrompt = `${scopedMemory ? `${scopedMemory}\n\n` : ''}Conversation history (same entities only):
${priorContext || 'None'}

Current query: "${query}"
${images.length > 0 ? `\nAttached images: ${images.length}. Metadata only.` : ''}
${heuristic.product ? `\nHeuristic hint — product: "${heuristic.product}"${heuristic.competitor ? `, competitor: "${heuristic.competitor}"` : ''}. Prefer these when they match the query.` : ''}

Respond with JSON:
{
  "product": string,
  "competitor": string | null,
  "productUrl": string | null,
  "competitorUrl": string | null,
  "domains": string[],
  "intent": string,
  "runExecution": boolean,
  "needsResearch": boolean,
  "tier": number
}

Field rules:
- needsResearch: true → run specialist search agents (market/competitive/pricing evidence). Use for product comparisons, positioning, pricing, market trends, and strategic research.
- needsResearch: false → answer from general knowledge only (Tier 0). Use for greetings, Veracity meta questions, definitions, and conceptual "what role does X play" questions with no request for live market evidence.
- tier: 0 direct, 1 single lookup, 2 focused compare, 3 full swarm, 4 execution deliverables, 5 persona simulation. Tier must match needsResearch (if needsResearch is true, tier must be >= 1).
- domains: only when needsResearch is true; options: market-trends, competitive, win-loss, pricing, positioning, adjacent.
- Plain "compare A and B" between products/platforms → needsResearch: true, tier 2, include competitive, win-loss, positioning, pricing when relevant.`;

  try {
    const parsed = await generateHuggingFaceJson<Record<string, unknown>>(systemPrompt, userPrompt, {
      maxNewTokens: 512,
      temperature: 0.1,
    });

    const product = heuristic.product && heuristic.competitor
      ? heuristic.product
      : resolveProductName(parsed.product, heuristic);
    const competitor = heuristic.product && heuristic.competitor
      ? heuristic.competitor
      : resolveCompetitorName(parsed.competitor, heuristic);

    if (isPlaceholderProduct(product)) {
      logger.warn('classify.placeholder_product', { query, product, heuristic });
    }

    const needsResearch = parsed.needsResearch === true
      ? true
      : parsed.needsResearch === false
        ? false
        : undefined;

    let rawTier = Number(parsed.tier);
    if (Number.isNaN(rawTier)) {
      rawTier = regexExecution ? 4 : needsResearch === false ? 0 : 3;
    }

    const hasExplicitBrandInQuery = Boolean(heuristic.product || heuristic.competitor);
    if (!hasExplicitBrandInQuery && /\b(your|yourself|this app|this platform|veracity|you use|you work|api provider|your model|your engine|backend|system)\b/i.test(qLower)) {
      rawTier = 0;
    }

    const normalizedDomains = normalizeDomains(parsed.domains);
    const reconciled = reconcileResearchTier(heuristic, {
      tier: rawTier,
      needsResearch,
      domains: normalizedDomains,
    });

    const tier = reconciled.tier;
    const domains = reconciled.domains;
    const resolvedNeedsResearch = tier === 0 ? false : true;

    return {
      product,
      competitor,
      productUrl: (parsed.productUrl as string) || undefined,
      competitorUrl: (parsed.competitorUrl as string) || undefined,
      domains,
      intent: (parsed.intent as string) || query,
      runExecution: Boolean(parsed.runExecution) || regexExecution,
      tier,
      tierReason: `Classifier: tier ${tier}, needsResearch=${String(resolvedNeedsResearch)}`,
      needsResearch: resolvedNeedsResearch,
    };
  } catch (err) {
    logger.error('classify.failed', {
      query,
      error: err instanceof Error ? err.message : String(err),
      heuristic,
    });
    const fallbackTier = regexExecution ? 4 : heuristic.product && heuristic.competitor ? 2 : 3;
    return {
      product: resolveProductName(undefined, heuristic, 'unknown product'),
      competitor: resolveCompetitorName(undefined, heuristic),
      domains: ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'],
      intent: query,
      runExecution: regexExecution,
      tier: fallbackTier as import('@/lib/agents/query-scope').ExecutionTier,
      tierReason: 'Classifier fallback',
      needsResearch: true,
    };
  }
}
