import type { ExtractedEntities } from '@/lib/agents/extract-entities';

/** Tokenize a brand/company name for overlap checks (language-agnostic). */
export function entityTokens(...names: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const name of names) {
    if (!name?.trim()) continue;
    for (const part of name.toLowerCase().split(/[\s./_-]+/)) {
      if (part.length >= 2) out.add(part);
    }
  }
  return [...out];
}

export function textMentionsAnyToken(text: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const lower = text.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

/** Entities named in the current query (heuristic + raw query tokens). */
export function queryFocusTokens(query: string, heuristic: ExtractedEntities): string[] {
  const fromHeuristic = entityTokens(heuristic.product, heuristic.competitor);
  if (fromHeuristic.length > 0) return fromHeuristic;
  // No extracted pair — do not invent; caller uses short history window only
  return [];
}

/**
 * Drop memory/recall when it does not mention any entity from the current query.
 * No product-specific blocklists.
 */
export function gateMemoryContext(
  query: string,
  memoryContext: string | undefined,
  heuristic: ExtractedEntities,
): string | undefined {
  if (!memoryContext?.trim()) return undefined;

  const focus = queryFocusTokens(query, heuristic);
  if (focus.length === 0) {
    // Vague prompt — do not inject profile/competitor memory (prevents pivot to old topic)
    return undefined;
  }

  if (textMentionsAnyToken(memoryContext, focus)) {
    return memoryContext;
  }

  const profileCompany = memoryContext.match(/User Company:\s*(.+)/i)?.[1]?.trim();
  if (profileCompany && textMentionsAnyToken(query, entityTokens(profileCompany))) {
    return memoryContext;
  }

  return undefined;
}

/** History turns that mention the same entities as the current query (or recent window if none). */
export function filterHistoryForQueryScope<T extends { content: string }>(
  history: T[] = [],
  heuristic: ExtractedEntities,
  limit = 4,
): T[] {
  const safeHistory = Array.isArray(history) ? history : [];
  const focus = entityTokens(heuristic.product, heuristic.competitor);
  if (focus.length === 0) {
    return safeHistory.slice(-Math.min(2, limit));
  }
  const matched = safeHistory.filter((m) => textMentionsAnyToken(m.content, focus));
  if (matched.length === 0) return [];
  return matched.slice(-limit);
}

export type ExecutionTier = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Align tier/domains with classifier `needsResearch` and extracted entities.
 * No product-specific rules — only structure: research vs direct answer.
 */
export function reconcileResearchTier(
  heuristic: ExtractedEntities,
  parsed: {
    tier: number;
    needsResearch?: boolean;
    domains: import('@/lib/agents/types').IntelligenceDomain[];
  },
): { tier: ExecutionTier; domains: import('@/lib/agents/types').IntelligenceDomain[] } {
  const dualNamed = Boolean(heuristic.product && heuristic.competitor);
  let tier = Math.min(5, Math.max(0, Math.round(parsed.tier))) as ExecutionTier;
  let domains = [...parsed.domains];

  if (parsed.needsResearch === false) {
    return { tier: 0, domains: [] };
  }

  if (parsed.needsResearch === true && tier === 0) {
    tier = (dualNamed ? 2 : 3) as ExecutionTier;
  }

  if (dualNamed && tier === 0) {
    tier = 2;
    if (domains.length === 0) {
      domains = ['competitive', 'win-loss', 'positioning'];
    }
  }

  if (tier === 0) {
    domains = [];
  }

  return { tier, domains };
}
