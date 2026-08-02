/**
 * Digest assembly: deciding what a returning user is actually shown.
 *
 * The research is explicit that a daily/weekly digest beats noisy instant
 * alerts, and that an alert is only justified when the snapshot is new, the
 * event is not a duplicate, the entity matches, materiality clears the user's
 * threshold, and at least one exact evidence span is stored. All five gates are
 * enforced here, in one place, so no caller can send an alert that skips one.
 *
 * The design bias throughout is toward sending nothing. A digest a user stops
 * opening is worth less than no digest at all, and the failure mode of a
 * monitoring product is always over-reporting, never under-reporting.
 */

import type { ChangeEventType, ConfidenceLevel } from './types';

export interface DigestCandidate {
  id: string;
  entityId: string | null;
  entityLabel: string;
  eventType: ChangeEventType;
  beforeValue: string | null;
  afterValue: string | null;
  observedAt: string;
  materiality: number;
  materialityReason: string;
  confidence: ConfidenceLevel;
  /** Required for a candidate to be sendable — an alert with no proof is a rumour. */
  evidenceSpanId: string | null;
  entityMatch?: 'confirmed' | 'probable' | 'unverified' | 'mismatch';
  dedupeKey: string;
}

export interface DigestSection {
  entityLabel: string;
  items: DigestCandidate[];
}

export interface Digest {
  /** Empty when nothing cleared the gates. Callers must not send in that case. */
  sections: DigestSection[];
  itemCount: number;
  /** One-line summary suitable for a subject line or a "since your last visit" strip. */
  headline: string;
  /** Why candidates were withheld, for the in-app "why am I not seeing more?" answer. */
  suppressed: Array<{ id: string; reason: string }>;
  periodStart: string;
  periodEnd: string;
}

export interface DigestOptions {
  /** Only consider events observed after this. */
  since: string;
  /** Materiality floor. Defaults to the same 0.5 the alert path uses. */
  threshold?: number;
  /** Hard cap on items, so a noisy week cannot produce an unreadable digest. */
  maxItems?: number;
  /** Dedupe keys already sent in a previous digest. */
  alreadySent?: Set<string>;
}

const EVENT_LABEL: Record<ChangeEventType, string> = {
  pricing_changed: 'changed pricing',
  feature_launched: 'launched a feature',
  feature_removed: 'removed a feature',
  positioning_changed: 'changed positioning',
  segment_changed: 'shifted target segment',
  integration_announced: 'announced an integration',
  hiring_signal: 'showed a hiring signal',
  funding_or_filing: 'filed or raised',
  review_theme: 'shifted in customer reviews',
  documentation_changed: 'changed documentation',
};

/**
 * Assemble a digest from candidate events.
 *
 * Returns the suppression reasons alongside the digest rather than discarding
 * them: "we saw four changes but none cleared your threshold" is a useful
 * answer, and it lets a user tune the threshold instead of assuming the product
 * is asleep.
 */
export function buildDigest(candidates: DigestCandidate[], options: DigestOptions): Digest {
  const threshold = options.threshold ?? 0.5;
  const maxItems = options.maxItems ?? 12;
  const alreadySent = options.alreadySent ?? new Set<string>();
  const sinceMs = new Date(options.since).getTime();

  const suppressed: Digest['suppressed'] = [];
  const eligible: DigestCandidate[] = [];
  const seenThisRun = new Set<string>();

  for (const candidate of candidates) {
    // Gate 1 — the event has to be from this period.
    if (new Date(candidate.observedAt).getTime() <= sinceMs) {
      suppressed.push({ id: candidate.id, reason: 'observed before this digest period' });
      continue;
    }

    // Gate 2 — never send the same change twice, across runs or within one.
    if (alreadySent.has(candidate.dedupeKey) || seenThisRun.has(candidate.dedupeKey)) {
      suppressed.push({ id: candidate.id, reason: 'already reported' });
      continue;
    }

    // Gate 3 — an excerpt about a different company proves nothing about this
    // one, and is the fastest way to lose a user's trust in the whole product.
    if (candidate.entityMatch === 'mismatch') {
      suppressed.push({ id: candidate.id, reason: 'evidence is about a different entity' });
      continue;
    }

    // Gate 4 — an alert with no stored excerpt is a rumour.
    if (!candidate.evidenceSpanId) {
      suppressed.push({ id: candidate.id, reason: 'no evidence span was stored' });
      continue;
    }

    // Gate 5 — materiality.
    if (candidate.materiality < threshold) {
      suppressed.push({
        id: candidate.id,
        reason: `materiality ${candidate.materiality.toFixed(2)} is below the ${threshold.toFixed(2)} threshold`,
      });
      continue;
    }

    seenThisRun.add(candidate.dedupeKey);
    eligible.push(candidate);
  }

  // Most material first, then most recent. A user who reads only the first item
  // should get the one that matters most.
  eligible.sort((a, b) => {
    if (b.materiality !== a.materiality) return b.materiality - a.materiality;
    return new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime();
  });

  const capped = eligible.slice(0, maxItems);
  for (const dropped of eligible.slice(maxItems)) {
    suppressed.push({ id: dropped.id, reason: `beyond the ${maxItems}-item cap for one digest` });
  }

  // Group by entity so a user reads "what did Lilian do" rather than a flat
  // list interleaving three competitors.
  const byEntity = new Map<string, DigestCandidate[]>();
  for (const item of capped) {
    if (!byEntity.has(item.entityLabel)) byEntity.set(item.entityLabel, []);
    byEntity.get(item.entityLabel)!.push(item);
  }

  const sections: DigestSection[] = [...byEntity.entries()]
    .map(([entityLabel, items]) => ({ entityLabel, items }))
    .sort((a, b) => b.items[0].materiality - a.items[0].materiality);

  return {
    sections,
    itemCount: capped.length,
    headline: buildHeadline(capped),
    suppressed,
    periodStart: options.since,
    periodEnd: new Date().toISOString(),
  };
}

/**
 * One line describing the period.
 *
 * Names the single most material change when there is a clear leader, because
 * "Lilian changed pricing" tells a user whether to open the digest and
 * "3 changes" does not.
 */
function buildHeadline(items: DigestCandidate[]): string {
  if (items.length === 0) return 'No material changes since your last visit';

  const top = items[0];
  const rest = items.length - 1;
  const action = EVENT_LABEL[top.eventType];

  if (rest === 0) return `${top.entityLabel} ${action}`;
  return `${top.entityLabel} ${action}, plus ${rest} other change${rest === 1 ? '' : 's'}`;
}

/**
 * Whether a digest is worth sending.
 *
 * Separate from `buildDigest` so the decision is explicit at the call site. An
 * empty digest is still useful *in-app* — "nothing changed" is information —
 * but it must never become an email.
 */
export function shouldSend(digest: Digest): boolean {
  return digest.itemCount > 0;
}

/**
 * Plain-text digest body.
 *
 * Every item carries its evidence link and the reason it was considered
 * material, so a user can disagree with the system's judgment rather than
 * having to trust it.
 */
export function renderDigestText(digest: Digest, projectName: string): string {
  if (digest.itemCount === 0) {
    return `${projectName}: no material changes since ${digest.periodStart.slice(0, 10)}.`;
  }

  const lines: string[] = [
    `${projectName} — ${digest.headline}`,
    `Period: ${digest.periodStart.slice(0, 10)} to ${digest.periodEnd.slice(0, 10)}`,
    '',
  ];

  for (const section of digest.sections) {
    lines.push(section.entityLabel);
    for (const item of section.items) {
      const movement =
        item.beforeValue && item.afterValue
          ? `${item.beforeValue} → ${item.afterValue}`
          : (item.afterValue ?? item.beforeValue ?? '');
      lines.push(`  - ${EVENT_LABEL[item.eventType]}${movement ? `: ${movement}` : ''}`);
      lines.push(`    ${item.materialityReason}`);
    }
    lines.push('');
  }

  if (digest.suppressed.length > 0) {
    lines.push(
      `${digest.suppressed.length} further change(s) were not included; open the project to see why.`,
    );
  }

  return lines.join('\n');
}
