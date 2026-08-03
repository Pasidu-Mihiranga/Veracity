/**
 * Deterministic chart planning.
 *
 * The LLM is never asked for chart rows. It is asked to extract observations;
 * this module decides whether those observations can legitimately be drawn, and
 * builds the spec from them. That separation is what makes a chart value
 * reproducible: given the same observations, this function returns the same
 * spec, and the displayed formula recomputes the displayed number.
 *
 * The most important thing here is the refusals. A chart that should not exist
 * is not an error to route around — returning the reason lets the UI render an
 * explanation, which is more useful than a picture the user cannot trust.
 */

import type { ChartSpec, MetricObservation } from './types';
import { validateChartSpec } from './types';

export type Cadence = 'day' | 'week' | 'month' | 'snapshot';

export interface PlanInput {
  id: string;
  metricKey: string;
  title: string;
  questionAnswered: string;
  metricDefinition: string;
  observations: MetricObservation[];
  cadence?: Cadence;
  /** Series label per entity id, so a chart can compare competitors. */
  entityLabels?: Record<string, string>;
  sourceIds?: string[];
  limitations?: string[];
}

export type PlanResult =
  | { ok: true; spec: ChartSpec }
  | { ok: false; reasons: string[] };

/** Minimum points before a line implies a trend rather than noise. */
const MIN_POINTS_FOR_TREND = 3;

/**
 * Decide whether a set of observations can be charted, and build the spec.
 */
export function planMetricChart(input: PlanInput): PlanResult {
  const reasons: string[] = [];
  const observations = input.observations.filter((o) => o.metricKey === input.metricKey);

  if (observations.length === 0) {
    return { ok: false, reasons: ['no observations were recorded for this metric'] };
  }

  // Mixed units cannot share an axis. Plotting USD/month beside EUR/year
  // produces a line that means nothing, and the mistake is invisible once
  // rendered.
  const units = new Set(observations.map((o) => o.unit));
  if (units.size > 1) {
    reasons.push(
      `observations use incompatible units (${[...units].join(', ')}); ` +
        'they cannot share an axis',
    );
  }

  // Every observation must carry its evidence. This duplicates the schema's
  // NOT NULL, but the planner is the last checkpoint before rendering, and a
  // number reaching a chart without provenance is the failure mode that matters.
  const orphans = observations.filter((o) => !o.evidenceSpanId);
  if (orphans.length > 0) {
    reasons.push(`${orphans.length} observation(s) have no evidence span and cannot be charted`);
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const unit = [...units][0];
  const cadence = input.cadence ?? inferCadence(observations);

  // Group by period, then by entity, so competitors become series.
  const byPeriod = new Map<string, Map<string, number>>();
  for (const o of observations) {
    const bucket = periodKey(o, cadence);
    const entity = o.entityId ?? 'value';
    if (!byPeriod.has(bucket)) byPeriod.set(bucket, new Map());
    byPeriod.get(bucket)!.set(entity, o.value);
  }

  const periods = [...byPeriod.keys()].sort();
  const entities = [...new Set(observations.map((o) => o.entityId ?? 'value'))];

  const series = entities.map((id) => ({
    key: id,
    label: input.entityLabels?.[id] ?? (id === 'value' ? input.metricDefinition : id),
  }));

  const rows = periods.map((period) => {
    const values = byPeriod.get(period)!;
    const row: Record<string, string | number | null> = { period };
    for (const entity of entities) {
      // Missing stays null. It must survive to the renderer as a gap rather
      // than being interpolated or zero-filled.
      row[entity] = values.has(entity) ? values.get(entity)! : null;
    }
    return row;
  });

  // A line between two points asserts a trend that two points cannot support.
  // A bar chart of the same two values makes a weaker, honest claim.
  const kind: ChartSpec['kind'] =
    cadence === 'snapshot' || periods.length < MIN_POINTS_FOR_TREND ? 'bar' : 'line';

  const limitations = [...(input.limitations ?? [])];
  if (periods.length < MIN_POINTS_FOR_TREND && cadence !== 'snapshot') {
    limitations.push(
      `Only ${periods.length} observation period(s); too few to establish a trend.`,
    );
  }
  if (observations.some((o) => o.isEstimated)) {
    limitations.push('Some values are estimates reported by the source, not measured.');
  }

  const timestamps = observations
    .map((o) => o.periodStart ?? o.observedAt)
    .filter(Boolean)
    .sort();

  const candidate: ChartSpec = {
    id: input.id,
    kind,
    // Values read from sources are measured. Nothing in this function upgrades
    // a model judgment into that class.
    dataClass: 'measured',
    title: input.title,
    questionAnswered: input.questionAnswered,
    metricDefinition: input.metricDefinition,
    unit,
    period: {
      start: timestamps[0] ?? new Date().toISOString(),
      end: timestamps[timestamps.length - 1] ?? new Date().toISOString(),
      cadence,
    },
    dimensions: ['period'],
    series,
    rows,
    sourceIds: input.sourceIds ?? [],
    evidenceSpanIds: [...new Set(observations.map((o) => o.evidenceSpanId))],
    sampleSize: observations.length,
    formula: `Each point is a single ${input.metricKey} observation in ${unit}, read from the cited excerpt. No smoothing, interpolation, or aggregation is applied.`,
    isEstimated: observations.some((o) => o.isEstimated),
    limitations,
    generatedAt: new Date().toISOString(),
  };

  const validation = validateChartSpec(candidate);
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  return { ok: true, spec: validation.spec };
}

/**
 * Infer cadence from observation spacing.
 *
 * Falls back to 'snapshot' when observations carry no period, because a value
 * with no interval is a point-in-time reading and must not be drawn as a series
 * over time.
 */
function inferCadence(observations: MetricObservation[]): Cadence {
  const dated = observations
    .map((o) => o.periodStart)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b);

  if (dated.length < 2) return 'snapshot';

  const gaps: number[] = [];
  for (let i = 1; i < dated.length; i++) gaps.push(dated[i] - dated[i - 1]);
  const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

  const DAY = 86_400_000;
  if (median <= 2 * DAY) return 'day';
  if (median <= 10 * DAY) return 'week';
  return 'month';
}

/** Bucket label for an observation at a given cadence. */
function periodKey(observation: MetricObservation, cadence: Cadence): string {
  const iso = observation.periodStart ?? observation.observedAt;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  switch (cadence) {
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week': {
      // ISO week start (Monday), so weekly buckets are stable across runs.
      const d = new Date(date);
      const day = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - day);
      return d.toISOString().slice(0, 10);
    }
    case 'month':
      return date.toISOString().slice(0, 7);
    case 'snapshot':
      return date.toISOString();
  }
}

/**
 * Build the evidence-coverage chart: how much of what the product asserted is
 * actually backed.
 *
 * This one is `derived`, not `measured` — it counts our own records rather than
 * observing the outside world — so it carries a formula and says so.
 */
export function planEvidenceCoverageChart(params: {
  id: string;
  supported: number;
  unsupported: number;
}): PlanResult {
  const total = params.supported + params.unsupported;
  if (total === 0) {
    return { ok: false, reasons: ['no claims were recorded, so coverage is undefined'] };
  }

  const candidate: ChartSpec = {
    id: params.id,
    kind: 'bar',
    dataClass: 'derived',
    title: 'Evidence coverage',
    questionAnswered: 'How much of this answer is backed by a cited excerpt?',
    metricDefinition: 'Count of claims by whether an evidence span supports them',
    unit: 'claims',
    period: {
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      cadence: 'snapshot',
    },
    dimensions: ['status'],
    series: [{ key: 'count', label: 'Claims' }],
    rows: [
      { status: 'Supported', count: params.supported },
      { status: 'Unsupported', count: params.unsupported },
    ],
    sourceIds: [],
    evidenceSpanIds: [],
    sampleSize: total,
    formula: 'count(claims with >= 1 supporting evidence span) vs count(claims with none)',
    isEstimated: false,
    limitations: [
      'Counts claims, not their importance — one unsupported claim may matter more than ten supported ones.',
      'Derived from this run’s records, not from an external measurement.',
    ],
    generatedAt: new Date().toISOString(),
  };

  const validation = validateChartSpec(candidate);
  return validation.ok
    ? { ok: true, spec: validation.spec }
    : { ok: false, reasons: validation.reasons };
}
