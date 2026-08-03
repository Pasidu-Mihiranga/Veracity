/**
 * Pricing-page extraction.
 *
 * Answers the highest-value recurring question in the research: "did a
 * competitor change pricing or packaging?" It is also the hardest of the
 * connectors to do honestly, because a pricing page is prose and a price is a
 * number — exactly the gap where a model will happily invent a plausible
 * figure.
 *
 * The defence is that nothing here trusts a model. Prices are matched with a
 * regex against the page's own text, and every extracted price keeps the
 * surrounding sentence as its excerpt, so the evidence drawer can show where
 * the number came from. A price that cannot be located in the text does not
 * exist.
 */

import type { ExtractedSpan } from '../evidence-extractor';

export interface ExtractedPrice {
  /** Plan name when one could be attributed, else null. */
  planName: string | null;
  amount: number;
  currency: string;
  /** 'month' | 'year' | 'one-time' | 'usage' */
  interval: string;
  /** The sentence the price was found in. */
  excerpt: string;
  offset: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '¥': 'JPY',
};

/**
 * A price with its currency, amount, and (optionally) its billing interval.
 *
 * Deliberately does not match a bare number: "49" on a pricing page could be a
 * seat count, a percentage, or a feature limit. A currency marker is the
 * cheapest reliable signal that a number is money.
 */
const PRICE_PATTERN =
  /([$£€¥])\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:\/\s*|per\s+)?(mo|month|monthly|yr|year|annually|annual|user|seat)?/gi;

/** Words that mark a number as something other than a price. */
const DISQUALIFIERS = /\b(save|discount|off|was|instead of|value|worth|credit)\b/i;

function normalizeInterval(raw: string | undefined, sentence: string): string {
  const token = (raw ?? '').toLowerCase();
  if (/^(mo|month|monthly)$/.test(token)) return 'month';
  if (/^(yr|year|annual|annually)$/.test(token)) return 'year';

  // The interval is often stated in the sentence rather than beside the number.
  if (/\b(per month|\/month|monthly|a month)\b/i.test(sentence)) return 'month';
  if (/\b(per year|\/year|annually|a year|per annum)\b/i.test(sentence)) return 'year';
  if (/\b(one[- ]time|once|lifetime)\b/i.test(sentence)) return 'one-time';
  if (/\b(per|\/)\s*(request|token|credit|call|GB|seat|user)\b/i.test(sentence)) return 'usage';

  return 'unspecified';
}

/** Split text into sentences, keeping each sentence's offset. */
function sentencesWithOffsets(text: string): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = [];
  const pattern = /[^.!?\n]+[.!?\n]?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed.length > 0) out.push({ text: trimmed, offset: match.index });
  }
  return out;
}

/**
 * Attribute a price to a plan name.
 *
 * Looks backwards through the sentence and the preceding one for a capitalised
 * word near a plan-ish noun. Returns null when nothing convincing is found,
 * because a wrong plan name is worse than no plan name: it silently attaches a
 * price to the wrong tier.
 */
function attributePlan(sentence: string, previous: string | null): string | null {
  const PLAN_HINT = /\b(free|starter|basic|standard|pro|professional|team|business|growth|premium|plus|enterprise|scale)\b/i;

  for (const candidate of [sentence, previous ?? '']) {
    const match = candidate.match(PLAN_HINT);
    if (match) {
      return match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
    }
  }
  return null;
}

/**
 * Extract prices from normalized page text.
 *
 * Every returned price is present in the input; none is inferred.
 */
export function extractPrices(normalizedContent: string): ExtractedPrice[] {
  const sentences = sentencesWithOffsets(normalizedContent);
  const prices: ExtractedPrice[] = [];
  const seen = new Set<string>();

  sentences.forEach((sentence, index) => {
    // A crossed-out "was $99" is not the current price.
    if (DISQUALIFIERS.test(sentence.text)) return;

    PRICE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = PRICE_PATTERN.exec(sentence.text)) !== null) {
      const [, symbol, rawAmount, rawInterval] = match;
      const amount = Number.parseFloat(rawAmount.replace(/,/g, ''));
      if (!Number.isFinite(amount)) continue;

      const interval = normalizeInterval(rawInterval, sentence.text);
      const planName = attributePlan(sentence.text, index > 0 ? sentences[index - 1].text : null);

      // One price per (plan, amount, interval). A page that repeats its pricing
      // in a table and a summary should not produce two observations.
      const key = `${planName ?? ''}|${amount}|${interval}`;
      if (seen.has(key)) continue;
      seen.add(key);

      prices.push({
        planName,
        amount,
        currency: CURRENCY_SYMBOLS[symbol] ?? 'USD',
        interval,
        excerpt: sentence.text,
        offset: sentence.offset,
      });
    }
  });

  return prices;
}

/**
 * Convert extracted prices into evidence spans with observations.
 *
 * The metric key includes the plan so two tiers do not collapse into one
 * series — "$49 → $299" is not a price rise, it is the Team and Enterprise
 * tiers being compared to each other.
 */
export function pricesToSpans(prices: ExtractedPrice[], entityLabel: string): ExtractedSpan[] {
  return prices.map((price) => {
    const planLabel = price.planName ?? 'unattributed plan';
    const unit = `${price.currency}/${price.interval}`;

    return {
      excerpt: price.excerpt,
      startOffset: price.offset,
      endOffset: price.offset + price.excerpt.length,
      extractionType: 'price',
      // The page belongs to the entity, but the plan attribution is a heuristic,
      // so an unattributed price is marked probable rather than confirmed.
      entityMatch: price.planName ? 'confirmed' : 'probable',
      statement: `${entityLabel} lists ${planLabel} at ${price.amount} ${unit}`,
      metric: {
        key: price.planName ? `plan_price:${price.planName.toLowerCase()}` : 'plan_price',
        value: price.amount,
        unit,
        periodStart: null,
        periodEnd: null,
        isEstimated: false,
      },
    } satisfies ExtractedSpan;
  });
}
