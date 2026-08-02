/**
 * GDELT and FRED connectors.
 *
 * Both produce real numbers that are easy to misread, so most of what is tested
 * here is the refusal and labelling behaviour rather than the happy path: an
 * ambiguous query refused up front, a macro series never attributed to a
 * company, and missing periods never becoming zeros.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { setResolver } from '@/lib/net/outbound-policy';
import {
  isQueryable,
  buildQuery,
  fetchNewsVolume,
  volumeToSpans,
  GDELT_LIMITATIONS,
} from '@/lib/intelligence/connectors/gdelt';
import {
  fetchSeries,
  seriesToSpans,
  FRED_LIMITATIONS,
  SUGGESTED_SERIES,
} from '@/lib/intelligence/connectors/fred';

beforeEach(() => {
  setResolver(async () => [{ address: '93.184.216.34', family: 4 }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setResolver(null);
  delete process.env.FRED_API_KEY;
});

function stub(body: string, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
}

// ── GDELT ───────────────────────────────────────────────────────────────────

describe('GDELT query safety', () => {
  it('refuses a name that is also a common word', async () => {
    // A meaningless line is worse than a refusal: the user can supply a domain
    // instead, but cannot un-see a chart they believed.
    for (const name of ['Apple', 'Block', 'Target']) {
      const result = isQueryable(name);
      expect(result.ok, name).toBe(false);
      if (!result.ok) expect(result.reason).toContain('common word');
    }
  });

  it('accepts a distinctive name', () => {
    expect(isQueryable('Vector Agents').ok).toBe(true);
    expect(isQueryable('Lilian').ok).toBe(true);
  });

  it('refuses a name too short to be specific', () => {
    expect(isQueryable('AI').ok).toBe(false);
  });

  it('quotes a multi-word name so it is not split into terms', () => {
    expect(buildQuery('Vector Agents')).toBe('"Vector Agents"');
    expect(buildQuery('Lilian')).toBe('Lilian');
  });

  it('does not call the API for an unqueryable name', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await fetchNewsVolume({ entityName: 'Apple' });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('GDELT responses', () => {
  it('parses a timeline into dated points', async () => {
    stub(JSON.stringify({
      timeline: [{ data: [
        { date: '20260301T000000Z', value: 12 },
        { date: '20260302T000000Z', value: 0 },
      ] }],
    }));

    const result = await fetchNewsVolume({ entityName: 'Vector Agents' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toEqual([
        { date: '2026-03-01', count: 12 },
        // A quiet day is a real observation about attention, not missing data.
        { date: '2026-03-02', count: 0 },
      ]);
    }
  });

  it('handles an HTML error page returned with a 200', async () => {
    // GDELT answers a bad query this way, so content type cannot be trusted.
    stub('<html><body>Error</body></html>');
    const result = await fetchNewsVolume({ entityName: 'Vector Agents' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('non-JSON');
  });

  it('reports an empty timeline distinctly', async () => {
    stub(JSON.stringify({ timeline: [{ data: [] }] }));
    const result = await fetchNewsVolume({ entityName: 'Vector Agents' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('no coverage');
  });
});

describe('GDELT labelling', () => {
  const spans = volumeToSpans(
    [{ date: '2026-03-01', count: 12 }],
    'Vector Agents',
    '"Vector Agents"',
  );

  it('marks the count as estimated against the world', () => {
    // Exact within GDELT's index; the corpus denominator is unknown.
    expect(spans[0].metric?.isEstimated).toBe(true);
    expect(spans[0].metric?.unit).toBe('articles');
  });

  it('does not claim the article is definitely about this entity', () => {
    expect(spans[0].entityMatch).toBe('probable');
  });

  it('states the caveat in the excerpt itself', () => {
    expect(spans[0].excerpt).toContain('not market share or sentiment');
  });

  it('ships limitations that refuse the common misreadings', () => {
    const joined = GDELT_LIMITATIONS.join(' ');
    expect(joined).toContain('media attention');
    expect(joined).toContain('syndicated');
  });
});

// ── FRED ────────────────────────────────────────────────────────────────────

describe('FRED configuration', () => {
  it('reports itself unconfigured rather than failing obscurely', async () => {
    const result = await fetchSeries({ seriesId: 'FEDFUNDS' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('FRED_API_KEY');
  });

  it('suggests series with a stated relevance', () => {
    // A bare series id means nothing to a product marketer.
    expect(SUGGESTED_SERIES.length).toBeGreaterThan(0);
    expect(SUGGESTED_SERIES.every((s) => s.relevance.length > 20)).toBe(true);
  });
});

describe('FRED responses', () => {
  function stubPair(meta: unknown, observations: unknown) {
    process.env.FRED_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        new Response(JSON.stringify(String(url).includes('/series?') ? meta : observations), {
          status: 200,
        }),
      ),
    );
  }

  const META = {
    seriess: [{
      id: 'FEDFUNDS', title: 'Federal Funds Effective Rate', units: 'Percent',
      frequency: 'Monthly', last_updated: '2026-08-01',
    }],
  };

  it('drops FRED’s missing-value marker rather than reading it as zero', async () => {
    // "." means the period was not published. Zero would be a real rate.
    stubPair(META, {
      observations: [
        { date: '2026-01-01', value: '5.33' },
        { date: '2026-02-01', value: '.' },
        { date: '2026-03-01', value: '5.25' },
      ],
    });

    const result = await fetchSeries({ seriesId: 'FEDFUNDS' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observations).toHaveLength(2);
      expect(result.observations.map((o) => o.value)).toEqual([5.33, 5.25]);
    }
  });

  it('carries units from the series metadata rather than assuming them', async () => {
    stubPair(META, { observations: [{ date: '2026-01-01', value: '5.33' }] });
    const result = await fetchSeries({ seriesId: 'FEDFUNDS' });
    if (result.ok) expect(result.meta.units).toBe('Percent');
  });

  it('treats an unknown series as user-fixable, not an outage', async () => {
    process.env.FRED_API_KEY = 'test-key';
    // A fresh Response per call: fetchSeries issues two in parallel, and
    // safeFetch reads each body to enforce its size cap, so a shared instance
    // would leave the second read on a locked stream.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));

    const result = await fetchSeries({ seriesId: 'NOTASERIES' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('no FRED series');
  });
});

describe('FRED labelling', () => {
  const spans = seriesToSpans(
    { id: 'FEDFUNDS', title: 'Federal Funds Effective Rate', units: 'Percent', frequency: 'Monthly', lastUpdated: '2026-08-01' },
    [{ date: '2026-01-01', value: 5.33 }],
  );

  it('never attributes a macro series to a tracked entity', () => {
    // The most likely misuse: reading a macro trend as evidence about one
    // company.
    expect(spans[0].entityMatch).toBe('unverified');
    expect(spans[0].statement).not.toMatch(/competitor|Lilian|Vector/i);
  });

  it('namespaces the metric key so it cannot collide with a company metric', () => {
    expect(spans[0].metric?.key).toBe('fred:FEDFUNDS');
  });

  it('treats an official statistic as measured, not estimated', () => {
    expect(spans[0].metric?.isEstimated).toBe(false);
  });

  it('says plainly that this is context, not competitor evidence', () => {
    expect(FRED_LIMITATIONS[0]).toContain('not evidence about any specific competitor');
  });

  it('warns that official statistics get revised', () => {
    expect(FRED_LIMITATIONS.join(' ')).toContain('revised');
  });
});
