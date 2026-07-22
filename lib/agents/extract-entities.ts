import { isPlaceholderCompetitor, isPlaceholderProduct } from './entity-url';

export type ExtractedEntities = {
  product?: string;
  competitor?: string;
};

/**
 * Deterministic product/competitor extraction for compare-style questions.
 * Used when Gemini classification fails or returns placeholders.
 */
export function extractEntitiesFromQuery(query: string): ExtractedEntities {
  const q = query.trim();
  if (!q) return {};

  const patterns: RegExp[] = [
    // How does Notion compete with Linear …
    /how\s+does\s+(.+?)\s+compete\s+with\s+(.+?)(?:\s+for\s+|\s+in\s+|\s+on\s+|[\?.,!]|$)/i,
    // Notion vs Linear / Notion versus Linear
    /^(.+?)\s+vs\.?\s+(.+?)(?:\s+for\s+|\s+in\s+|[\?.,!]|$)/i,
    /^(.+?)\s+versus\s+(.+?)(?:\s+for\s+|\s+in\s+|[\?.,!]|$)/i,
    // Compare Notion and/with/to Linear
    /compare\s+(.+?)\s+(?:and|with|to|vs\.?|versus)\s+(.+?)(?:\s+for\s+|\s+in\s+|[\?.,!]|$)/i,
    // Notion against Linear
    /^(.+?)\s+against\s+(.+?)(?:\s+for\s+|\s+in\s+|[\?.,!]|$)/i,
  ];

  for (const re of patterns) {
    const m = q.match(re);
    if (!m?.[1] || !m?.[2]) continue;
    const product = cleanEntityName(m[1]);
    const competitor = cleanEntityName(m[2]);
    if (!product || !competitor) continue;
    if (isPlaceholderProduct(product) || isPlaceholderCompetitor(competitor)) continue;
    return { product, competitor };
  }

  return {};
}

function cleanEntityName(raw: string): string | undefined {
  let cleaned = raw
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\b(the|a|an)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop trailing topic words that often follow the competitor name
  cleaned = cleaned
    .replace(/\s+(?:for|in|on|about|regarding|pricing|price|features?|comparison|review|reviews|market|growth|strategy)\b.*$/i, '')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 60) return undefined;
  // Reject sentence fragments
  if (/\b(how|what|why|when|which|should|could|would)\b/i.test(cleaned)) return undefined;
  return cleaned;
}

/** Prefer LLM value when real; otherwise heuristic; never keep known placeholders. */
export function resolveProductName(
  llmProduct: unknown,
  heuristic: ExtractedEntities,
  fallback = 'unknown product',
): string {
  const fromLlm = typeof llmProduct === 'string' ? llmProduct.trim() : '';
  if (fromLlm && !isPlaceholderProduct(fromLlm)) return fromLlm;
  if (heuristic.product && !isPlaceholderProduct(heuristic.product)) return heuristic.product;
  return fallback;
}

export function resolveCompetitorName(
  llmCompetitor: unknown,
  heuristic: ExtractedEntities,
): string | undefined {
  const fromLlm = typeof llmCompetitor === 'string' ? llmCompetitor.trim() : '';
  if (fromLlm && !isPlaceholderCompetitor(fromLlm)) return fromLlm;
  if (heuristic.competitor && !isPlaceholderCompetitor(heuristic.competitor)) {
    return heuristic.competitor;
  }
  return undefined;
}
