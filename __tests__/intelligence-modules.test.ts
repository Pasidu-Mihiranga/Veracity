/**
 * Contract tests for the evidence-ledger logic modules: snapshot
 * canonicalisation/normalisation/hashing, claim verification, and deterministic
 * chart planning.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeUrl,
  normalizeContent,
  contentHash,
  prepareSnapshot,
  isUnchanged,
  locateSpan,
} from '@/lib/intelligence/snapshot-store';
import {
  containsNumericClaim,
  extractNumbers,
  verifyClaim,
  verifyClaims,
  deriveConfidence,
  type VerificationContext,
} from '@/lib/intelligence/claim-verifier';
import { planMetricChart, planEvidenceCoverageChart } from '@/lib/intelligence/chart-planner';
import type { Claim, EvidenceSpan, MetricObservation } from '@/lib/intelligence/types';

// ── Snapshot store ──────────────────────────────────────────────────────────

describe('URL canonicalisation', () => {
  it('collapses the many URLs that name one page into one identity', () => {
    const variants = [
      'https://Example.com/Pricing',
      'https://www.example.com/Pricing',
      'https://example.com/Pricing/',
      'https://example.com/Pricing#plans',
      'https://example.com/Pricing?utm_source=newsletter&utm_medium=email',
      'https://example.com:443/Pricing',
    ];
    const canonical = variants.map((v) => canonicalizeUrl(v));
    expect(new Set(canonical).size).toBe(1);
    expect(canonical[0]).toBe('https://example.com/Pricing');
  });

  it('keeps query parameters that change what the page says', () => {
    // ?plan=team is a different page; ?utm_source is the same page.
    expect(canonicalizeUrl('https://example.com/pricing?plan=team')).toBe(
      'https://example.com/pricing?plan=team',
    );
  });

  it('sorts remaining parameters so order cannot fork the identity', () => {
    expect(canonicalizeUrl('https://example.com/p?b=2&a=1')).toBe(
      canonicalizeUrl('https://example.com/p?a=1&b=2'),
    );
  });

  it('preserves the root slash', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('rejects non-http(s) and malformed input', () => {
    expect(canonicalizeUrl('file:///etc/passwd')).toBeNull();
    expect(canonicalizeUrl('not a url')).toBeNull();
  });
});

describe('content normalisation and hashing', () => {
  it('produces the same hash when only volatile fragments differ', () => {
    // Otherwise every scheduled run reports a change and the digest is noise.
    const a = normalizeContent('Plans start at $49.\nGenerated 2026-08-01T10:00:00Z\n© 2026 Example');
    const b = normalizeContent('Plans start at $49.\nGenerated 2026-08-02T11:30:45Z\n© 2027 Example');
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('produces a different hash when the substance changes', () => {
    const a = normalizeContent('Plans start at $49.');
    const b = normalizeContent('Plans start at $59.');
    expect(contentHash(a)).not.toBe(contentHash(b));
  });

  it('ignores whitespace and line-ending differences', () => {
    expect(normalizeContent('Plans   start\r\n at  $49.')).toBe(
      normalizeContent('Plans start\n at $49.'),
    );
  });

  it('masks cache-busting asset hashes', () => {
    const a = normalizeContent('<script src="app.a1b2c3d4e5.js">');
    const b = normalizeContent('<script src="app.99887766ff.js">');
    expect(contentHash(a)).toBe(contentHash(b));
  });
});

describe('snapshot preparation', () => {
  it('prepares a usable snapshot', () => {
    const result = prepareSnapshot({
      url: 'https://www.example.com/pricing/?utm_source=x',
      title: '  Pricing  ',
      content: 'Team plan is $49 per month.',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.canonicalUrl).toBe('https://example.com/pricing');
      expect(result.snapshot.title).toBe('Pricing');
      expect(result.snapshot.contentHash).toHaveLength(64);
      expect(result.snapshot.byteLength).toBeGreaterThan(0);
    }
  });

  it('refuses to store an empty snapshot', () => {
    // A failed fetch stored as an empty page reads as a change when the real
    // content comes back, which would fire a false alert.
    const result = prepareSnapshot({ url: 'https://example.com/p', content: '   \n\n ' });
    expect(result).toEqual({ ok: false, reason: 'empty-content' });
  });

  it('refuses an invalid URL', () => {
    expect(prepareSnapshot({ url: 'nope', content: 'text' })).toEqual({
      ok: false,
      reason: 'invalid-url',
    });
  });

  it('detects an unchanged re-fetch', () => {
    const first = prepareSnapshot({ url: 'https://example.com/p', content: 'Same text' });
    const second = prepareSnapshot({ url: 'https://example.com/p', content: 'Same  text' });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(isUnchanged(first.snapshot.contentHash, second.snapshot)).toBe(true);
      expect(isUnchanged(null, second.snapshot)).toBe(false);
    }
  });
});

describe('span location', () => {
  const content = normalizeContent('Our Team plan is $49 per month.\nEnterprise is custom.');

  it('locates an exact excerpt', () => {
    const span = locateSpan(content, 'Team plan is $49 per month');
    expect(span).not.toBeNull();
    expect(content.slice(span!.startOffset, span!.endOffset)).toBe('Team plan is $49 per month');
  });

  it('tolerates re-wrapped whitespace', () => {
    expect(locateSpan(content, 'Team   plan\nis $49')).not.toBeNull();
  });

  it('returns null for an excerpt that is not present', () => {
    // The caller needs to detect an extractor quoting text that does not exist.
    expect(locateSpan(content, 'Team plan is $99 per month')).toBeNull();
  });
});

// ── Claim verifier ──────────────────────────────────────────────────────────

describe('numeric claim detection', () => {
  it('detects quantitative assertions', () => {
    for (const s of [
      'Revenue grew 20%',
      'Entry tier costs $49',
      'They raised 12 million',
      'Usage is up 3x',
      'Headcount increased by 40',
    ]) {
      expect(containsNumericClaim(s), s).toBe(true);
    }
  });

  it('leaves qualitative statements alone', () => {
    for (const s of [
      'They repositioned toward enterprise buyers',
      'Reviewers mention onboarding friction',
    ]) {
      expect(containsNumericClaim(s), s).toBe(false);
    }
  });

  it('extracts the asserted numbers', () => {
    expect(extractNumbers('Price moved from 49 to 59')).toEqual([49, 59]);
    expect(extractNumbers('They raised 1,250 seats')).toEqual([1250]);
  });
});

describe('claim verification', () => {
  const span = (over: Partial<EvidenceSpan> = {}): EvidenceSpan => ({
    id: 'span-1',
    snapshotId: 'snap-1',
    excerpt: 'Team plan is $59 per month',
    extractionType: 'price',
    entityMatch: 'confirmed',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }) as EvidenceSpan;

  const observation = (over: Partial<MetricObservation> = {}): MetricObservation => ({
    id: 'm1',
    evidenceSpanId: 'span-1',
    metricKey: 'plan_price',
    value: 59,
    unit: 'USD/month',
    method: 'extracted',
    isEstimated: false,
    observedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }) as MetricObservation;

  const claim = (over: Partial<Claim> = {}): Claim => ({
    id: 'c1',
    statement: 'The team plan costs $59 per month',
    claimType: 'fact',
    confidence: 'medium',
    supportingSpanIds: ['span-1'],
    contradictingSpanIds: [],
    ...over,
  }) as Claim;

  function ctx(over: Partial<VerificationContext> = {}): VerificationContext {
    return {
      spans: new Map([['span-1', span()]]),
      observationsBySpan: new Map([['span-1', [observation()]]]),
      ...over,
    };
  }

  it('accepts a numeric claim backed by a matching observation', () => {
    const result = verifyClaim(claim(), ctx());
    expect(result.ok).toBe(true);
  });

  it('rejects a numeric claim with no observation behind it', () => {
    const result = verifyClaim(claim(), ctx({ observationsBySpan: new Map() }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.map((r) => r.code)).toContain('unsupported-numeric-claim');
    }
  });

  it('rejects a claim whose number does not match the observation', () => {
    // Citing a real observation of a different figure is the subtle failure
    // that a "has a source" check would wave through.
    const result = verifyClaim(
      claim({ statement: 'The team plan costs $199 per month' }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.map((r) => r.code)).toContain('excerpt-does-not-support');
    }
  });

  it('rejects a fact with no evidence', () => {
    const result = verifyClaim(claim({ supportingSpanIds: [] }), ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.map((r) => r.code)).toContain('fact-without-evidence');
    }
  });

  it('rejects a claim citing a span that does not exist', () => {
    const result = verifyClaim(claim({ supportingSpanIds: ['ghost'] }), ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.map((r) => r.code)).toContain('evidence-span-missing');
    }
  });

  it('rejects evidence matched to a different entity', () => {
    const result = verifyClaim(
      claim(),
      ctx({ spans: new Map([['span-1', span({ entityMatch: 'mismatch' })]]) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.map((r) => r.code)).toContain('entity-mismatch');
    }
  });

  it('flags contradiction without rejecting the claim', () => {
    // Disagreement is information. Silently choosing a winner is not.
    const result = verifyClaim(claim({ contradictingSpanIds: ['span-2'] }), ctx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contradicted).toBe(true);
  });

  it('reports every reason a claim failed, not just the first', () => {
    const result = verifyClaim(
      claim({ statement: 'Price is $999', supportingSpanIds: ['ghost'] }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejections.length).toBeGreaterThan(1);
  });

  it('partitions a batch into verified, contradicted, and rejected', () => {
    const batch = [
      claim({ id: 'ok' }),
      claim({ id: 'bad', statement: 'Price is $1' }),
      claim({ id: 'disputed', contradictingSpanIds: ['span-9'] }),
    ];
    const result = verifyClaims(batch, ctx());
    expect(result.verified.map((c) => c.id)).toEqual(['ok', 'disputed']);
    expect(result.contradicted.map((c) => c.id)).toEqual(['disputed']);
    expect(result.rejected.map((r) => r.claim.id)).toEqual(['bad']);
  });
});

describe('derived confidence', () => {
  it('never returns high on a single source', () => {
    expect(deriveConfidence({ supportingCount: 1, contradictingCount: 0, allEntityMatchesConfirmed: true }))
      .toBe('medium');
  });

  it('drops to low whenever a source contradicts', () => {
    expect(deriveConfidence({ supportingCount: 5, contradictingCount: 1, allEntityMatchesConfirmed: true }))
      .toBe('low');
  });

  it('requires confirmed entity matches for high', () => {
    expect(deriveConfidence({ supportingCount: 3, contradictingCount: 0, allEntityMatchesConfirmed: true }))
      .toBe('high');
    expect(deriveConfidence({ supportingCount: 3, contradictingCount: 0, allEntityMatchesConfirmed: false }))
      .toBe('medium');
  });
});

// ── Chart planner ───────────────────────────────────────────────────────────

describe('chart planning', () => {
  const obs = (over: Partial<MetricObservation>): MetricObservation => ({
    id: `m-${Math.random()}`,
    evidenceSpanId: 'span-1',
    metricKey: 'plan_price',
    value: 49,
    unit: 'USD/month',
    method: 'extracted',
    isEstimated: false,
    observedAt: '2026-01-01T00:00:00.000Z',
    periodStart: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as MetricObservation;

  const base = {
    id: 'chart-1',
    metricKey: 'plan_price',
    title: 'Entry-tier price',
    questionAnswered: 'Has the entry-tier price changed?',
    metricDefinition: 'Advertised monthly price of the lowest paid tier',
    sourceIds: ['src-1'],
  };

  it('builds a line chart from a series of observations', () => {
    const result = planMetricChart({
      ...base,
      observations: [
        obs({ periodStart: '2026-01-01T00:00:00.000Z', value: 49 }),
        obs({ periodStart: '2026-02-01T00:00:00.000Z', value: 49 }),
        obs({ periodStart: '2026-03-01T00:00:00.000Z', value: 59 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.kind).toBe('line');
      expect(result.spec.dataClass).toBe('measured');
      expect(result.spec.rows).toHaveLength(3);
      expect(result.spec.formula).toContain('No smoothing');
      expect(result.spec.sampleSize).toBe(3);
    }
  });

  it('refuses to draw a trend line through too few points', () => {
    const result = planMetricChart({
      ...base,
      observations: [
        obs({ periodStart: '2026-01-01T00:00:00.000Z', value: 49 }),
        obs({ periodStart: '2026-02-01T00:00:00.000Z', value: 59 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Downgraded to bars, and it says why.
      expect(result.spec.kind).toBe('bar');
      expect(result.spec.limitations.join(' ')).toContain('too few to establish a trend');
    }
  });

  it('refuses to mix incompatible units on one axis', () => {
    const result = planMetricChart({
      ...base,
      observations: [
        obs({ unit: 'USD/month', periodStart: '2026-01-01T00:00:00.000Z' }),
        obs({ unit: 'EUR/year', periodStart: '2026-02-01T00:00:00.000Z' }),
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(' ')).toContain('incompatible units');
  });

  it('refuses observations with no evidence span', () => {
    const result = planMetricChart({
      ...base,
      observations: [
        obs({ periodStart: '2026-01-01T00:00:00.000Z' }),
        obs({ evidenceSpanId: '', periodStart: '2026-02-01T00:00:00.000Z' }),
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(' ')).toContain('no evidence span');
  });

  it('returns a reason rather than an empty chart when nothing was observed', () => {
    const result = planMetricChart({ ...base, observations: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons[0]).toContain('no observations');
  });

  it('leaves a missing period as a null gap, not a zero', () => {
    const result = planMetricChart({
      ...base,
      entityLabels: { 'ent-a': 'Us', 'ent-b': 'Them' },
      observations: [
        obs({ entityId: 'ent-a', periodStart: '2026-01-01T00:00:00.000Z', value: 49 }),
        obs({ entityId: 'ent-b', periodStart: '2026-01-01T00:00:00.000Z', value: 39 }),
        obs({ entityId: 'ent-a', periodStart: '2026-02-01T00:00:00.000Z', value: 49 }),
        // ent-b has no February observation.
        obs({ entityId: 'ent-a', periodStart: '2026-03-01T00:00:00.000Z', value: 59 }),
        obs({ entityId: 'ent-b', periodStart: '2026-03-01T00:00:00.000Z', value: 39 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const february = result.spec.rows.find((r) => r.period === '2026-02');
      expect(february?.['ent-b']).toBeNull();
      expect(february?.['ent-b']).not.toBe(0);
    }
  });

  it('labels estimated values and says so in the limitations', () => {
    const result = planMetricChart({
      ...base,
      observations: [
        obs({ periodStart: '2026-01-01T00:00:00.000Z', isEstimated: true }),
        obs({ periodStart: '2026-02-01T00:00:00.000Z' }),
        obs({ periodStart: '2026-03-01T00:00:00.000Z' }),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.isEstimated).toBe(true);
      expect(result.spec.limitations.join(' ')).toContain('estimates');
    }
  });

  it('is deterministic for the same observations', () => {
    const observations = [
      obs({ periodStart: '2026-01-01T00:00:00.000Z', value: 49 }),
      obs({ periodStart: '2026-02-01T00:00:00.000Z', value: 59 }),
      obs({ periodStart: '2026-03-01T00:00:00.000Z', value: 69 }),
    ];
    const a = planMetricChart({ ...base, observations });
    const b = planMetricChart({ ...base, observations: [...observations].reverse() });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      // generatedAt is the only field allowed to differ between runs.
      expect(b.spec.rows).toEqual(a.spec.rows);
      expect(b.spec.formula).toEqual(a.spec.formula);
    }
  });

  it('marks evidence coverage as derived and states its formula', () => {
    const result = planEvidenceCoverageChart({ id: 'cov-1', supported: 7, unsupported: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.dataClass).toBe('derived');
      expect(result.spec.formula).toBeTruthy();
      expect(result.spec.limitations.length).toBeGreaterThan(0);
    }
  });

  it('will not compute coverage from no claims', () => {
    const result = planEvidenceCoverageChart({ id: 'cov-1', supported: 0, unsupported: 0 });
    expect(result.ok).toBe(false);
  });
});
