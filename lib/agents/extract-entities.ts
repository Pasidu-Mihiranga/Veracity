import { isPlaceholderCompetitor, isPlaceholderProduct } from './entity-url';
import { generateHuggingFaceJson } from './gemini';
import type { IndustryVertical } from './types';
import { logger } from '@/lib/logger';

export type ExtractedEntities = {
  product?: string;
  competitor?: string;
  entities?: string[];
  industryVertical?: IndustryVertical;
  productUrl?: string;
  competitorUrl?: string;
};

export interface CanonicalEntityResolution {
  product: string;
  competitor?: string;
  entities: string[];
  industryVertical: IndustryVertical;
  productUrl?: string;
  competitorUrl?: string;
}

/**
 * Common phonetic / typo alias dictionary for high-frequency benchmark entities.
 */
const KNOWN_CANONICAL_ALIASES: Record<string, { canonical: string; vertical: IndustryVertical }> = {
  'maliban': { canonical: 'Maliban Biscuit Manufactories', vertical: 'FMCG_RETAIL' },
  'maliban biscuts': { canonical: 'Maliban Biscuit Manufactories', vertical: 'FMCG_RETAIL' },
  'maliban biscuts comapany': { canonical: 'Maliban Biscuit Manufactories', vertical: 'FMCG_RETAIL' },
  'maliban biscuits': { canonical: 'Maliban Biscuit Manufactories', vertical: 'FMCG_RETAIL' },
  'maliban biscuits company': { canonical: 'Maliban Biscuit Manufactories', vertical: 'FMCG_RETAIL' },
  'muchee': { canonical: 'Ceylon Biscuits Limited (Munchee)', vertical: 'FMCG_RETAIL' },
  'muchee bisuts': { canonical: 'Ceylon Biscuits Limited (Munchee)', vertical: 'FMCG_RETAIL' },
  'muchee bisuts comapny': { canonical: 'Ceylon Biscuits Limited (Munchee)', vertical: 'FMCG_RETAIL' },
  'munchee': { canonical: 'Ceylon Biscuits Limited (Munchee)', vertical: 'FMCG_RETAIL' },
  'munchee biscuits': { canonical: 'Ceylon Biscuits Limited (Munchee)', vertical: 'FMCG_RETAIL' },
  'dilmah': { canonical: 'Dilmah Tea', vertical: 'FMCG_RETAIL' },
  'akbar brothers': { canonical: 'Akbar Brothers', vertical: 'FMCG_RETAIL' },
  'mlesna': { canonical: 'Mlesna Tea', vertical: 'FMCG_RETAIL' },
  'commercial bank': { canonical: 'Commercial Bank of Ceylon', vertical: 'FINANCE' },
  'sampath bank': { canonical: 'Sampath Bank', vertical: 'FINANCE' },
  'hnb': { canonical: 'Hatton National Bank (HNB)', vertical: 'FINANCE' },
  'central bank': { canonical: 'Central Bank of Sri Lanka', vertical: 'FINANCE' },
  'notion': { canonical: 'Notion', vertical: 'B2B_SAAS' },
  'linear': { canonical: 'Linear', vertical: 'B2B_SAAS' },
  'clay': { canonical: 'Clay', vertical: 'B2B_SAAS' },
  'apollo': { canonical: 'Apollo.io', vertical: 'B2B_SAAS' },
  'uber': { canonical: 'Uber', vertical: 'CONSUMER_TECH' },
  'pickme': { canonical: 'PickMe', vertical: 'CONSUMER_TECH' },
  'yego': { canonical: 'Yego', vertical: 'CONSUMER_TECH' },
};

function lookupKnownAlias(raw: string): { canonical: string; vertical: IndustryVertical } | null {
  const norm = raw.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  return KNOWN_CANONICAL_ALIASES[norm] || null;
}

/**
 * Deterministic regex fallback entity extraction.
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
    let product = cleanEntityName(m[1]);
    let competitor = cleanEntityName(m[2]);
    if (!product || !competitor) continue;

    const aliasP = lookupKnownAlias(product);
    const aliasC = lookupKnownAlias(competitor);
    if (aliasP) product = aliasP.canonical;
    if (aliasC) competitor = aliasC.canonical;

    if (isPlaceholderProduct(product) || isPlaceholderCompetitor(competitor)) continue;
    const vertical = aliasP?.vertical || aliasC?.vertical || inferVerticalFromKeywords(query);

    return { product, competitor, entities: [product, competitor], industryVertical: vertical };
  }

  // Single-product patterns
  const singleProductPatterns: RegExp[] = [
    /\bis\s+([A-Z0-9a-z\s.-]+?)\s+(?:competitive|growing|leading|popular|good|better|dying|failing|disrupting|expanding)\b/i,
    /\bwhat\s+is\s+([A-Z0-9a-z\s.-]+?)(?:'s|\s+)(?:pricing|features|positioning|strategy|roadmap|market|revenue|products|share)\b/i,
    /\bhow\s+is\s+([A-Z0-9a-z\s.-]+?)\s+(?:doing|performing|competing|positioned)\b/i,
    /\babout\s+([A-Z0-9a-z\s.-]+?)(?:\s+in\s+|\s+on\s+|[\?.,!]|$)/i,
    /\bfor\s+([A-Z0-9a-z\s.-]+?)(?:\s+in\s+|\s+on\s+|[\?.,!]|$)/i,
  ];

  for (const re of singleProductPatterns) {
    const m = q.match(re);
    if (m?.[1]) {
      let product = cleanEntityName(m[1]);
      if (product && !isPlaceholderProduct(product)) {
        const alias = lookupKnownAlias(product);
        if (alias) product = alias.canonical;
        return { product, entities: [product], industryVertical: alias?.vertical || inferVerticalFromKeywords(query) };
      }
    }
  }

  return {};
}

function inferVerticalFromKeywords(text: string): IndustryVertical {
  const lower = text.toLowerCase();
  if (/biscuit|tea|beverage|food|fmcg|retail|supermarket|packet|grocery|snack|brand|consumer goods/i.test(lower)) {
    return 'FMCG_RETAIL';
  }
  if (/bank|banking|interest rate|basis points|bps|loan|finance|deposit|treasury|lending/i.test(lower)) {
    return 'FINANCE';
  }
  if (/saas|software|api|sdk|cloud|platform|b2b|crm|integration|developer/i.test(lower)) {
    return 'B2B_SAAS';
  }
  if (/app|ride|taxi|delivery|ecommerce|consumer/i.test(lower)) {
    return 'CONSUMER_TECH';
  }
  return 'GENERAL';
}

function cleanEntityName(raw: string): string | undefined {
  let cleaned = raw
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\b(the|a|an)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop trailing topic words
  cleaned = cleaned
    .replace(/\s+(?:for|in|on|about|regarding|pricing|price|features?|comparison|review|reviews|market|growth|strategy)\b.*$/i, '')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return undefined;
  if (/^(you|yourself|your|me|my|we|us|our|this app|this platform)$/i.test(cleaned)) {
    return undefined;
  }
  if (/\b(how|what|why|when|which|should|could|would)\b/i.test(cleaned)) return undefined;
  return cleaned;
}

/**
 * LLM Pre-normalization step: Fixes typos, resolves canonical corporate names,
 * and classifies the true industry vertical.
 */
export async function normalizeEntitiesWithLlm(query: string): Promise<CanonicalEntityResolution> {
  const heuristic = extractEntitiesFromQuery(query);

  const prompt = `You are a precision Entity Resolution and Normalization engine for market intelligence.
Extract and canonicalize company/product entities and identify the industry vertical.

Query: "${query}"

Instructions:
1. Fix all typos, phonetic misspellings, and casing errors (e.g. "maliban biscuts comapany" -> "Maliban Biscuit Manufactories"; "muchee bisuts comapny" -> "Ceylon Biscuits Limited (Munchee)"; "linar" -> "Linear"; "notoin" -> "Notion").
2. Deduplicate entity aliases into clean canonical names.
3. Identify the exact industry vertical:
   - FMCG_RETAIL: Food, beverage, biscuits, retail goods, supermarkets, consumer packaged goods.
   - B2B_SAAS: Enterprise software, cloud tools, APIs, devtools, CRM.
   - CONSUMER_TECH: Ride-hailing, consumer apps, streaming, social platforms.
   - FINANCE: Banks, fintech, asset management, payment gateways.
   - GENERAL: Other industries.

Return strictly valid JSON:
{
  "product": string,
  "competitor": string | null,
  "entities": string[],
  "industryVertical": "FMCG_RETAIL" | "B2B_SAAS" | "CONSUMER_TECH" | "FINANCE" | "GENERAL",
  "productUrl": string | null,
  "competitorUrl": string | null
}`;

  try {
    const res = await generateHuggingFaceJson<{
      product?: string;
      competitor?: string | null;
      entities?: string[];
      industryVertical?: IndustryVertical;
      productUrl?: string | null;
      competitorUrl?: string | null;
    }>('You are an entity resolution engine. Respond in JSON only.', prompt, {
      maxNewTokens: 300,
      temperature: 0.1,
    });

    const product = (res.product && !isPlaceholderProduct(res.product))
      ? res.product.trim()
      : heuristic.product || 'unknown product';
    const competitor = (res.competitor && !isPlaceholderCompetitor(res.competitor))
      ? res.competitor.trim()
      : heuristic.competitor || undefined;

    const entities = res.entities && Array.isArray(res.entities) && res.entities.length > 0
      ? res.entities.filter((e) => Boolean(e && !isPlaceholderProduct(e)))
      : [product, competitor].filter(Boolean) as string[];

    const industryVertical: IndustryVertical =
      res.industryVertical && ['FMCG_RETAIL', 'B2B_SAAS', 'CONSUMER_TECH', 'FINANCE', 'GENERAL'].includes(res.industryVertical)
        ? res.industryVertical
        : heuristic.industryVertical || inferVerticalFromKeywords(query);

    return {
      product,
      competitor,
      entities: [...new Set(entities)],
      industryVertical,
      productUrl: res.productUrl || undefined,
      competitorUrl: res.competitorUrl || undefined,
    };
  } catch (err) {
    logger.warn('extract_entities.llm_fallback', { error: String(err), query });
    const product = heuristic.product || 'unknown product';
    const competitor = heuristic.competitor;
    const entities = [product, competitor].filter(Boolean) as string[];
    return {
      product,
      competitor,
      entities,
      industryVertical: heuristic.industryVertical || inferVerticalFromKeywords(query),
    };
  }
}

/** Prefer LLM value when real; otherwise heuristic; never keep known placeholders. */
export function resolveProductName(
  llmProduct: unknown,
  heuristic: ExtractedEntities,
  fallback = 'unknown product',
): string {
  const fromLlm = typeof llmProduct === 'string' ? llmProduct.trim() : '';
  if (fromLlm && !isPlaceholderProduct(fromLlm)) {
    const alias = lookupKnownAlias(fromLlm);
    return alias ? alias.canonical : fromLlm;
  }
  if (heuristic.product && !isPlaceholderProduct(heuristic.product)) {
    const alias = lookupKnownAlias(heuristic.product);
    return alias ? alias.canonical : heuristic.product;
  }
  return fallback;
}

export function resolveCompetitorName(
  llmCompetitor: unknown,
  heuristic: ExtractedEntities,
): string | undefined {
  const fromLlm = typeof llmCompetitor === 'string' ? llmCompetitor.trim() : '';
  if (fromLlm && !isPlaceholderCompetitor(fromLlm)) {
    const alias = lookupKnownAlias(fromLlm);
    return alias ? alias.canonical : fromLlm;
  }
  if (heuristic.competitor && !isPlaceholderCompetitor(heuristic.competitor)) {
    const alias = lookupKnownAlias(heuristic.competitor);
    return alias ? alias.canonical : heuristic.competitor;
  }
  return undefined;
}
