/**
 * Turning stored records into sentences a person can act on.
 *
 * A chart titled "plan_price" with a `measured` chip and `sample size 4` is
 * accurate and says nothing. What the user needs is: *"Lilian's entry tier went
 * from $49 to $59 in March — a 20% rise. Read from their pricing page."*
 *
 * Deterministic on purpose, not model-generated. Three reasons:
 *
 *  1. **Cost.** A sentence per chart per page load would be a model call per
 *     chart per page load, on a surface people refresh constantly.
 *  2. **Consistency.** The same data must produce the same sentence every time,
 *     or users learn to distrust wording that shifts underneath them.
 *  3. **Honesty.** A model asked to summarise a chart will occasionally
 *     editorialise — "a dramatic move", "signalling aggression" — which is
 *     exactly the unfounded interpretation this product exists to avoid.
 *
 * Everything here reads only from stored values. Nothing is inferred beyond
 * arithmetic the user could redo by hand.
 */

import { describeEvent, DATA_CLASS, importanceOf } from '@/lib/ux/vocabulary';
import type { ChartSpec } from './types';

// ── Numbers as people write them ────────────────────────────────────────────

/**
 * Format a value with its unit the way a person would say it.
 *
 * `49 USD/month` becomes `$49/month`. The unit string is ours; the rendering
 * should not be.
 */
export function formatValue(value: number, unit: string): string {
  const currency = unit.match(/^(USD|EUR|GBP|JPY)\b/);
  const symbol = currency
    ? { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }[currency[1] as 'USD' | 'EUR' | 'GBP' | 'JPY']
    : null;

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(2);
  const period = unit.split('/')[1];

  if (symbol) return period ? `${symbol}${rounded}/${period}` : `${symbol}${rounded}`;
  return `${rounded} ${unit}`;
}

/** "a 20% rise" / "a 15% drop" / null when there is no meaningful percentage. */
export function describeMovement(from: number, to: number): string | null {
  if (from === 0 || from === to) return null;
  const pct = Math.round(Math.abs((to - from) / from) * 100);
  if (pct === 0) return null;
  return `a ${pct}% ${to > from ? 'rise' : 'drop'}`;
}

// ── Charts ──────────────────────────────────────────────────────────────────

export interface PlainChartSummary {
  /** One sentence stating what the chart shows. */
  headline: string;
  /** Where the numbers came from, in plain words. */
  provenance: string;
  /** Present only when there is a real caveat worth a glance. */
  caveat: string | null;
}

/**
 * Describe a chart in a sentence.
 *
 * Reads the first and last non-null value of the first series. That is what a
 * person looking at the line would notice, and it is arithmetic they could
 * check themselves.
 */
export function summariseChart(spec: ChartSpec): PlainChartSummary {
  const series = spec.series[0];
  const provenance = DATA_CLASS[spec.dataClass].label.toLowerCase();

  if (!series || spec.rows.length === 0) {
    return {
      headline: 'Nothing to show yet.',
      provenance: `Would be ${provenance} once there is data.`,
      caveat: null,
    };
  }

  const points = spec.rows
    .map((row) => ({ period: String(row[spec.dimensions[0] ?? 'period'] ?? ''), value: row[series.key] }))
    .filter((p): p is { period: string; value: number } => typeof p.value === 'number');

  if (points.length === 0) {
    return {
      headline: 'We have not recorded a value for this yet.',
      provenance: `Would be ${provenance} once there is data.`,
      caveat: null,
    };
  }

  const first = points[0];
  const last = points[points.length - 1];

  let headline: string;

  if (points.length === 1) {
    headline = `${spec.title}: ${formatValue(last.value, spec.unit)} as of ${last.period}.`;
  } else if (first.value === last.value) {
    // Stability is a finding. Saying "unchanged" is more useful than a chart
    // the user has to read to discover nothing happened.
    headline = `${spec.title} has not moved — ${formatValue(last.value, spec.unit)} since ${first.period}.`;
  } else {
    const movement = describeMovement(first.value, last.value);
    headline =
      `${spec.title} went from ${formatValue(first.value, spec.unit)} to ` +
      `${formatValue(last.value, spec.unit)} between ${first.period} and ${last.period}` +
      `${movement ? `, ${movement}` : ''}.`;
  }

  // One caveat maximum. Stacking them is how a user learns to ignore all of
  // them, and the research is explicit that overloaded trust UI backfires.
  let caveat: string | null = null;
  if (spec.dataClass === 'synthetic') {
    caveat = 'These are simulated opinions, not real customers.';
  } else if (spec.isEstimated) {
    caveat = 'Some of these figures are the source’s own estimates, not exact counts.';
  } else if (points.length < 3 && spec.period.cadence !== 'snapshot') {
    caveat = `Only ${points.length} reading${points.length === 1 ? '' : 's'} so far — too few to call a trend.`;
  }

  return {
    headline,
    provenance:
      spec.dataClass === 'measured'
        ? 'Read directly from the sources, which you can open.'
        : spec.dataClass === 'derived'
          ? 'Worked out by us from what we collected. The calculation is shown.'
          : 'Generated by a model, not observed.',
    caveat,
  };
}

// ── Changes ─────────────────────────────────────────────────────────────────

export interface PlainChangeSummary {
  /** A full sentence describing what happened. */
  sentence: string;
  /** Why it does or does not deserve attention. */
  importance: string;
  /** What to consider doing, when the change type implies something. */
  suggestion: string | null;
}

/**
 * What a change type usually implies for a product team.
 *
 * Phrased as a question rather than an instruction. The product does not know
 * enough about the user's situation to tell them what to do, and a confident
 * recommendation built on that little context reads as noise the second time it
 * is wrong.
 */
const SUGGESTION: Record<string, string> = {
  pricing_changed: 'Worth checking whether your own pricing still sits where you want it to.',
  feature_launched: 'Worth a look at whether this closes a gap they had, or opens one for you.',
  feature_removed: 'Worth asking whether their customers wanted that, and whether yours do.',
  positioning_changed: 'Worth comparing against how you describe yourself to the same buyers.',
  segment_changed: 'Worth checking whether they are moving toward or away from your customers.',
  funding_or_filing: 'Worth considering what more money lets them do that they could not before.',
};

export function summariseChange(params: {
  entityLabel: string;
  eventType: string;
  beforeValue: string | null;
  afterValue: string | null;
  materiality: number;
  observedAt: string;
}): PlainChangeSummary {
  const action = describeEvent(params.eventType);

  let movement = '';
  if (params.beforeValue && params.afterValue) {
    movement = `: ${params.beforeValue} → ${params.afterValue}`;
  } else if (params.afterValue) {
    movement = `: ${params.afterValue}`;
  }

  const days = Math.floor((Date.now() - new Date(params.observedAt).getTime()) / 86_400_000);
  const when =
    Number.isNaN(days) || days < 0
      ? ''
      : days === 0
        ? ' — spotted today'
        : days === 1
          ? ' — spotted yesterday'
          : ` — spotted ${days} days ago`;

  const importance = importanceOf(params.materiality);

  return {
    sentence: `${params.entityLabel} ${action}${movement}${when}.`,
    importance: importance.meaning,
    suggestion: params.materiality >= 0.5 ? (SUGGESTION[params.eventType] ?? null) : null,
  };
}

// ── Coverage ────────────────────────────────────────────────────────────────

/**
 * Describe how much of what we tracked was actually checked.
 *
 * "3 of 5 sources checked, 2 unreachable" is a status line. This says what it
 * means for the answer, because a user who does not realise coverage was
 * partial will read the result as complete.
 */
export function summariseCoverage(params: {
  sourcesChecked: number;
  unchanged: number;
  unreachable: number;
}): string {
  const { sourcesChecked, unchanged, unreachable } = params;

  if (sourcesChecked === 0) {
    return 'We have not checked any sources for this project yet.';
  }

  if (unreachable > 0) {
    return (
      `We checked ${sourcesChecked - unreachable} of ${sourcesChecked} sources. ` +
      `${unreachable} could not be reached, so a change there would not have been spotted.`
    );
  }

  if (unchanged === sourcesChecked) {
    return `We checked all ${sourcesChecked} sources and every one was identical to last time.`;
  }

  return `We checked all ${sourcesChecked} sources; ${unchanged} were unchanged.`;
}
