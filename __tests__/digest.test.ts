/**
 * Digest assembly.
 *
 * The five gates from the research (new snapshot, not duplicate, entity
 * matches, materiality clears the threshold, evidence span stored) all live in
 * one function so no caller can send an alert that skips one. These tests hold
 * that line.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDigest,
  shouldSend,
  renderDigestText,
  type DigestCandidate,
} from '@/lib/intelligence/digest';

const SINCE = '2026-07-25T00:00:00.000Z';

function candidate(over: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    id: 'e1',
    entityId: 'ent-lilian',
    entityLabel: 'Lilian',
    eventType: 'pricing_changed',
    beforeValue: '$49/month',
    afterValue: '$59/month',
    observedAt: '2026-08-01T00:00:00.000Z',
    materiality: 0.8,
    materialityReason: 'Entry-tier price moved 20% on a tracked competitor',
    confidence: 'high',
    evidenceSpanId: 'span-1',
    entityMatch: 'confirmed',
    dedupeKey: 'k1',
    ...over,
  };
}

describe('the five gates', () => {
  it('includes a change that clears all of them', () => {
    const digest = buildDigest([candidate()], { since: SINCE });
    expect(digest.itemCount).toBe(1);
    expect(shouldSend(digest)).toBe(true);
  });

  it('excludes an event from before the period', () => {
    const digest = buildDigest(
      [candidate({ observedAt: '2026-07-01T00:00:00.000Z' })],
      { since: SINCE },
    );
    expect(digest.itemCount).toBe(0);
    expect(digest.suppressed[0].reason).toContain('before this digest period');
  });

  it('excludes a change already reported in an earlier digest', () => {
    const digest = buildDigest([candidate()], {
      since: SINCE,
      alreadySent: new Set(['k1']),
    });
    expect(digest.itemCount).toBe(0);
    expect(digest.suppressed[0].reason).toBe('already reported');
  });

  it('excludes a duplicate within the same run', () => {
    const digest = buildDigest(
      [candidate({ id: 'a' }), candidate({ id: 'b' })],
      { since: SINCE },
    );
    expect(digest.itemCount).toBe(1);
    expect(digest.suppressed).toHaveLength(1);
  });

  it('excludes evidence about a different entity', () => {
    // The fastest way to lose a user's trust in the whole product.
    const digest = buildDigest([candidate({ entityMatch: 'mismatch' })], { since: SINCE });
    expect(digest.itemCount).toBe(0);
    expect(digest.suppressed[0].reason).toContain('different entity');
  });

  it('excludes a change with no stored excerpt', () => {
    // An alert with no proof is a rumour.
    const digest = buildDigest([candidate({ evidenceSpanId: null })], { since: SINCE });
    expect(digest.itemCount).toBe(0);
    expect(digest.suppressed[0].reason).toContain('no evidence span');
  });

  it('excludes a change below the materiality threshold', () => {
    const digest = buildDigest([candidate({ materiality: 0.2 })], { since: SINCE });
    expect(digest.itemCount).toBe(0);
    expect(digest.suppressed[0].reason).toContain('below the 0.50 threshold');
  });

  it('respects a caller-supplied threshold', () => {
    const items = [candidate({ materiality: 0.6 })];
    expect(buildDigest(items, { since: SINCE, threshold: 0.9 }).itemCount).toBe(0);
    expect(buildDigest(items, { since: SINCE, threshold: 0.4 }).itemCount).toBe(1);
  });
});

describe('ordering and grouping', () => {
  it('puts the most material change first', () => {
    // A user who reads only the first item should get the one that matters most.
    const digest = buildDigest(
      [
        candidate({ id: 'low', dedupeKey: 'k1', materiality: 0.55, eventType: 'hiring_signal' }),
        candidate({ id: 'high', dedupeKey: 'k2', materiality: 0.95 }),
      ],
      { since: SINCE },
    );
    expect(digest.sections[0].items[0].id).toBe('high');
  });

  it('groups by entity', () => {
    const digest = buildDigest(
      [
        candidate({ id: 'a', dedupeKey: 'k1', entityLabel: 'Lilian' }),
        candidate({ id: 'b', dedupeKey: 'k2', entityLabel: 'Acme', materiality: 0.6 }),
        candidate({ id: 'c', dedupeKey: 'k3', entityLabel: 'Lilian', materiality: 0.7 }),
      ],
      { since: SINCE },
    );
    expect(digest.sections).toHaveLength(2);
    expect(digest.sections[0].entityLabel).toBe('Lilian');
    expect(digest.sections[0].items).toHaveLength(2);
  });

  it('caps a noisy week and says what it dropped', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      candidate({ id: `e${i}`, dedupeKey: `k${i}`, materiality: 0.9 - i * 0.01 }),
    );
    const digest = buildDigest(many, { since: SINCE, maxItems: 5 });
    expect(digest.itemCount).toBe(5);
    expect(digest.suppressed.filter((s) => s.reason.includes('cap'))).toHaveLength(15);
  });
});

describe('headline', () => {
  it('names the change rather than counting changes', () => {
    // "Lilian changed pricing" tells a user whether to open it; "3 changes"
    // does not.
    const digest = buildDigest([candidate()], { since: SINCE });
    expect(digest.headline).toBe('Lilian changed pricing');
  });

  it('mentions the remainder when there is more than one', () => {
    const digest = buildDigest(
      [
        candidate({ id: 'a', dedupeKey: 'k1' }),
        candidate({ id: 'b', dedupeKey: 'k2', materiality: 0.6, eventType: 'feature_launched' }),
      ],
      { since: SINCE },
    );
    expect(digest.headline).toBe('Lilian changed pricing, plus 1 other change');
  });

  it('says so plainly when nothing changed', () => {
    const digest = buildDigest([], { since: SINCE });
    expect(digest.headline).toBe('No material changes since your last visit');
    expect(shouldSend(digest)).toBe(false);
  });
});

describe('rendering', () => {
  it('includes the before/after and the reason it was judged material', () => {
    // A user has to be able to disagree with the judgment, not just trust it.
    const digest = buildDigest([candidate()], { since: SINCE });
    const text = renderDigestText(digest, 'Vector Agents');
    expect(text).toContain('$49/month → $59/month');
    expect(text).toContain('moved 20%');
    expect(text).toContain('Lilian');
  });

  it('renders an empty period without pretending something happened', () => {
    const digest = buildDigest([], { since: SINCE });
    const text = renderDigestText(digest, 'Vector Agents');
    expect(text).toContain('no material changes');
  });

  it('tells the user more was withheld', () => {
    const digest = buildDigest(
      [candidate(), candidate({ id: 'b', dedupeKey: 'k2', materiality: 0.1 })],
      { since: SINCE },
    );
    expect(renderDigestText(digest, 'Vector Agents')).toContain('were not included');
  });
});
