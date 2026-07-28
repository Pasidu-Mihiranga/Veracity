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
    // Compare / can you compare / typo "comapre" Notion and Linear
    /(?:can\s+(?:you\s+)?)?(?:compare|comapre|compar)\s+(.+?)\s+(?:and|with|to|vs\.?|versus)\s+(.+?)(?:\s+for\s+|\s+in\s+|[\?.,!]|$)/i,
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

  // Single-product patterns: e.g. "Is Lilian competitive...", "What is Clay's pricing", "How is Notion performing"
  const singleProductPatterns: RegExp[] = [
    /\bis\s+([A-Z][A-Za-z0-9\s.-]+?)\s+(?:competitive|growing|leading|popular|good|better|dying|failing|disrupting|expanding)\b/i,
    /\bwhat\s+is\s+([A-Z][A-Za-z0-9\s.-]+?)(?:'s|\s+)(?:pricing|features|positioning|strategy|roadmap|market|revenue)\b/i,
    /\bhow\s+is\s+([A-Z][A-Za-z0-9\s.-]+?)\s+(?:doing|performing|competing|positioned)\b/i,
    /\babout\s+([A-Z][A-Za-z0-9\s.-]+?)(?:\s+in\s+|\s+on\s+|[\?.,!]|$)/i,
    /\bfor\s+([A-Z][A-Za-z0-9\s.-]+?)(?:\s+in\s+|\s+on\s+|[\?.,!]|$)/i,
  ];

  for (const re of singleProductPatterns) {
    const m = q.match(re);
    if (m?.[1]) {
      const product = cleanEntityName(m[1]);
      if (product && !isPlaceholderProduct(product)) {
        return { product };
      }
    }
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
  // Reject meta pronouns that can appear in prompts like "tell me about you"
  if (/^(you|yourself|your|me|my|we|us|our|this app|this platform)$/i.test(cleaned)) {
    return undefined;
  }
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
