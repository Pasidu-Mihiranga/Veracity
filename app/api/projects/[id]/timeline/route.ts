import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

/**
 * The competitor activity timeline, and the source verification matrix.
 *
 * Distinct from the dashboard digest: the digest answers "what should I look at
 * since last time" and applies materiality gates. This answers "what has
 * happened at all", and deliberately includes changes below the alert
 * threshold. A user investigating a competitor needs the quiet moves too — the
 * gates exist to protect attention, not to hide history.
 *
 * The matrix reports which source types have actually been collected per
 * entity, with the age of each. It is coverage, not features: claiming a
 * feature comparison the ledger cannot support would be exactly the fabrication
 * this product exists to avoid. What it can honestly say is "we have looked at
 * their pricing page, we have never seen their changelog" — which is the
 * information a user needs to judge how much the rest is worth.
 */
export async function GET(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const owned = await query(
    `SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 300);

  const [events, coverage] = await Promise.all([
    query(
      `SELECT e.id, e.event_type, e.before_value, e.after_value, e.observed_at,
              e.effective_at, e.materiality::float8 AS materiality,
              e.materiality_reason, e.confidence, e.evidence_span_id,
              ent.display_name AS entity_label
         FROM change_events e
         LEFT JOIN canonical_entities ent ON ent.id = e.entity_id
        WHERE e.project_id = $1 AND e.user_id = $2
        ORDER BY e.observed_at DESC
        LIMIT $3`,
      [id, user.id, limit],
    ),
    // One row per entity per source type, with how fresh it is. NULLs here are
    // the interesting part: a source type never collected is a coverage gap.
    query(
      `SELECT ent.id AS entity_id, ent.display_name AS entity_label,
              snap.source_type,
              max(snap.observed_at) AS last_seen,
              count(DISTINCT snap.id)::int AS snapshot_count,
              count(DISTINCT s.id)::int AS span_count
         FROM canonical_entities ent
         LEFT JOIN source_snapshots snap
           ON snap.entity_id = ent.id AND snap.project_id = $1
         LEFT JOIN evidence_spans s ON s.snapshot_id = snap.id
        WHERE ent.user_id = $2 AND ent.scope_key = $3
        GROUP BY ent.id, ent.display_name, snap.source_type
        ORDER BY ent.display_name, snap.source_type`,
      [id, user.id, `project:${id}`],
    ),
  ]);

  return apiSuccess({
    events: events.rows,
    coverage: coverage.rows,
  });
}
