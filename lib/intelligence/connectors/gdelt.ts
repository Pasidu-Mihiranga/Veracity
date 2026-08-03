/**
 * GDELT news-volume connector.
 *
 * Free, keyless, and global. It answers one narrow question honestly: how often
 * is this entity being written about, in a *fixed* query against a *fixed*
 * corpus, over time.
 *
 * The caveats are the entire point and travel with every chart it feeds:
 *
 *  - This measures **media attention**, not market share, sentiment, or growth.
 *    A spike can mean a launch, a lawsuit, or one wire story syndicated fifty
 *    times.
 *  - The denominator is unknown. GDELT's corpus changes as it adds and drops
 *    outlets, so a rising count can reflect better coverage rather than more
 *    news. Counts are only comparable to each other within one query.
 *  - A company name that is also a common word is unusable. "Block" or "Apple"
 *    return everything, and no amount of downstream care fixes that.
 *
 * Because of the last two, this is `derived`, never `measured`. The number is
 * real, but what it measures is not a property of the market.
 */

import { safeFetch } from '@/lib/net/outbound-policy';
import type { ExtractedSpan } from '../evidence-extractor';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

export interface VolumePoint {
  date: string;
  count: number;
}

export type GdeltResult =
  | { ok: true; points: VolumePoint[]; query: string; sourceUrl: string; retrievedAt: string }
  | { ok: false; reason: string; query: string };

/** Names too generic to produce a usable signal. */
const AMBIGUOUS_NAMES = new Set([
  'apple', 'block', 'square', 'stripe', 'meta', 'oracle', 'amazon', 'shell',
  'orange', 'sun', 'gap', 'target', 'visa', 'discover', 'monday', 'notion',
]);

/**
 * Is this entity name specific enough to query?
 *
 * Refusing up front is better than returning a series that silently counts
 * unrelated articles. A user told "Apple is too generic to track by name" can
 * supply a domain instead; a user shown a meaningless line cannot.
 */
export function isQueryable(entityName: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = entityName.trim();

  if (trimmed.length < 3) {
    return { ok: false, reason: 'the name is too short to query news coverage reliably' };
  }

  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length === 1 && AMBIGUOUS_NAMES.has(words[0])) {
    return {
      ok: false,
      reason: `"${trimmed}" is also a common word, so news volume for it would count unrelated articles`,
    };
  }

  return { ok: true };
}

/** Quoted phrase query, so multi-word names are not split into separate terms. */
export function buildQuery(entityName: string): string {
  const trimmed = entityName.trim();
  return trimmed.includes(' ') ? `"${trimmed}"` : trimmed;
}

/**
 * Daily article volume over a window.
 *
 * `timespan` is passed through to GDELT (e.g. `3months`). Days with no coverage
 * come back as zero rather than being omitted — a quiet week is a real
 * observation about attention, and dropping it would let a chart imply
 * continuous coverage.
 */
export async function fetchNewsVolume(params: {
  entityName: string;
  timespan?: string;
}): Promise<GdeltResult> {
  const queryable = isQueryable(params.entityName);
  const query = buildQuery(params.entityName);

  if (!queryable.ok) return { ok: false, reason: queryable.reason, query };

  const url = new URL(GDELT_DOC_API);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'timelinevol');
  url.searchParams.set('format', 'json');
  url.searchParams.set('timespan', params.timespan ?? '3months');

  try {
    const response = await safeFetch(url.toString(), {
      headers: { 'User-Agent': 'veracity-market-intelligence' },
      timeoutMs: 20_000,
    });

    if (!response.ok) {
      return { ok: false, reason: `GDELT returned ${response.status}`, query };
    }

    const text = await response.text();

    // GDELT answers a bad query with an HTML error page and a 200 status, so
    // the content type cannot be trusted and the parse has to be defensive.
    let body: { timeline?: Array<{ series?: string; data?: Array<{ date: string; value: number }> }> };
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'GDELT returned a non-JSON response for this query', query };
    }

    const series = body.timeline?.[0]?.data;
    if (!Array.isArray(series) || series.length === 0) {
      return { ok: false, reason: 'GDELT returned no coverage for this query', query };
    }

    const points: VolumePoint[] = series
      .filter((point) => typeof point?.value === 'number' && typeof point?.date === 'string')
      .map((point) => ({
        // GDELT dates arrive as YYYYMMDDTHHMMSSZ.
        date: point.date.slice(0, 4) + '-' + point.date.slice(4, 6) + '-' + point.date.slice(6, 8),
        count: point.value,
      }));

    if (points.length === 0) {
      return { ok: false, reason: 'GDELT returned an unparseable timeline', query };
    }

    return {
      ok: true,
      points,
      query,
      sourceUrl: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=timelinevol`,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), query };
  }
}

/**
 * Convert volume points into evidence spans.
 *
 * The excerpt states the query and the caveat, so the drawer explains what the
 * number is rather than just showing it. `isEstimated` is true because the
 * corpus denominator is unknown — the count is exact for GDELT's index, and
 * GDELT's index is not the news.
 */
export function volumeToSpans(
  points: VolumePoint[],
  entityName: string,
  query: string,
): ExtractedSpan[] {
  return points.map((point) => {
    const excerpt =
      `GDELT indexed ${point.count} article(s) matching ${query} on ${point.date}. ` +
      'This measures coverage within GDELT’s corpus, not market share or sentiment, ' +
      'and the corpus changes over time.';

    return {
      excerpt,
      startOffset: 0,
      endOffset: excerpt.length,
      extractionType: 'metric',
      // The query was constructed from the entity name, but a name match in a
      // news corpus is not proof the article is about this company.
      entityMatch: 'probable',
      statement: `${entityName} appeared in ${point.count} indexed article(s) on ${point.date}`,
      metric: {
        key: 'news_volume',
        value: point.count,
        unit: 'articles',
        periodStart: `${point.date}T00:00:00.000Z`,
        periodEnd: null,
        // Exact within the corpus, unknown against the world.
        isEstimated: true,
      },
    } satisfies ExtractedSpan;
  });
}

/** Limitations to attach to any chart built from this connector. */
export const GDELT_LIMITATIONS = [
  'Counts articles in GDELT’s index, not all news. The corpus changes over time, so counts are comparable within this series only.',
  'Measures media attention, not market share, sentiment, or growth.',
  'A spike may be one story syndicated widely rather than many independent events.',
  'Name matching is approximate; unrelated articles mentioning the same name are included.',
];
