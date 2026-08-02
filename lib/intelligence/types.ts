/**
 * Evidence ledger schemas.
 *
 * These types are the boundary between "a model said so" and "a source shows
 * so". Everything the product renders as a number or a fact has to come through
 * here first, because validation is the only thing standing between an LLM's
 * plausible output and a chart the user is asked to trust.
 *
 * The load-bearing rules:
 *   - a metric observation requires an evidence span id (not optional);
 *   - a measured chart requires source ids and rejects null-only series;
 *   - zero stays zero and missing stays null — no visually convenient default;
 *   - anything the model judged is `derived` or `synthetic`, never `measured`.
 */

import { z } from 'zod';

// ── Shared vocabulary ───────────────────────────────────────────────────────

/**
 * How much a value is worth trusting.
 *
 * measured  — computed directly from source observations with a stable unit
 * derived   — deterministic calculation or rubric over measured inputs
 * synthetic — model judgment or scenario simulation
 *
 * The distinction drives both UI labelling and what language is permitted:
 * a synthetic series may never be described as an observed trend.
 */
export const DataClass = z.enum(['measured', 'derived', 'synthetic']);
export type DataClass = z.infer<typeof DataClass>;

export const ConfidenceLevel = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const EntityMatch = z.enum(['confirmed', 'probable', 'unverified', 'mismatch']);
export type EntityMatch = z.infer<typeof EntityMatch>;

/** The ten normalized change types. A diff that fits none of these is not an event. */
export const ChangeEventType = z.enum([
  'pricing_changed',
  'feature_launched',
  'feature_removed',
  'positioning_changed',
  'segment_changed',
  'integration_announced',
  'hiring_signal',
  'funding_or_filing',
  'review_theme',
  'documentation_changed',
]);
export type ChangeEventType = z.infer<typeof ChangeEventType>;

// ── Evidence span ───────────────────────────────────────────────────────────

export const EvidenceSpan = z.object({
  id: z.string(),
  snapshotId: z.string(),
  projectId: z.string().nullable().optional(),

  /** Verbatim text. Paraphrasing here would defeat the purpose of the table. */
  excerpt: z.string().trim().min(1, 'an evidence span must quote something'),
  startOffset: z.number().int().nonnegative().nullable().optional(),
  endOffset: z.number().int().nonnegative().nullable().optional(),

  extractionType: z
    .enum(['price', 'feature', 'release', 'positioning', 'quote', 'metric', 'other'])
    .default('other'),
  entityMatch: EntityMatch.default('unverified'),
  createdAt: z.string(),
}).refine(
  (s) =>
    s.startOffset == null || s.endOffset == null || s.endOffset >= s.startOffset,
  { message: 'end offset must not precede start offset' },
);
export type EvidenceSpan = z.infer<typeof EvidenceSpan>;

// ── Metric observation ──────────────────────────────────────────────────────

export const MetricObservation = z.object({
  id: z.string(),
  projectId: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),

  /**
   * Required, deliberately. A number whose excerpt cannot be produced is not an
   * observation — it is a guess, and it must not reach a chart.
   */
  evidenceSpanId: z.string().min(1, 'a metric observation must cite an evidence span'),

  metricKey: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().min(1, 'a value without a unit cannot be compared'),

  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),

  method: z.enum(['extracted', 'counted', 'reported']).default('extracted'),
  isEstimated: z.boolean().default(false),

  observedAt: z.string(),
});
export type MetricObservation = z.infer<typeof MetricObservation>;

// ── Change event ────────────────────────────────────────────────────────────

export const ChangeEvent = z.object({
  id: z.string(),
  projectId: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),

  eventType: ChangeEventType,
  beforeValue: z.string().nullable().optional(),
  afterValue: z.string().nullable().optional(),

  /** When it happened in the world. Distinct from when we noticed. */
  effectiveAt: z.string().nullable().optional(),
  observedAt: z.string(),

  fromSnapshotId: z.string().nullable().optional(),
  toSnapshotId: z.string().nullable().optional(),
  evidenceSpanId: z.string().nullable().optional(),

  materiality: z.number().min(0).max(1),
  materialityReason: z.string(),
  confidence: ConfidenceLevel.default('low'),
  dedupeKey: z.string().min(1),
}).refine(
  (e) => e.beforeValue != null || e.afterValue != null,
  { message: 'a change event must record at least one side of the change' },
);
export type ChangeEvent = z.infer<typeof ChangeEvent>;

// ── Claim ───────────────────────────────────────────────────────────────────

export const Claim = z.object({
  id: z.string(),
  projectId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),

  statement: z.string().trim().min(1),
  claimType: z.enum(['fact', 'interpretation', 'assumption']).default('fact'),
  confidence: ConfidenceLevel.default('low'),

  supportingSpanIds: z.array(z.string()).default([]),
  contradictingSpanIds: z.array(z.string()).default([]),

  freshestEvidenceAt: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
}).refine(
  (c) => c.claimType !== 'fact' || c.supportingSpanIds.length > 0,
  { message: 'a fact must cite at least one supporting evidence span' },
);
export type Claim = z.infer<typeof Claim>;

// ── Chart spec ──────────────────────────────────────────────────────────────

export const ChartKind = z.enum([
  'line',
  'bar',
  'stacked-bar',
  'area',
  'scatter',
  'timeline',
  'matrix',
]);
export type ChartKind = z.infer<typeof ChartKind>;

/**
 * A cell is a string, a number, or explicitly null.
 *
 * `null` is a first-class value here: a gap in a series must survive all the
 * way to the renderer as a gap. Substituting 0 or a neighbouring value draws a
 * line the data does not support.
 */
export const ChartCell = z.union([z.string(), z.number().finite(), z.null()]);

export const ChartSpec = z.object({
  id: z.string(),
  kind: ChartKind,
  dataClass: DataClass,

  title: z.string().min(1),
  /** The question this chart answers. If it answers none, it should not exist. */
  questionAnswered: z.string().min(1),
  /** How the metric is defined, in the user's language, not the schema's. */
  metricDefinition: z.string().min(1),
  unit: z.string().min(1),

  period: z.object({
    start: z.string(),
    end: z.string(),
    cadence: z.enum(['day', 'week', 'month', 'snapshot']),
  }),

  dimensions: z.array(z.string()).default([]),
  series: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).min(1),
  rows: z.array(z.record(z.string(), ChartCell)).default([]),

  sourceIds: z.array(z.string()).default([]),
  /** Evidence spans backing the rows, so a tooltip can link to the excerpt. */
  evidenceSpanIds: z.array(z.string()).default([]),

  sampleSize: z.number().int().nonnegative().optional(),
  formula: z.string().optional(),
  isEstimated: z.boolean().default(false),
  limitations: z.array(z.string()).default([]),
  generatedAt: z.string(),
});
export type ChartSpec = z.infer<typeof ChartSpec>;

// ── Chart validation ────────────────────────────────────────────────────────

export type ChartValidation =
  | { ok: true; spec: ChartSpec }
  | { ok: false; reasons: string[] };

/**
 * Validate a chart before it is stored or rendered.
 *
 * Beyond the shape check, this enforces the rules that keep a picture honest.
 * A rejected chart is not a failure state to paper over — the caller should
 * render the reasons as an explanatory empty state, which is more useful to a
 * user than a chart they cannot trust.
 */
export function validateChartSpec(input: unknown): ChartValidation {
  const parsed = ChartSpec.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reasons: parsed.error.issues.map((i) =>
        i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message,
      ),
    };
  }

  const spec = parsed.data;
  const reasons: string[] = [];

  // A measured chart claims the numbers came from the outside world, so it has
  // to be able to point at where.
  if (spec.dataClass === 'measured' && spec.sourceIds.length === 0) {
    reasons.push('a measured chart must cite at least one source');
  }
  if (spec.dataClass === 'measured' && spec.evidenceSpanIds.length === 0) {
    reasons.push('a measured chart must cite at least one evidence span');
  }

  // A derived value is computed, so the computation has to be stated.
  if (spec.dataClass === 'derived' && !spec.formula) {
    reasons.push('a derived chart must state the formula used to compute it');
  }

  // A scenario has to say what it cannot tell you.
  if (spec.dataClass === 'synthetic' && spec.limitations.length === 0) {
    reasons.push('a synthetic chart must state its limitations');
  }

  if (spec.rows.length === 0) {
    reasons.push('a chart with no rows should be an empty state, not a chart');
  }

  // Every declared series must actually appear, with at least one non-null
  // value. A series that is null all the way down is a gap being drawn as data.
  for (const series of spec.series) {
    const present = spec.rows.some((row) => row[series.key] !== undefined);
    if (!present) {
      reasons.push(`series "${series.key}" is declared but missing from every row`);
      continue;
    }
    const hasValue = spec.rows.some(
      (row) => typeof row[series.key] === 'number' || typeof row[series.key] === 'string',
    );
    if (!hasValue) {
      reasons.push(`series "${series.key}" has no observed values`);
    }
  }

  if (new Date(spec.period.end).getTime() < new Date(spec.period.start).getTime()) {
    reasons.push('period end precedes period start');
  }

  return reasons.length === 0 ? { ok: true, spec } : { ok: false, reasons };
}

/**
 * True when a value may be presented as measured.
 *
 * Used at the boundary where model output becomes a stored observation. The
 * check is intentionally blunt: if there is no evidence span, the answer is no,
 * regardless of how confident the model was.
 */
export function canPresentAsMeasured(
  observation: Pick<MetricObservation, 'evidenceSpanId' | 'isEstimated'>,
): boolean {
  return Boolean(observation.evidenceSpanId) && !observation.isEstimated;
}
