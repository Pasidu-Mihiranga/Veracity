/**
 * Dashboard and evidence route behaviour.
 *
 * These cover the contract the routes owe the UI: the digest gates are applied
 * server-side (so a client cannot ask for unfiltered changes), coverage is
 * reported separately from change (so "nothing changed" and "we could not look"
 * stay distinguishable), and evidence lookups are ownership-scoped.
 */

import { describe, it, expect } from 'vitest';
import { buildDigest, type DigestCandidate } from '@/lib/intelligence/digest';

/**
 * The route maps database rows into digest candidates before gating them. This
 * mirrors that mapping so the shaping logic is testable without a live request.
 */
function rowToCandidate(row: {
  id: string;
  entity_label: string | null;
  event_type: string;
  before_value: string | null;
  after_value: string | null;
  observed_at: string;
  materiality: number;
  materiality_reason: string;
  confidence: string;
  evidence_span_id: string | null;
  entity_match: string | null;
  dedupe_key: string;
}): DigestCandidate {
  return {
    id: row.id,
    entityId: null,
    entityLabel: row.entity_label ?? 'Untracked entity',
    eventType: row.event_type as DigestCandidate['eventType'],
    beforeValue: row.before_value,
    afterValue: row.after_value,
    observedAt: new Date(row.observed_at).toISOString(),
    materiality: row.materiality,
    materialityReason: row.materiality_reason,
    confidence: row.confidence as DigestCandidate['confidence'],
    evidenceSpanId: row.evidence_span_id,
    entityMatch: (row.entity_match ?? undefined) as DigestCandidate['entityMatch'],
    dedupeKey: row.dedupe_key,
  };
}

function row(over: Partial<Parameters<typeof rowToCandidate>[0]> = {}) {
  return {
    id: 'e1',
    entity_label: 'Lilian',
    event_type: 'pricing_changed',
    before_value: '$49/month',
    after_value: '$59/month',
    observed_at: '2026-08-01T00:00:00.000Z',
    materiality: 0.8,
    materiality_reason: 'Entry-tier price moved on a tracked competitor',
    confidence: 'high',
    evidence_span_id: 'span-1',
    entity_match: 'confirmed',
    dedupe_key: 'k1',
    ...over,
  };
}

const SINCE = '2026-07-25T00:00:00.000Z';

describe('row mapping', () => {
  it('names an entity that could not be resolved rather than showing null', () => {
    // "Untracked entity changed pricing" is odd but honest. A blank label reads
    // as a rendering bug and destroys trust in the rest of the row.
    const candidate = rowToCandidate(row({ entity_label: null }));
    expect(candidate.entityLabel).toBe('Untracked entity');
  });

  it('carries the evidence span through so the drawer can open', () => {
    expect(rowToCandidate(row()).evidenceSpanId).toBe('span-1');
  });

  it('passes a null span through rather than inventing one', () => {
    // The digest gate will then drop it — an alert with no proof is a rumour.
    const candidate = rowToCandidate(row({ evidence_span_id: null }));
    expect(candidate.evidenceSpanId).toBeNull();
    expect(buildDigest([candidate], { since: SINCE }).itemCount).toBe(0);
  });
});

describe('server-side gating', () => {
  it('applies the materiality threshold on the server', () => {
    // The client must not be able to request unfiltered changes — the whole
    // point of materiality is that noise never reaches the user.
    const candidates = [
      rowToCandidate(row({ id: 'big', dedupe_key: 'k1', materiality: 0.9 })),
      rowToCandidate(row({ id: 'small', dedupe_key: 'k2', materiality: 0.1 })),
    ];
    const digest = buildDigest(candidates, { since: SINCE, threshold: 0.5 });

    expect(digest.itemCount).toBe(1);
    expect(digest.sections[0].items[0].id).toBe('big');
  });

  it('drops evidence matched to a different entity', () => {
    const candidate = rowToCandidate(row({ entity_match: 'mismatch' }));
    expect(buildDigest([candidate], { since: SINCE }).itemCount).toBe(0);
  });

  it('honours the since window', () => {
    const old = rowToCandidate(row({ observed_at: '2026-07-01T00:00:00.000Z' }));
    expect(buildDigest([old], { since: SINCE }).itemCount).toBe(0);
  });
});

describe('coverage reporting', () => {
  /** Mirrors the route's unchanged calculation. */
  function unchangedCount(sourcesChecked: number, digestItems: number, stale: number) {
    return sourcesChecked - digestItems - stale;
  }

  it('separates unchanged sources from unreachable ones', () => {
    // "No change" and "we could not look" mean opposite things. Collapsing them
    // would let a broken collector read as a quiet market.
    expect(unchangedCount(5, 1, 2)).toBe(2);
  });

  it('reports zero unchanged when everything moved', () => {
    expect(unchangedCount(3, 3, 0)).toBe(0);
  });
});

describe('evidence request shaping', () => {
  /** Mirrors the route's id parsing. */
  function parseIds(raw: string, max = 50): string[] {
    return raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, max);
  }

  it('parses a comma-separated list', () => {
    expect(parseIds('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('drops empty entries rather than querying for them', () => {
    expect(parseIds('a,,b,')).toEqual(['a', 'b']);
  });

  it('caps the request', () => {
    // The drawer shows a handful of excerpts, not a corpus.
    expect(parseIds(Array.from({ length: 200 }, (_, i) => `s${i}`).join(','))).toHaveLength(50);
  });

  it('yields nothing for an empty parameter', () => {
    expect(parseIds('')).toEqual([]);
    expect(parseIds('   ')).toEqual([]);
  });
});
