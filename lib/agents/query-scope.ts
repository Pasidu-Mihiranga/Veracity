import type { ExtractedEntities } from '@/lib/agents/extract-entities';

/** Canned dig-deeper prompts that must stay clarifying — never invent a product from memory. */
const GENERIC_CONTINUE_RE =
  /^(what product or competitor would you like to analyze|compare your product against a key market rival|explore market trends for your industry)\b/i;

/** Signals the user wants live research agents (not a conceptual role/ecosystem answer). */
const RESEARCH_COMPARE_RE =
  /\b(pricing|price|positioning|features?|roadmap|market\s+share|compete|competitor|competitive|win[\s-]?loss|gtm|icp|swot|benchmark|head[\s-]?to[\s-]?head|market\s+trends?|go[\s-]?to[\s-]?market)\b/i;

export function isGenericContinuePrompt(query: string): boolean {
  return GENERIC_CONTINUE_RE.test(query.trim());
}

export function isResearchCompareIntent(query: string): boolean {
  return RESEARCH_COMPARE_RE.test(query);
}

/**
 * Two named entities compared without research keywords → answer in Tier 0 (no agents).
 * e.g. "Compare WSO2 and SyscoLabs" / "difference between X and Y".
 */
export function isConceptualCompareQuery(
  query: string,
  heuristic: ExtractedEntities,
): boolean {
  if (!heuristic.product || !heuristic.competitor) return false;
  if (isResearchCompareIntent(query)) return false;
  return true;
}

/**
 * Drop profile/recall memory when the current query is about other companies,
 * or when the prompt is a generic dig-deeper continue.
 */
export function gateMemoryContext(
  query: string,
  memoryContext: string | undefined,
  heuristic: ExtractedEntities,
): string | undefined {
  if (!memoryContext?.trim()) return undefined;
  if (isGenericContinuePrompt(query)) return undefined;

  if (heuristic.product || heuristic.competitor) {
    const companyLine = memoryContext.match(/User Company:\s*(.+)/i)?.[1]?.trim();
    const queryEntities = [heuristic.product, heuristic.competitor]
      .filter(Boolean)
      .map((s) => s!.toLowerCase());
    const qLower = query.toLowerCase();

    if (companyLine) {
      const companyLower = companyLine.toLowerCase();
      const companyInQuery =
        qLower.includes(companyLower)
        || queryEntities.some(
          (e) => e === companyLower || companyLower.includes(e) || e.includes(companyLower),
        );
      if (!companyInQuery) return undefined;
    }

    // Also drop when durable facts / recall clearly about a different named product
    const foreignHints = ['lilian', 'clay', 'vector agents', 'vectoragents'];
    const queryMentionsForeign = foreignHints.some((h) => qLower.includes(h));
    if (!queryMentionsForeign) {
      const memoryMentionsForeign = foreignHints.some((h) =>
        memoryContext.toLowerCase().includes(h),
      );
      if (memoryMentionsForeign && queryEntities.every((e) => !foreignHints.includes(e))) {
        return undefined;
      }
    }
  }

  return memoryContext;
}

/** Keep only history that mentions the current query entities (avoids Lilian→WSO2 bleed). */
export function filterHistoryForQueryScope<T extends { content: string }>(
  history: T[],
  heuristic: ExtractedEntities,
  limit = 4,
): T[] {
  if (!heuristic.product && !heuristic.competitor) {
    return history.slice(-limit);
  }
  const terms = [heuristic.product, heuristic.competitor]
    .filter(Boolean)
    .map((t) => t!.toLowerCase());
  const matched = history.filter((m) => {
    const c = m.content.toLowerCase();
    return terms.some((t) => t.length >= 2 && c.includes(t));
  });
  return matched.slice(-limit);
}
