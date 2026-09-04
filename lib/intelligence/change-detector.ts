/**
 * Change detection, deduplication, and materiality.
 *
 * This is the difference between a monitoring feed and a decision product. A
 * feed reports every diff. This reports the ones that matter to *this project's
 * current decision*, and reports each of them exactly once.
 *
 * Two rules govern the module:
 *
 *  1. Materiality is deterministic and explainable. It is not model confidence.
 *     A model's certainty that it noticed something is unrelated to whether the
 *     something matters, and using it as a proxy is how alert fatigue starts.
 *
 *  2. The dedupe key describes the change, not the run. Re-observing the same
 *     price move must collapse onto the existing event, or a weekly digest
 *     re-reports the same news every week and the user stops opening it.
 */

import { createHash } from 'node:crypto';
import type { ChangeEventType, ConfidenceLevel } from './types';

// ── Diffing ─────────────────────────────────────────────────────────────────

export interface DetectedChange {
  eventType: ChangeEventType;
  beforeValue: string | null;
  afterValue: string | null;
  /** Relative size of the change, 0–1, when it can be quantified. */
  magnitude: number | null;
  evidenceExcerpt: string | null;
}

/**
 * Detect a change between two observations of the same metric.
 *
 * Returns null when the values are equal. Equality is checked before formatting
 * so "49" and "49.00" do not read as a price change.
 */
export function detectMetricChange(params: {
  metricKey: string;
  before: { value: number; unit: string } | null;
  after: { value: number; unit: string };
  excerpt?: string;
}): DetectedChange | null {
  const { metricKey, before, after, excerpt } = params;

  // First observation of a metric is not a change — there is no "before" to
  // have moved from, and reporting it as one produces a burst of false events
  // on the day a project is created.
  if (!before) return null;

  // Different units are not comparable. Reporting "$49 → €49" as a price change
  // would be wrong in both directions.
  if (before.unit !== after.unit) return null;

  if (Math.abs(before.value - after.value) < 1e-9) return null;

  const magnitude =
    before.value === 0 ? null : Math.abs(after.value - before.value) / Math.abs(before.value);

  return {
    eventType: metricKeyToEventType(metricKey),
    beforeValue: `${before.value} ${before.unit}`,
    afterValue: `${after.value} ${after.unit}`,
    magnitude,
    evidenceExcerpt: excerpt ?? null,
  };
}

function metricKeyToEventType(metricKey: string): ChangeEventType {
  const key = metricKey.toLowerCase();
  // "fare", "fee", "tariff" and "rate" are how price is written outside SaaS —
  // transport, logistics, utilities, banking. Without them a genuine fare
  // increase was classed `documentation_changed`, scored 0.2, and fell below the
  // materiality floor, so the single most decision-relevant change a competitor
  // can make was silently withheld from the user.
  if (
    key.includes('price') || key.includes('cost') || key.includes('plan') ||
    key.includes('fare') || key.includes('fee') || key.includes('tariff') ||
    key.includes('rate') || key.includes('tier') || key.includes('subscription')
  ) {
    return 'pricing_changed';
  }
  if (key.includes('release') || key.includes('version')) return 'feature_launched';
  if (key.includes('headcount') || key.includes('job') || key.includes('hiring')) return 'hiring_signal';
  if (key.includes('revenue') || key.includes('funding')) return 'funding_or_filing';
  return 'documentation_changed';
}

// ── Deduplication ───────────────────────────────────────────────────────────

/**
 * Stable key describing a change.
 *
 * Deliberately excludes the run id, the timestamp, and the snapshot ids. Those
 * differ every run, and including any of them would make every re-observation
 * look new — which is the exact failure the unique index is there to prevent.
 */
export function buildDedupeKey(params: {
  entityId: string | null;
  eventType: ChangeEventType;
  beforeValue: string | null;
  afterValue: string | null;
}): string {
  const normalize = (v: string | null) => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  return createHash('sha256')
    .update(
      [
        params.entityId ?? 'unknown',
        params.eventType,
        normalize(params.beforeValue),
        normalize(params.afterValue),
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32);
}

// ── Materiality ─────────────────────────────────────────────────────────────

/**
 * Base weight per event type.
 *
 * A pricing change affects almost every decision a product team makes; a
 * documentation edit rarely does. These are the product's opinion about what
 * matters, stated in one place so it can be argued with and tuned, rather than
 * scattered across prompts.
 */
const EVENT_TYPE_WEIGHT: Record<ChangeEventType, number> = {
  pricing_changed: 0.9,
  feature_launched: 0.7,
  feature_removed: 0.7,
  positioning_changed: 0.6,
  segment_changed: 0.6,
  funding_or_filing: 0.6,
  integration_announced: 0.4,
  hiring_signal: 0.35,
  review_theme: 0.4,
  documentation_changed: 0.2,
};

/** Which event types bear on which decision focus. */
const DECISION_RELEVANCE: Record<string, ChangeEventType[]> = {
  pricing: ['pricing_changed', 'segment_changed', 'positioning_changed'],
  positioning: ['positioning_changed', 'segment_changed', 'review_theme'],
  roadmap: ['feature_launched', 'feature_removed', 'documentation_changed', 'hiring_signal'],
  launch: ['feature_launched', 'positioning_changed', 'integration_announced'],
  sales: ['pricing_changed', 'review_theme', 'feature_launched'],
};

export interface MaterialityInput {
  eventType: ChangeEventType;
  /** Relative size of the change, when quantifiable. */
  magnitude?: number | null;
  /** Trust tier of the source that reported it. */
  sourceTrust?: 'official' | 'press' | 'community' | 'unknown';
  /** Whether the entity is one the project explicitly tracks. */
  isTrackedEntity?: boolean;
  /** The project's stated decision focus. */
  decisionFocus?: string | null;
  /** Whether a comparable change was already reported recently. */
  isRepeat?: boolean;
}

export interface MaterialityResult {
  score: number;
  reason: string;
}

const SOURCE_TRUST_MULTIPLIER: Record<string, number> = {
  official: 1.0,
  press: 0.85,
  community: 0.6,
  unknown: 0.5,
};

/**
 * Score a change 0–1 and explain the score in one sentence.
 *
 * The explanation is not decoration. A user who disagrees with an alert needs to
 * see why the system raised it, and a threshold that cannot be reasoned about
 * cannot be tuned.
 */
export function scoreMateriality(input: MaterialityInput): MaterialityResult {
  const reasons: string[] = [];

  let score = EVENT_TYPE_WEIGHT[input.eventType];
  reasons.push(`${input.eventType.replace(/_/g, ' ')} carries a base weight of ${score.toFixed(2)}`);

  // A 30% price move matters more than a 1% one; below ~2% is rounding.
  if (typeof input.magnitude === 'number') {
    if (input.magnitude < 0.02) {
      score *= 0.4;
      reasons.push('the change is under 2%, which is close to noise');
    } else if (input.magnitude >= 0.2) {
      score = Math.min(1, score * 1.2);
      reasons.push(`the change is ${Math.round(input.magnitude * 100)}%, which is substantial`);
    }
  }

  const trust = SOURCE_TRUST_MULTIPLIER[input.sourceTrust ?? 'unknown'];
  score *= trust;
  if (trust < 1) {
    reasons.push(`the source is ${input.sourceTrust ?? 'unknown'}, so confidence is reduced`);
  }

  // An untracked entity is background; a tracked competitor is the point.
  if (input.isTrackedEntity === false) {
    score *= 0.5;
    reasons.push('the entity is not one this project tracks');
  }

  if (input.decisionFocus) {
    const relevant = DECISION_RELEVANCE[input.decisionFocus.toLowerCase()] ?? [];
    if (relevant.includes(input.eventType)) {
      score = Math.min(1, score * 1.25);
      reasons.push(`it bears directly on the project's ${input.decisionFocus} decision`);
    } else if (relevant.length > 0) {
      score *= 0.8;
      reasons.push(`it is less relevant to the project's ${input.decisionFocus} decision`);
    }
  }

  // Novelty: the fifth report of a familiar pattern is worth less than the
  // first, even when the underlying change is identical.
  if (input.isRepeat) {
    score *= 0.6;
    reasons.push('a comparable change was already reported recently');
  }

  const final = Math.max(0, Math.min(1, Number(score.toFixed(3))));

  return {
    score: final,
    reason: `Scored ${final.toFixed(2)} because ${reasons.join('; ')}.`,
  };
}

/**
 * Whether a change clears the bar for an alert.
 *
 * Default 0.5 deliberately: research §10.6 favours a digest over noisy instant
 * alerts, so the threshold should exclude routine movement rather than admit it.
 */
export function isMaterial(score: number, threshold = 0.5): boolean {
  return score >= threshold;
}

/** Map a materiality score onto the confidence vocabulary used elsewhere. */
export function materialityToConfidence(score: number): ConfidenceLevel {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}
