import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

/**
 * Entity match correction.
 *
 * Entity matching is a heuristic, and when it is wrong the failure is severe:
 * evidence about a different company gets attached to a competitor and every
 * claim resting on it inherits the error. The user is the only reliable arbiter
 * of "that Lilian is the design agency, not the AI company", so they need a way
 * to say so.
 *
 * A correction to `mismatch` does not delete the span. The excerpt was really
 * retrieved and the record of having looked is worth keeping — what changes is
 * that it stops supporting claims, stops reaching the digest, and is excluded
 * from the evidence pack agents see.
 */

export async function GET(_req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const owned = await query(
    `SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  // Spans needing review first — unverified and probable are where a wrong
  // match is most likely to be hiding.
  const { rows } = await query(
    `SELECT s.id, s.excerpt, s.entity_match, s.extraction_type, s.created_at,
            snap.source_url, ent.display_name AS entity_label
       FROM evidence_spans s
       JOIN source_snapshots snap ON snap.id = s.snapshot_id
       LEFT JOIN canonical_entities ent ON ent.id = snap.entity_id
      WHERE s.user_id = $1 AND s.project_id = $2
      ORDER BY
        CASE s.entity_match
          WHEN 'mismatch' THEN 0
          WHEN 'unverified' THEN 1
          WHEN 'probable' THEN 2
          ELSE 3
        END,
        s.created_at DESC
      LIMIT 100`,
    [user.id, id],
  );

  return apiSuccess({ spans: rows });
}

const VALID_MATCHES = new Set(['confirmed', 'probable', 'unverified', 'mismatch']);

export async function PATCH(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const owned = await query(
    `SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  let body: { spanId?: string; entityMatch?: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400, 'BAD_REQUEST');
  }

  if (!body.spanId) return apiError('A span id is required', 400, 'BAD_REQUEST');
  if (!body.entityMatch || !VALID_MATCHES.has(body.entityMatch)) {
    return apiError(
      `entityMatch must be one of: ${[...VALID_MATCHES].join(', ')}`,
      400,
      'BAD_REQUEST',
    );
  }

  const { rows } = await query<{ id: string }>(
    `UPDATE evidence_spans
        SET entity_match = $1
      WHERE id = $2 AND user_id = $3 AND project_id = $4
      RETURNING id`,
    [body.entityMatch, body.spanId, user.id, id],
  );

  if (rows.length === 0) return apiError('Evidence span not found', 404, 'NOT_FOUND');

  // Marking a span as a mismatch has to reach the claims that leaned on it, or
  // the correction is cosmetic: the span stops supporting them but they keep
  // their old confidence and stay in the ledger looking established.
  let downgradedClaims = 0;
  if (body.entityMatch === 'mismatch') {
    const affected = await query<{ id: string }>(
      `UPDATE claims
          SET claim_type = 'interpretation', confidence = 'low'
        WHERE user_id = $1 AND project_id = $2
          AND claim_type = 'fact'
          AND $3 = ANY(supporting_span_ids)
        RETURNING id`,
      [user.id, id, body.spanId],
    );
    downgradedClaims = affected.rows.length;
  }

  return apiSuccess({
    spanId: body.spanId,
    entityMatch: body.entityMatch,
    // Reported so the UI can say "3 claims were downgraded" rather than the
    // correction appearing to do nothing.
    downgradedClaims,
  });
}
