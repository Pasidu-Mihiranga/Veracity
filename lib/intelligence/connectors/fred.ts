/**
 * FRED macroeconomic series connector.
 *
 * Federal Reserve Economic Data: official, revised, dated series with stated
 * units. Genuinely measured — a government statistical agency published these
 * numbers, and no model touches them on the way in.
 *
 * What it is *for* matters more than what it is. A macro series tells you
 * nothing about a specific competitor. It provides the backdrop a decision sits
 * in: whether software spending is expanding while you debate a price rise,
 * whether the labour market explains a competitor's hiring slowdown.
 *
 * So this connector never attaches a series to an entity. It attaches to the
 * project, as context, and the code refuses to pretend otherwise — the most
 * likely misuse is treating a macro trend as evidence about one company.
 *
 * Requires `FRED_API_KEY` (free registration). Absent, the connector reports
 * itself unconfigured rather than failing obscurely.
 */

import { safeFetch } from '@/lib/net/outbound-policy';
import type { ExtractedSpan } from '../evidence-extractor';

const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_SERIES_API = 'https://api.stlouisfed.org/fred/series';

export interface FredObservation {
  date: string;
  value: number;
}

export interface FredSeriesMeta {
  id: string;
  title: string;
  units: string;
  frequency: string;
  lastUpdated: string;
}

export type FredResult =
  | { ok: true; meta: FredSeriesMeta; observations: FredObservation[]; sourceUrl: string; retrievedAt: string }
  | { ok: false; reason: string; seriesId: string };

/** Series worth offering for a B2B software decision, with why each is useful. */
export const SUGGESTED_SERIES: Array<{ id: string; label: string; relevance: string }> = [
  { id: 'PCU5112105112105', label: 'Software publishers PPI', relevance: 'Whether software prices are rising industry-wide, which contextualises a competitor’s price move' },
  { id: 'ICSA', label: 'Initial jobless claims', relevance: 'Labour-market slack, which contextualises hiring signals' },
  { id: 'FEDFUNDS', label: 'Federal funds rate', relevance: 'Cost of capital, which shapes buyer appetite for new spend' },
  { id: 'UMCSENT', label: 'Consumer sentiment', relevance: 'Demand backdrop for consumer-adjacent products' },
];

function apiKey(): string | null {
  return process.env.FRED_API_KEY?.trim() || null;
}

/**
 * Fetch a series with its metadata.
 *
 * Metadata is fetched alongside the observations rather than hardcoded because
 * FRED units differ per series and change on revision. A chart labelled with
 * the wrong unit is worse than an unlabelled one.
 */
export async function fetchSeries(params: {
  seriesId: string;
  observationStart?: string;
  limit?: number;
}): Promise<FredResult> {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      reason: 'FRED_API_KEY is not configured — macro context is unavailable',
      seriesId: params.seriesId,
    };
  }

  const buildUrl = (base: string, extra: Record<string, string> = {}) => {
    const url = new URL(base);
    url.searchParams.set('series_id', params.seriesId);
    url.searchParams.set('api_key', key);
    url.searchParams.set('file_type', 'json');
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    return url.toString();
  };

  try {
    const [metaRes, obsRes] = await Promise.all([
      safeFetch(buildUrl(FRED_SERIES_API), { timeoutMs: 15_000 }),
      safeFetch(
        buildUrl(FRED_API, {
          observation_start: params.observationStart ?? '2024-01-01',
          sort_order: 'asc',
          limit: String(params.limit ?? 120),
        }),
        { timeoutMs: 20_000 },
      ),
    ]);

    if (metaRes.status === 400 || obsRes.status === 400) {
      // FRED answers an unknown series with 400, which is a user-fixable
      // problem rather than an outage.
      return { ok: false, reason: `no FRED series with id "${params.seriesId}"`, seriesId: params.seriesId };
    }
    if (!metaRes.ok || !obsRes.ok) {
      return {
        ok: false,
        reason: `FRED returned ${metaRes.ok ? obsRes.status : metaRes.status}`,
        seriesId: params.seriesId,
      };
    }

    const metaBody = (await metaRes.json()) as {
      seriess?: Array<{ id: string; title: string; units: string; frequency: string; last_updated: string }>;
    };
    const series = metaBody.seriess?.[0];
    if (!series) {
      return { ok: false, reason: 'FRED returned no series metadata', seriesId: params.seriesId };
    }

    const obsBody = (await obsRes.json()) as {
      observations?: Array<{ date: string; value: string }>;
    };

    // FRED marks missing periods with ".". Those are genuinely missing, not
    // zero, and must not become data points.
    const observations: FredObservation[] = (obsBody.observations ?? [])
      .filter((o) => o.value !== '.' && o.value !== '')
      .map((o) => ({ date: o.date, value: Number.parseFloat(o.value) }))
      .filter((o) => Number.isFinite(o.value));

    if (observations.length === 0) {
      return { ok: false, reason: 'FRED returned no usable observations', seriesId: params.seriesId };
    }

    return {
      ok: true,
      meta: {
        id: series.id,
        title: series.title,
        units: series.units,
        frequency: series.frequency,
        lastUpdated: series.last_updated,
      },
      observations,
      sourceUrl: `https://fred.stlouisfed.org/series/${params.seriesId}`,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      seriesId: params.seriesId,
    };
  }
}

/**
 * Convert observations into evidence spans.
 *
 * `entityMatch` is deliberately `unverified` and the statement names the series
 * rather than any company. A macro series is context for a decision, never
 * evidence about a competitor, and mislabelling it as the latter is the most
 * likely way this connector gets misused.
 */
export function seriesToSpans(
  meta: FredSeriesMeta,
  observations: FredObservation[],
): ExtractedSpan[] {
  return observations.map((observation) => {
    const excerpt =
      `FRED series ${meta.id} (${meta.title}) recorded ${observation.value} ${meta.units} ` +
      `for ${observation.date}. Frequency: ${meta.frequency}. Last revised ${meta.lastUpdated}.`;

    return {
      excerpt,
      startOffset: 0,
      endOffset: excerpt.length,
      extractionType: 'metric',
      // Not about any tracked entity — this is macro context.
      entityMatch: 'unverified',
      statement: `${meta.title} was ${observation.value} ${meta.units} on ${observation.date}`,
      metric: {
        key: `fred:${meta.id}`,
        value: observation.value,
        unit: meta.units,
        periodStart: `${observation.date}T00:00:00.000Z`,
        periodEnd: null,
        // Published by a statistical agency, though subject to later revision.
        isEstimated: false,
      },
    } satisfies ExtractedSpan;
  });
}

/** Limitations to attach to any chart built from a FRED series. */
export const FRED_LIMITATIONS = [
  'Macroeconomic context for the decision, not evidence about any specific competitor.',
  'Official statistics are revised after publication; recent points may change.',
  'Series frequency and units differ — do not compare two series on one axis without converting.',
];
