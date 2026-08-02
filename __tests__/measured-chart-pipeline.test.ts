/**
 * The vertical slice that proves the thesis.
 *
 * Live connector data -> evidence spans -> metric observations -> a validated
 * ChartSpec whose every row traces back to an excerpt. No model output enters
 * this path, so the resulting chart is genuinely `measured` rather than
 * plausible.
 *
 * If this test passes, the product can answer "where did this number come
 * from?" with a specific excerpt rather than a source list.
 */

import { describe, it, expect } from 'vitest';
import {
  releasesToMonthlyCounts,
  releasesToSpans,
  type GitHubRelease,
} from '@/lib/intelligence/connectors/github-releases';
import { factsToSpans, type SecFact } from '@/lib/intelligence/connectors/sec-edgar';
import { planMetricChart } from '@/lib/intelligence/chart-planner';
import type { ExtractedSpan } from '@/lib/intelligence/evidence-extractor';
import type { MetricObservation } from '@/lib/intelligence/types';

/**
 * Stand in for `saveExtractedEvidence`, which assigns a real span id per span
 * and links each observation to it. The linkage is the part under test.
 */
function toObservations(spans: ExtractedSpan[], entityId?: string): MetricObservation[] {
  return spans
    .filter((span) => span.metric !== null)
    .map((span, i) => ({
      id: `obs-${i}`,
      entityId: entityId ?? null,
      projectId: 'proj-1',
      evidenceSpanId: `span-${i}`,
      metricKey: span.metric!.key,
      value: span.metric!.value,
      unit: span.metric!.unit,
      periodStart: span.metric!.periodStart ?? null,
      periodEnd: span.metric!.periodEnd ?? null,
      method: 'counted',
      isEstimated: span.metric!.isEstimated,
      observedAt: span.metric!.periodStart ?? new Date().toISOString(),
    })) as MetricObservation[];
}

const release = (publishedAt: string, name: string): GitHubRelease => ({
  tag: name, name, publishedAt, url: `https://github.com/acme/widget/releases/${name}`,
  isPrerelease: false,
});

describe('GitHub releases to a measured chart', () => {
  const releases = [
    release('2026-01-08T00:00:00.000Z', 'v1.0'),
    release('2026-01-22T00:00:00.000Z', 'v1.1'),
    release('2026-03-14T00:00:00.000Z', 'v1.2'),
    release('2026-04-02T00:00:00.000Z', 'v1.3'),
  ];

  const spans = releasesToSpans(releasesToMonthlyCounts(releases), 'acme/widget');
  const observations = toObservations(spans);

  it('produces one observation per month, including the quiet one', () => {
    expect(observations.map((o) => o.value)).toEqual([2, 0, 1, 1]);
  });

  it('builds a chart the validator accepts as measured', () => {
    const result = planMetricChart({
      id: 'release-cadence',
      metricKey: 'release_count',
      title: 'Release cadence',
      questionAnswered: 'How often does this competitor ship?',
      metricDefinition: 'Count of published, non-prerelease GitHub releases per month',
      observations,
      sourceIds: ['https://github.com/acme/widget/releases'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.dataClass).toBe('measured');
    expect(result.spec.unit).toBe('releases');
    expect(result.spec.rows).toHaveLength(4);
    expect(result.spec.isEstimated).toBe(false);
  });

  it('gives every row an evidence span to trace back to', () => {
    // The whole point. A chart row with no excerpt behind it is the thing the
    // ledger exists to make impossible.
    const result = planMetricChart({
      id: 'release-cadence',
      metricKey: 'release_count',
      title: 'Release cadence',
      questionAnswered: 'How often does this competitor ship?',
      metricDefinition: 'Count of published releases per month',
      observations,
      sourceIds: ['https://github.com/acme/widget/releases'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.evidenceSpanIds).toHaveLength(observations.length);
    expect(observations.every((o) => Boolean(o.evidenceSpanId))).toBe(true);
  });

  it('keeps the quiet month as a real zero rather than a gap', () => {
    // Zero releases in February is a finding. It must not be dropped, and it
    // must not be confused with "we did not look".
    const result = planMetricChart({
      id: 'release-cadence',
      metricKey: 'release_count',
      title: 'Release cadence',
      questionAnswered: 'How often does this competitor ship?',
      metricDefinition: 'Count of published releases per month',
      observations,
      sourceIds: ['src'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const february = result.spec.rows.find((r) => r.period === '2026-02');
    expect(february?.value).toBe(0);
    expect(february?.value).not.toBeNull();
  });

  it('explains itself in the formula rather than hiding the computation', () => {
    const result = planMetricChart({
      id: 'release-cadence',
      metricKey: 'release_count',
      title: 'Release cadence',
      questionAnswered: 'How often does this competitor ship?',
      metricDefinition: 'Count of published releases per month',
      observations,
      sourceIds: ['src'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.formula).toBeTruthy();
      expect(result.spec.sampleSize).toBe(4);
    }
  });
});

describe('SEC filings to a measured chart', () => {
  const facts: SecFact[] = [2023, 2024, 2025].map((year) => ({
    concept: 'Revenues',
    value: 1_000_000 * (year - 2020),
    unit: 'USD',
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    fiscalYear: year,
    fiscalPeriod: 'FY',
    form: '10-K',
    filedAt: `${year + 1}-02-10`,
    accession: `0000320193-${year}-000010`,
  }));

  it('charts filed revenue with every point citing its filing', () => {
    const spans = factsToSpans(facts, 'Example Corp');
    const observations = toObservations(spans, 'ent-example');

    const result = planMetricChart({
      id: 'revenue',
      metricKey: 'Revenues',
      title: 'Reported revenue',
      questionAnswered: 'How has this public competitor’s reported revenue moved?',
      metricDefinition: 'Revenues as filed on form 10-K',
      observations,
      sourceIds: ['https://www.sec.gov/cgi-bin/browse-edgar?CIK=0000320193'],
      limitations: [
        'US SEC registrants only; most competitors are private and not covered.',
        'Filed figures are periodic, so the newest point may be months old.',
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.dataClass).toBe('measured');
    expect(result.spec.unit).toBe('USD');
    expect(result.spec.rows.map((r) => r['ent-example'])).toEqual([3_000_000, 4_000_000, 5_000_000]);
    // The coverage limitation travels with the chart rather than living in a
    // doc nobody reads.
    expect(result.spec.limitations.join(' ')).toContain('SEC registrants only');
  });

  it('refuses to chart a mixed-unit concept', () => {
    const mixed = factsToSpans(
      [
        { ...facts[0], unit: 'USD' },
        { ...facts[1], unit: 'shares', value: 5000 },
      ],
      'Example Corp',
    );

    const result = planMetricChart({
      id: 'mixed',
      metricKey: 'Revenues',
      title: 'Reported revenue',
      questionAnswered: 'How has revenue moved?',
      metricDefinition: 'Revenues as filed',
      observations: toObservations(mixed, 'ent-example'),
      sourceIds: ['src'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(' ')).toContain('incompatible units');
  });
});
