/**
 * Structured extraction of facts, metrics, and exact spans from a snapshot.
 *
 * The model is used for what it is good at — finding the pricing line in a wall
 * of marketing copy — and trusted for nothing else. Every excerpt it returns is
 * located in the actual snapshot content before it becomes an evidence span. An
 * excerpt that is not present is a quote the model invented, and it is dropped.
 *
 * The extractor also never fills a missing number. If a page states a plan name
 * but no price, the result carries the fact and no observation, rather than a
 * plausible figure.
 */

import { z } from 'zod';
import { generateHuggingFaceJson } from '@/lib/agents/gemini';
import { locateSpan } from './snapshot-store';
import type { EntityMatch } from './types';

// ── Model contract ──────────────────────────────────────────────────────────

const ExtractedItem = z.object({
  /** Verbatim text copied from the page. Anything else is discarded. */
  excerpt: z.string(),
  /** What the excerpt establishes, in the extractor's words. */
  statement: z.string(),
  kind: z
    .enum(['price', 'feature', 'release', 'positioning', 'quote', 'metric', 'other'])
    .catch('other'),
  /** Present only when the excerpt states a number with a unit. */
  metric: z
    .object({
      key: z.string(),
      value: z.number().finite(),
      unit: z.string(),
      periodStart: z.string().nullable().optional(),
      periodEnd: z.string().nullable().optional(),
      isEstimated: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  /** Whether the excerpt is about the entity we asked about. */
  entityMatch: z.enum(['confirmed', 'probable', 'unverified', 'mismatch']).catch('unverified'),
});

const ExtractionResponse = z.object({
  items: z.array(ExtractedItem).default([]),
});

// ── Result types ────────────────────────────────────────────────────────────

export interface ExtractedSpan {
  excerpt: string;
  startOffset: number;
  endOffset: number;
  extractionType: 'price' | 'feature' | 'release' | 'positioning' | 'quote' | 'metric' | 'other';
  entityMatch: EntityMatch;
  statement: string;
  metric: {
    key: string;
    value: number;
    unit: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    isEstimated: boolean;
  } | null;
}

export interface ExtractionOutcome {
  spans: ExtractedSpan[];
  /** Excerpts the model returned that are not present in the snapshot. */
  hallucinatedExcerpts: string[];
  /** Metrics dropped because their unit or value was unusable. */
  droppedMetrics: string[];
  status: 'ok' | 'partial' | 'failed';
  error?: string;
}

const PROMPT = `You extract verifiable evidence from a web page.

Rules:
- Every "excerpt" MUST be copied VERBATIM from the page text. Do not paraphrase, summarise, correct, or reformat it. If you cannot copy it exactly, omit the item.
- Only include a "metric" when the excerpt itself states a number AND a unit. Never infer, estimate, convert, or complete a number that is not written on the page.
- If the page does not state something, omit it. An empty result is correct and expected.
- Set "entityMatch" to "confirmed" only when the excerpt names the target entity. Use "mismatch" when it is clearly about a different company.
- Prefer specific, checkable statements (prices, plan names, dated releases, explicit positioning claims) over marketing adjectives.`;

/**
 * Extract evidence spans from one snapshot.
 *
 * Returns `failed` with an empty span list when the model is unavailable. The
 * caller must treat that as "no evidence", never as "no changes found".
 */
export async function extractEvidence(params: {
  normalizedContent: string;
  entityName: string;
  sourceUrl: string;
  maxItems?: number;
}): Promise<ExtractionOutcome> {
  const { normalizedContent, entityName, sourceUrl, maxItems = 12 } = params;

  if (!normalizedContent.trim()) {
    return { spans: [], hallucinatedExcerpts: [], droppedMetrics: [], status: 'failed', error: 'empty snapshot content' };
  }

  let parsed: z.infer<typeof ExtractionResponse>;
  try {
    const raw = await generateHuggingFaceJson<unknown>(
      PROMPT,
      [
        `Target entity: ${entityName}`,
        `Source URL: ${sourceUrl}`,
        `Return at most ${maxItems} items as {"items":[...]}.`,
        '--- PAGE TEXT ---',
        normalizedContent.slice(0, 24_000),
      ].join('\n\n'),
      // Temperature 0: extraction is a lookup, not a creative task. Any
      // sampling here shows up as a quote that does not match the page.
      { temperature: 0 },
    );

    const validated = ExtractionResponse.safeParse(raw);
    if (!validated.success) {
      return {
        spans: [],
        hallucinatedExcerpts: [],
        droppedMetrics: [],
        status: 'failed',
        error: `extraction response did not match schema: ${validated.error.issues[0]?.message ?? 'unknown'}`,
      };
    }
    parsed = validated.data;
  } catch (err) {
    return {
      spans: [],
      hallucinatedExcerpts: [],
      droppedMetrics: [],
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const spans: ExtractedSpan[] = [];
  const hallucinatedExcerpts: string[] = [];
  const droppedMetrics: string[] = [];

  for (const item of parsed.items.slice(0, maxItems)) {
    // The check that makes this module trustworthy: an excerpt that is not in
    // the page was not read from the page.
    const located = locateSpan(normalizedContent, item.excerpt);
    if (!located) {
      hallucinatedExcerpts.push(item.excerpt);
      continue;
    }

    let metric: ExtractedSpan['metric'] = null;
    if (item.metric) {
      const { key, value, unit } = item.metric;
      const usable = Boolean(key?.trim()) && Boolean(unit?.trim()) && Number.isFinite(value);
      // A number must also actually appear in the excerpt it claims to come
      // from — otherwise the model attached a figure to unrelated text.
      const appearsInExcerpt = excerptStatesNumber(located.excerpt, value);

      if (!usable) {
        droppedMetrics.push(`${key ?? 'unknown'}: missing unit or non-finite value`);
      } else if (!appearsInExcerpt) {
        droppedMetrics.push(`${key}: value ${value} does not appear in the cited excerpt`);
      } else {
        metric = {
          key: key.trim(),
          value,
          unit: unit.trim(),
          periodStart: item.metric.periodStart ?? null,
          periodEnd: item.metric.periodEnd ?? null,
          isEstimated: item.metric.isEstimated ?? false,
        };
      }
    }

    spans.push({
      excerpt: located.excerpt,
      startOffset: located.startOffset,
      endOffset: located.endOffset,
      extractionType: item.kind,
      entityMatch: item.entityMatch,
      statement: item.statement.trim(),
      metric,
    });
  }

  const status: ExtractionOutcome['status'] =
    hallucinatedExcerpts.length > 0 || droppedMetrics.length > 0 ? 'partial' : 'ok';

  return { spans, hallucinatedExcerpts, droppedMetrics, status };
}

/**
 * Whether a number is actually written in the excerpt.
 *
 * Tolerant of thousands separators and trailing zeros ("1,250" for 1250,
 * "49.00" for 49) because those are formatting, not different values.
 */
export function excerptStatesNumber(excerpt: string, value: number): boolean {
  const numbers = (excerpt.match(/-?\d+(?:[.,]\d+)*/g) ?? []).map((raw) =>
    Number.parseFloat(raw.replace(/,(?=\d{3}\b)/g, '').replace(',', '.')),
  );
  return numbers.some((n) => Number.isFinite(n) && Math.abs(n - value) < 1e-9);
}
