/**
 * Connector tests.
 *
 * These cover the transformations that decide whether a chart tells the truth:
 * zero-release months surviving into the series, restated SEC periods not being
 * double counted, and throttling not being reported as absence.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseRepo,
  fetchReleases,
  releasesToMonthlyCounts,
  releasesToSpans,
  type GitHubRelease,
} from '@/lib/intelligence/connectors/github-releases';
import {
  normalizeCik,
  dedupeRestatements,
  annualOnly,
  factsToSpans,
  type SecFact,
} from '@/lib/intelligence/connectors/sec-edgar';
import { setResolver } from '@/lib/net/outbound-policy';

afterEach(() => {
  vi.unstubAllGlobals();
  setResolver(null);
});

// ── GitHub ──────────────────────────────────────────────────────────────────

describe('repository parsing', () => {
  it('accepts the forms a user is likely to paste', () => {
    for (const input of [
      'vercel/next.js',
      'https://github.com/vercel/next.js',
      'https://github.com/vercel/next.js.git',
      'git@github.com:vercel/next.js.git',
      'https://github.com/vercel/next.js/releases',
    ]) {
      expect(parseRepo(input), input).toEqual({ owner: 'vercel', repo: 'next.js' });
    }
  });

  it('rejects things that are not repositories', () => {
    expect(parseRepo('https://example.com/pricing')).toBeNull();
    expect(parseRepo('just some text')).toBeNull();
  });
});

describe('release fetching', () => {
  function stubJson(body: unknown, status = 200) {
    setResolver(async () => [{ address: '140.82.121.6', family: 4 }]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  }

  it('returns published releases and drops drafts', async () => {
    stubJson([
      { tag_name: 'v2.0', name: 'Two', published_at: '2026-03-04T00:00:00Z', html_url: 'u1', draft: false },
      { tag_name: 'v1.9', name: 'Draft', published_at: '2026-03-01T00:00:00Z', html_url: 'u2', draft: true },
      { tag_name: 'v1.8', name: 'Beta', published_at: '2026-01-09T00:00:00Z', html_url: 'u3', prerelease: true },
    ]);

    const result = await fetchReleases('acme/widget');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.map((r) => r.tag)).toEqual(['v2.0', 'v1.8']);
      expect(result.data[1].isPrerelease).toBe(true);
    }
  });

  it('reports throttling distinctly from absence', async () => {
    // "No releases" and "we were rate limited" look identical in a chart but
    // mean opposite things about a competitor.
    stubJson({}, 403);
    const result = await fetchReleases('acme/widget');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('rate limit');
  });

  it('reports a missing repository distinctly', async () => {
    stubJson({}, 404);
    const result = await fetchReleases('acme/ghost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('not found');
  });

  it('rejects a non-repository without making a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await fetchReleases('https://example.com');
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('monthly release bucketing', () => {
  const release = (publishedAt: string, name: string, isPrerelease = false): GitHubRelease => ({
    tag: name, name, publishedAt, url: 'https://example.com', isPrerelease,
  });

  it('emits zero-release months rather than skipping them', () => {
    // A quiet month is a real finding about cadence. Skipping it lets the chart
    // imply steady shipping.
    const buckets = releasesToMonthlyCounts([
      release('2026-01-10T00:00:00.000Z', 'a'),
      release('2026-04-02T00:00:00.000Z', 'b'),
    ]);
    expect(buckets.map((b) => b.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 0, 1]);
  });

  it('crosses a year boundary correctly', () => {
    const buckets = releasesToMonthlyCounts([
      release('2025-11-10T00:00:00.000Z', 'a'),
      release('2026-02-02T00:00:00.000Z', 'b'),
    ]);
    expect(buckets.map((b) => b.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('excludes prereleases by default and includes them on request', () => {
    const releases = [
      release('2026-01-10T00:00:00.000Z', 'stable'),
      release('2026-01-20T00:00:00.000Z', 'beta', true),
    ];
    expect(releasesToMonthlyCounts(releases)[0].count).toBe(1);
    expect(releasesToMonthlyCounts(releases, { includePrereleases: true })[0].count).toBe(2);
  });

  it('returns nothing when there is nothing to count', () => {
    expect(releasesToMonthlyCounts([])).toEqual([]);
  });

  it('produces spans whose excerpt names the actual releases', () => {
    const buckets = releasesToMonthlyCounts([
      release('2026-01-10T00:00:00.000Z', 'v1.0'),
      release('2026-01-25T00:00:00.000Z', 'v1.1'),
      release('2026-03-01T00:00:00.000Z', 'v1.2'),
    ]);
    const spans = releasesToSpans(buckets, 'acme/widget');

    expect(spans[0].excerpt).toContain('v1.0');
    expect(spans[0].excerpt).toContain('v1.1');
    expect(spans[0].metric?.value).toBe(2);
    expect(spans[0].metric?.unit).toBe('releases');
    expect(spans[0].entityMatch).toBe('confirmed');

    // The empty month still carries an excerpt, so the zero is explainable.
    expect(spans[1].metric?.value).toBe(0);
    expect(spans[1].excerpt).toContain('no releases');

    // Every span carries a metric, so all of them can back a chart row.
    expect(spans.every((s) => s.metric !== null)).toBe(true);
    expect(spans.every((s) => s.metric?.isEstimated === false)).toBe(true);
  });
});

// ── SEC EDGAR ───────────────────────────────────────────────────────────────

describe('CIK normalisation', () => {
  it('pads to ten digits', () => {
    expect(normalizeCik(320193)).toBe('0000320193');
    expect(normalizeCik('CIK0000320193')).toBe('0000320193');
    expect(normalizeCik('320193')).toBe('0000320193');
  });
});

describe('restatement handling', () => {
  const fact = (over: Partial<SecFact>): SecFact => ({
    concept: 'Revenues', value: 100, unit: 'USD', start: '2026-01-01', end: '2026-03-31',
    fiscalYear: 2026, fiscalPeriod: 'Q1', form: '10-Q', filedAt: '2026-04-15', accession: 'a1',
    ...over,
  });

  it('keeps only the latest filing for a restated period', () => {
    // Counting an amended quarter twice looks exactly like a real swing.
    const deduped = dedupeRestatements([
      fact({ value: 100, filedAt: '2026-04-15', accession: 'original' }),
      fact({ value: 108, filedAt: '2026-07-20', accession: 'amended' }),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].value).toBe(108);
    expect(deduped[0].accession).toBe('amended');
  });

  it('treats different units as different series', () => {
    const deduped = dedupeRestatements([
      fact({ unit: 'USD', value: 100 }),
      fact({ unit: 'shares', value: 5000 }),
    ]);
    expect(deduped).toHaveLength(2);
  });

  it('sorts by period end', () => {
    const deduped = dedupeRestatements([
      fact({ start: '2026-04-01', end: '2026-06-30' }),
      fact({ start: '2026-01-01', end: '2026-03-31' }),
    ]);
    expect(deduped.map((f) => f.end)).toEqual(['2026-03-31', '2026-06-30']);
  });

  it('keeps only full-year 10-K figures when filtering to annual', () => {
    const facts = [
      fact({ form: '10-K', start: '2025-01-01', end: '2025-12-31' }),
      fact({ form: '10-Q', start: '2026-01-01', end: '2026-03-31' }),
      fact({ form: '10-K', start: '2026-01-01', end: '2026-03-31' }), // partial period
      fact({ form: '10-K', start: null, end: '2025-12-31' }), // balance-sheet figure
    ];
    const annual = annualOnly(facts);
    expect(annual).toHaveLength(2);
  });
});

describe('SEC fact spans', () => {
  it('builds an excerpt a reader can verify in EDGAR', () => {
    const spans = factsToSpans(
      [
        {
          concept: 'Revenues', value: 1234000, unit: 'USD',
          start: '2025-01-01', end: '2025-12-31', fiscalYear: 2025, fiscalPeriod: 'FY',
          form: '10-K', filedAt: '2026-02-10', accession: '0000320193-26-000010',
        },
      ],
      'Example Corp',
    );

    expect(spans).toHaveLength(1);
    expect(spans[0].excerpt).toContain('0000320193-26-000010');
    expect(spans[0].excerpt).toContain('10-K');
    expect(spans[0].metric?.value).toBe(1234000);
    expect(spans[0].metric?.unit).toBe('USD');
    expect(spans[0].metric?.isEstimated).toBe(false);
    expect(spans[0].entityMatch).toBe('confirmed');
  });
});
