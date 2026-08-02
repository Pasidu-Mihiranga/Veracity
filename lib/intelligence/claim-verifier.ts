/**
 * Claim verification.
 *
 * This is the gate between model output and stored evidence. A model asked for
 * structured JSON will fill every field it is given, so the schema alone cannot
 * distinguish "the page says $49" from "$49 is a plausible price for this kind
 * of product". The checks here look for the difference.
 *
 * The rule that matters most: a numeric claim must be traceable to a metric
 * observation, and that observation must be traceable to an excerpt. A number
 * that cannot show its excerpt is rejected before persistence, not flagged for
 * review — flagged-for-review is how fabricated numbers reach users.
 */

import type { Claim, EvidenceSpan, MetricObservation } from './types';

// ── Numeric detection ───────────────────────────────────────────────────────

/**
 * Patterns that indicate a statement is making a quantitative assertion.
 *
 * Deliberately broad. A false positive costs one extra verification lookup; a
 * false negative lets an unsupported number through, which is the failure this
 * module exists to prevent.
 */
const NUMERIC_PATTERNS: RegExp[] = [
  /\d+(?:\.\d+)?\s*%/, // 20%, 3.5 %
  /[$€£¥]\s*\d/, // $49
  /\d+(?:[.,]\d+)?\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b/i,
  /\b\d+(?:[.,]\d{3})*(?:\.\d+)?\s*(?:k|m|bn|billion|million|thousand)\b/i,
  /\b\d+(?:\.\d+)?x\b/i, // 3x growth
  /\b(?:grew|rose|fell|dropped|increased|decreased|up|down)\s+(?:by\s+)?\d/i,
];

/** True when a statement asserts a quantity that needs backing. */
export function containsNumericClaim(statement: string): boolean {
  return NUMERIC_PATTERNS.some((p) => p.test(statement));
}

/** Extract the numeric tokens a statement asserts, for matching against observations. */
export function extractNumbers(statement: string): number[] {
  const matches = statement.match(/-?\d+(?:[.,]\d+)*/g) ?? [];
  return matches
    .map((raw) => Number.parseFloat(raw.replace(/,(?=\d{3}\b)/g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

// ── Verification ────────────────────────────────────────────────────────────

export type RejectionCode =
  | 'unsupported-numeric-claim'
  | 'fact-without-evidence'
  | 'evidence-span-missing'
  | 'entity-mismatch'
  | 'excerpt-does-not-support'
  | 'stale-evidence';

export interface Rejection {
  code: RejectionCode;
  detail: string;
}

export type VerificationResult =
  | { ok: true; claim: Claim; contradicted: boolean }
  | { ok: false; rejections: Rejection[] };

export interface VerificationContext {
  /** Spans available to back this claim, keyed by id. */
  spans: Map<string, EvidenceSpan>;
  /** Observations available, keyed by the span they cite. */
  observationsBySpan: Map<string, MetricObservation[]>;
  /** Evidence older than this is treated as stale. Omit to disable the check. */
  freshnessCutoff?: Date;
}

/**
 * Verify one claim against the evidence available to it.
 *
 * Returns every reason a claim failed rather than the first, so a caller can
 * explain the whole problem to a user in one pass instead of one round trip per
 * defect.
 */
export function verifyClaim(claim: Claim, ctx: VerificationContext): VerificationResult {
  const rejections: Rejection[] = [];

  const supporting = claim.supportingSpanIds
    .map((id) => {
      const span = ctx.spans.get(id);
      if (!span) {
        rejections.push({
          code: 'evidence-span-missing',
          detail: `claim cites span ${id}, which does not exist`,
        });
      }
      return span;
    })
    .filter((s): s is EvidenceSpan => Boolean(s));

  // A fact is a statement about the world. It needs something from the world.
  if (claim.claimType === 'fact' && supporting.length === 0) {
    rejections.push({
      code: 'fact-without-evidence',
      detail: 'a fact must cite at least one supporting evidence span',
    });
  }

  // An excerpt about a different company proves nothing about this one.
  for (const span of supporting) {
    if (span.entityMatch === 'mismatch') {
      rejections.push({
        code: 'entity-mismatch',
        detail: `span ${span.id} was matched to a different entity`,
      });
    }
  }

  if (containsNumericClaim(claim.statement)) {
    const observations = supporting.flatMap((s) => ctx.observationsBySpan.get(s.id) ?? []);

    if (observations.length === 0) {
      rejections.push({
        code: 'unsupported-numeric-claim',
        detail:
          'the statement asserts a quantity but no metric observation backs it; ' +
          'a number the model produced is not evidence',
      });
    } else {
      // The observation has to be about the number actually stated. Otherwise a
      // claim can cite a real observation of an unrelated figure and pass.
      const asserted = extractNumbers(claim.statement);
      const observed = new Set(observations.map((o) => o.value));
      const anyMatch = asserted.some((n) => observed.has(n));
      if (asserted.length > 0 && !anyMatch) {
        rejections.push({
          code: 'excerpt-does-not-support',
          detail:
            `statement asserts ${asserted.join(', ')} but the cited observations ` +
            `record ${[...observed].join(', ')}`,
        });
      }
    }
  }

  if (ctx.freshnessCutoff && claim.freshestEvidenceAt) {
    if (new Date(claim.freshestEvidenceAt) < ctx.freshnessCutoff) {
      rejections.push({
        code: 'stale-evidence',
        detail: `newest supporting evidence predates ${ctx.freshnessCutoff.toISOString()}`,
      });
    }
  }

  if (rejections.length > 0) return { ok: false, rejections };

  // Contradiction is not a rejection. Sources disagreeing is information the
  // user needs; silently picking a winner is what a general chatbot does.
  return { ok: true, claim, contradicted: claim.contradictingSpanIds.length > 0 };
}

/**
 * Verify a batch, returning the survivors and the reasons for every rejection.
 *
 * Callers should surface `rejected` rather than discarding it. "Three claims
 * were dropped because no source backed their numbers" is a more useful answer
 * than a shorter list with no explanation.
 */
export function verifyClaims(
  claims: Claim[],
  ctx: VerificationContext,
): {
  verified: Claim[];
  contradicted: Claim[];
  rejected: Array<{ claim: Claim; rejections: Rejection[] }>;
} {
  const verified: Claim[] = [];
  const contradicted: Claim[] = [];
  const rejected: Array<{ claim: Claim; rejections: Rejection[] }> = [];

  for (const claim of claims) {
    const result = verifyClaim(claim, ctx);
    if (result.ok) {
      verified.push(result.claim);
      if (result.contradicted) contradicted.push(result.claim);
    } else {
      rejected.push({ claim, rejections: result.rejections });
    }
  }

  return { verified, contradicted, rejected };
}

/**
 * Downgrade confidence when evidence is thin or disputed.
 *
 * Kept deterministic on purpose. Letting the model report its own confidence is
 * how a single-source claim ends up labelled "high".
 */
export function deriveConfidence(params: {
  supportingCount: number;
  contradictingCount: number;
  allEntityMatchesConfirmed: boolean;
}): 'high' | 'medium' | 'low' {
  const { supportingCount, contradictingCount, allEntityMatchesConfirmed } = params;

  if (contradictingCount > 0) return 'low';
  if (supportingCount === 0) return 'low';
  if (supportingCount === 1) return allEntityMatchesConfirmed ? 'medium' : 'low';
  return allEntityMatchesConfirmed ? 'high' : 'medium';
}
