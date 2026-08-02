/**
 * Typed market events, emitted directly by the extractors that saw them.
 *
 * Change events were previously inferred from metric diffs: a `plan_price`
 * observation moved, therefore "pricing changed". That works for a number that
 * moved, but it is blind to the changes that matter most and involve no number
 * at all — a tier being renamed, a plan disappearing, a feature moving behind
 * Enterprise, a release shipping.
 *
 * Worse, inference guesses at *what kind* of change happened. The research is
 * explicit that pricing and release events must not be derived from URL or
 * content changes alone, because "this page differs" is not the same claim as
 * "they raised the price", and presenting the second when you only observed the
 * first is a fabrication with a diff attached to make it look verified.
 *
 * The extractors already know. `extractPrices` knows a plan vanished from the
 * page; the release connector knows a version shipped. This module turns that
 * direct knowledge into typed events, so the event says what was actually
 * observed.
 */

import { buildDedupeKey, scoreMateriality, materialityToConfidence } from './change-detector';
import type { ChangeEvent, ChangeEventType } from './types';
import type { ExtractedPrice } from './connectors/pricing-extractor';
import type { GitHubRelease } from './connectors/github-releases';
import type { FeedEntry } from './connectors/changelog-rss';

export interface TypedEventInput {
  entityId: string;
  entityLabel: string;
  sourceTrust?: 'official' | 'press' | 'community' | 'unknown';
  isTracked?: boolean;
  decisionFocus?: string | null;
  toSnapshotId?: string | null;
  evidenceSpanId?: string | null;
}

type EmittedEvent = Omit<ChangeEvent, 'id'> & { entityId: string };

function emit(params: {
  input: TypedEventInput;
  eventType: ChangeEventType;
  beforeValue: string | null;
  afterValue: string | null;
  magnitude?: number | null;
  effectiveAt?: string | null;
}): EmittedEvent {
  const materiality = scoreMateriality({
    eventType: params.eventType,
    magnitude: params.magnitude ?? null,
    sourceTrust: params.input.sourceTrust ?? 'official',
    isTrackedEntity: params.input.isTracked ?? true,
    decisionFocus: params.input.decisionFocus ?? null,
  });

  return {
    entityId: params.input.entityId,
    eventType: params.eventType,
    beforeValue: params.beforeValue,
    afterValue: params.afterValue,
    // When the source states a date — a release, a dated changelog entry — the
    // event carries when it actually happened, not only when we noticed.
    effectiveAt: params.effectiveAt ?? null,
    observedAt: new Date().toISOString(),
    fromSnapshotId: null,
    toSnapshotId: params.input.toSnapshotId ?? null,
    evidenceSpanId: params.input.evidenceSpanId ?? null,
    materiality: materiality.score,
    materialityReason: materiality.reason,
    confidence: materialityToConfidence(materiality.score),
    dedupeKey: buildDedupeKey({
      entityId: params.input.entityId,
      eventType: params.eventType,
      beforeValue: params.beforeValue,
      afterValue: params.afterValue,
    }),
  };
}

/** Identity for a plan across runs, so a rename is not read as a new plan. */
function planKey(price: ExtractedPrice): string {
  return `${price.planName ?? 'unattributed'}|${price.interval}`;
}

/**
 * Compare two readings of a pricing page and emit what actually changed.
 *
 * Three distinct events, where metric diffing produced one undifferentiated
 * "pricing changed":
 *
 *  - **A price moved.** The plan exists in both readings at a different amount.
 *  - **A plan appeared.** New packaging, which is often a bigger signal than a
 *    price move — it means they changed the shape of the offer.
 *  - **A plan disappeared.** Sunsetting a tier is a strategic move and involves
 *    no number changing at all, so metric diffing could never see it.
 *
 * A first reading emits nothing. There is no "before" to have moved from, and
 * treating a baseline as a change fires a burst of false events on day one.
 */
export function pricingEvents(
  before: ExtractedPrice[] | null,
  after: ExtractedPrice[],
  input: TypedEventInput,
): EmittedEvent[] {
  if (!before) return [];

  const beforeByPlan = new Map(before.map((p) => [planKey(p), p]));
  const afterByPlan = new Map(after.map((p) => [planKey(p), p]));
  const events: EmittedEvent[] = [];

  for (const [key, next] of afterByPlan) {
    const prior = beforeByPlan.get(key);
    const label = next.planName ?? 'Unattributed plan';

    if (!prior) {
      events.push(
        emit({
          input,
          eventType: 'pricing_changed',
          beforeValue: null,
          afterValue: `${label}: ${next.amount} ${next.currency}/${next.interval}`,
          // A new tier is packaging, not a price move — treated as substantial
          // so it clears the threshold on its own.
          magnitude: 0.25,
        }),
      );
      continue;
    }

    // Currency change is a repricing even at the same number, and comparing
    // across currencies as if it were a number move would be wrong.
    if (prior.currency !== next.currency) {
      events.push(
        emit({
          input,
          eventType: 'pricing_changed',
          beforeValue: `${label}: ${prior.amount} ${prior.currency}/${prior.interval}`,
          afterValue: `${label}: ${next.amount} ${next.currency}/${next.interval}`,
          magnitude: null,
        }),
      );
      continue;
    }

    if (Math.abs(prior.amount - next.amount) > 1e-9) {
      events.push(
        emit({
          input,
          eventType: 'pricing_changed',
          beforeValue: `${label}: ${prior.amount} ${prior.currency}/${prior.interval}`,
          afterValue: `${label}: ${next.amount} ${next.currency}/${next.interval}`,
          magnitude:
            prior.amount === 0 ? null : Math.abs(next.amount - prior.amount) / Math.abs(prior.amount),
        }),
      );
    }
  }

  for (const [key, prior] of beforeByPlan) {
    if (afterByPlan.has(key)) continue;
    events.push(
      emit({
        input,
        eventType: 'pricing_changed',
        beforeValue: `${prior.planName ?? 'Unattributed plan'}: ${prior.amount} ${prior.currency}/${prior.interval}`,
        // Explicitly stated rather than left as an absence, so the timeline
        // reads "no longer listed" instead of showing an empty cell.
        afterValue: 'no longer listed',
        magnitude: 0.3,
      }),
    );
  }

  return events;
}

/**
 * Emit a launch event per release the previous reading did not contain.
 *
 * Keyed on the tag, so a retitled release is not reported twice. The release
 * date becomes `effectiveAt`, because a competitor who shipped three weeks ago
 * and whom we noticed today shipped three weeks ago.
 */
export function releaseEvents(
  seenTags: Set<string>,
  releases: GitHubRelease[],
  input: TypedEventInput,
): EmittedEvent[] {
  return releases
    .filter((release) => !seenTags.has(release.tag))
    .map((release) =>
      emit({
        input,
        eventType: 'feature_launched',
        beforeValue: null,
        afterValue: release.name || release.tag,
        effectiveAt: release.publishedAt,
      }),
    );
}

/**
 * Emit a launch event per new changelog entry.
 *
 * Undated entries are skipped. Dating one to now would place an old
 * announcement at today and read as a fresh launch — the same reason the feed
 * connector drops them from its spans.
 */
export function changelogEvents(
  seenTitles: Set<string>,
  entries: FeedEntry[],
  input: TypedEventInput,
): EmittedEvent[] {
  return entries
    .filter((entry) => entry.publishedAt !== null && !seenTitles.has(entry.title))
    .map((entry) =>
      emit({
        input,
        eventType: 'feature_launched',
        beforeValue: null,
        afterValue: entry.title,
        effectiveAt: entry.publishedAt,
      }),
    );
}
