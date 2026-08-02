/**
 * Contract tests for the evidence ledger schemas.
 *
 * These lock the rules that make the ledger worth having: a number cannot exist
 * without an excerpt behind it, a fact cannot exist without supporting
 * evidence, and a chart cannot render unless its class, sources, and series can
 * all be justified.
 */

import { describe, it, expect } from 'vitest';
import {
  MetricObservation,
  EvidenceSpan,
  Claim,
  ChangeEvent,
  validateChartSpec,
  canPresentAsMeasured,
  type ChartSpec,
} from '@/lib/intelligence/types';

const NOW = '2026-08-02T00:00:00.000Z';

function baseChart(overrides: Partial<ChartSpec> = {}): unknown {
  return {
    id: 'chart-1',
    kind: 'line',
    dataClass: 'measured',
    title: 'Competitor plan price',
    questionAnswered: 'Has the competitor changed its entry-tier price?',
    metricDefinition: 'Advertised monthly price of the lowest paid tier',
    unit: 'USD/month',
    period: { start: '2026-01-01T00:00:00.000Z', end: '2026-08-01T00:00:00.000Z', cadence: 'month' },
    dimensions: ['month'],
    series: [{ key: 'price', label: 'Entry tier' }],
    rows: [
      { month: '2026-01', price: 49 },
      { month: '2026-02', price: 49 },
      { month: '2026-03', price: 59 },
    ],
    sourceIds: ['src-1'],
    evidenceSpanIds: ['span-1'],
    generatedAt: NOW,
    ...overrides,
  };
}

describe('evidence spans', () => {
  it('requires a non-empty excerpt', () => {
    const empty = EvidenceSpan.safeParse({
      id: 's1', snapshotId: 'snap-1', excerpt: '   ', createdAt: NOW,
    });
    expect(empty.success).toBe(false);
  });

  it('rejects reversed offsets', () => {
    const reversed = EvidenceSpan.safeParse({
      id: 's1', snapshotId: 'snap-1', excerpt: 'Starts at $49/month',
      startOffset: 400, endOffset: 20, createdAt: NOW,
    });
    expect(reversed.success).toBe(false);
  });

  it('defaults entity match to unverified rather than assuming a match', () => {
    const parsed = EvidenceSpan.parse({
      id: 's1', snapshotId: 'snap-1', excerpt: 'Starts at $49/month', createdAt: NOW,
    });
    expect(parsed.entityMatch).toBe('unverified');
  });
});

describe('metric observations', () => {
  const valid = {
    id: 'm1',
    evidenceSpanId: 'span-1',
    metricKey: 'plan_price',
    value: 49,
    unit: 'USD/month',
    observedAt: NOW,
  };

  it('accepts a value that cites an evidence span', () => {
    expect(MetricObservation.safeParse(valid).success).toBe(true);
  });

  it('refuses a value with no evidence span', () => {
    // The core rule. A number the model produced but no source shows must not
    // be storable, however confident the model was.
    const { evidenceSpanId: _drop, ...orphan } = valid;
    expect(MetricObservation.safeParse(orphan).success).toBe(false);
    expect(MetricObservation.safeParse({ ...valid, evidenceSpanId: '' }).success).toBe(false);
  });

  it('refuses a value with no unit', () => {
    expect(MetricObservation.safeParse({ ...valid, unit: '' }).success).toBe(false);
  });

  it('preserves a real zero', () => {
    // Zero releases this month is a finding, not missing data.
    const parsed = MetricObservation.parse({ ...valid, metricKey: 'release_count', value: 0, unit: 'releases' });
    expect(parsed.value).toBe(0);
  });

  it('will not present an estimate as measured', () => {
    expect(canPresentAsMeasured({ evidenceSpanId: 'span-1', isEstimated: false })).toBe(true);
    expect(canPresentAsMeasured({ evidenceSpanId: 'span-1', isEstimated: true })).toBe(false);
    expect(canPresentAsMeasured({ evidenceSpanId: '', isEstimated: false })).toBe(false);
  });
});

describe('claims', () => {
  it('requires supporting evidence for a fact', () => {
    const unsupported = Claim.safeParse({
      id: 'c1', statement: 'Competitor raised prices 20%', claimType: 'fact',
      supportingSpanIds: [],
    });
    expect(unsupported.success).toBe(false);
  });

  it('allows interpretation and assumption without evidence spans', () => {
    // Analyst synthesis is legitimate — it just must not masquerade as a fact.
    for (const claimType of ['interpretation', 'assumption'] as const) {
      const parsed = Claim.safeParse({
        id: 'c1', statement: 'They appear to be moving upmarket', claimType,
        supportingSpanIds: [],
      });
      expect(parsed.success, claimType).toBe(true);
    }
  });

  it('keeps contradicting evidence separate from supporting', () => {
    const parsed = Claim.parse({
      id: 'c1', statement: 'Entry tier is $59', claimType: 'fact',
      supportingSpanIds: ['span-1'], contradictingSpanIds: ['span-2'],
    });
    expect(parsed.supportingSpanIds).toEqual(['span-1']);
    expect(parsed.contradictingSpanIds).toEqual(['span-2']);
  });
});

describe('change events', () => {
  const valid = {
    id: 'e1',
    eventType: 'pricing_changed',
    beforeValue: '$49/month',
    afterValue: '$59/month',
    observedAt: NOW,
    materiality: 0.8,
    materialityReason: 'Entry-tier price moved 20% on a tracked competitor',
    dedupeKey: 'ent-1:pricing_changed:49:59',
  };

  it('accepts a well-formed event', () => {
    expect(ChangeEvent.safeParse(valid).success).toBe(true);
  });

  it('rejects an event that records neither side of the change', () => {
    expect(
      ChangeEvent.safeParse({ ...valid, beforeValue: null, afterValue: null }).success,
    ).toBe(false);
  });

  it('rejects an unknown event type', () => {
    expect(ChangeEvent.safeParse({ ...valid, eventType: 'vibes_shifted' }).success).toBe(false);
  });

  it('bounds materiality to 0..1', () => {
    expect(ChangeEvent.safeParse({ ...valid, materiality: 1.5 }).success).toBe(false);
  });
});

describe('chart spec validation', () => {
  it('accepts a well-formed measured chart', () => {
    const result = validateChartSpec(baseChart());
    expect(result.ok).toBe(true);
  });

  it('rejects a measured chart with no sources or evidence', () => {
    const result = validateChartSpec(baseChart({ sourceIds: [], evidenceSpanIds: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('a measured chart must cite at least one source');
      expect(result.reasons).toContain('a measured chart must cite at least one evidence span');
    }
  });

  it('requires a formula on a derived chart', () => {
    const result = validateChartSpec(baseChart({ dataClass: 'derived' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('a derived chart must state the formula used to compute it');
    }
  });

  it('requires limitations on a synthetic chart', () => {
    const result = validateChartSpec(
      baseChart({ dataClass: 'synthetic', limitations: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('a synthetic chart must state its limitations');
    }
  });

  it('rejects a chart with no rows instead of drawing an empty frame', () => {
    const result = validateChartSpec(baseChart({ rows: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects a series that is null all the way down', () => {
    // A gap being drawn as data is exactly the failure mode this schema exists
    // to prevent.
    const result = validateChartSpec(
      baseChart({
        rows: [
          { month: '2026-01', price: null },
          { month: '2026-02', price: null },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('series "price" has no observed values');
    }
  });

  it('rejects a series that no row contains', () => {
    const result = validateChartSpec(
      baseChart({ series: [{ key: 'revenue', label: 'Revenue' }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('series "revenue" is declared but missing from every row');
    }
  });

  it('keeps a genuine zero as a valid observation', () => {
    const result = validateChartSpec(
      baseChart({
        unit: 'releases',
        rows: [
          { month: '2026-01', price: 0 },
          { month: '2026-02', price: 3 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('tolerates a null gap alongside real values', () => {
    const result = validateChartSpec(
      baseChart({
        rows: [
          { month: '2026-01', price: 49 },
          { month: '2026-02', price: null },
          { month: '2026-03', price: 59 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a reversed period', () => {
    const result = validateChartSpec(
      baseChart({
        period: { start: '2026-08-01T00:00:00.000Z', end: '2026-01-01T00:00:00.000Z', cadence: 'month' },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain('period end precedes period start');
  });

  it('reports schema problems as readable reasons', () => {
    const result = validateChartSpec({ id: 'x', kind: 'pie' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.join(' ')).toContain('kind');
    }
  });
});
