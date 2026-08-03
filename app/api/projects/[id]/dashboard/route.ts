import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { buildDigest, type DigestCandidate } from '@/lib/intelligence/digest';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

/**
 * The returning-user dashboard: what changed since the caller last looked.
 *
 * `since` is supplied by the client from its own last-visit marker rather than
 * being inferred server-side, so a user who opens the project twice in a day
 * still sees the week's changes instead of an empty screen. Defaults to seven
 * days when absent.
 *
 * Everything is scoped by `user_id` as well as `project_id`. Project ownership
 * is checked first, but repeating the predicate on each query means a future
 * refactor that loses the ownership check still cannot return another user's
 * rows.
 */
export async function GET(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const owned = await query(
    `SELECT id, name, decision_context FROM market_projects WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = sinceParam && !Number.isNaN(Date.parse(sinceParam))
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 7 * 86_400_000).toISOString();

  const thresholdParam = Number(req.nextUrl.searchParams.get('threshold'));
  const threshold = Number.isFinite(thresholdParam) && thresholdParam > 0 && thresholdParam <= 1
    ? thresholdParam
    : 0.5;

  const [changes, freshness] = await Promise.all([
    query<{
      id: string; entity_id: string | null; entity_label: string | null;
      event_type: string; before_value: string | null; after_value: string | null;
      observed_at: string; materiality: number; materiality_reason: string;
      confidence: string; evidence_span_id: string | null; entity_match: string | null;
      dedupe_key: string;
    }>(
      `SELECT e.id, e.entity_id, ent.display_name AS entity_label, e.event_type,
              e.before_value, e.after_value, e.observed_at,
              e.materiality::float8 AS materiality, e.materiality_reason,
              e.confidence, e.evidence_span_id, span.entity_match, e.dedupe_key
         FROM change_events e
         LEFT JOIN canonical_entities ent ON ent.id = e.entity_id
         LEFT JOIN evidence_spans span ON span.id = e.evidence_span_id
        WHERE e.project_id = $1 AND e.user_id = $2
        ORDER BY e.observed_at DESC
        LIMIT 200`,
      [id, user.id],
    ),
    // Coverage, so the UI can distinguish "nothing changed" from "we could not
    // look" — which mean opposite things and must never be collapsed.
    query<{ source_url: string; observed_at: string; retrieval_status: string }>(
      `SELECT DISTINCT ON (source_url) source_url, observed_at, retrieval_status
         FROM source_snapshots
        WHERE project_id = $1 AND user_id = $2
        ORDER BY source_url, observed_at DESC`,
      [id, user.id],
    ),
  ]);

  const candidates: DigestCandidate[] = changes.rows.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
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
  }));

  const digest = buildDigest(candidates, { since, threshold });

  const staleSources = freshness.rows
    .filter((row) => row.retrieval_status !== 'ok')
    .map((row) => ({ url: row.source_url, detail: row.retrieval_status }));

  return apiSuccess({
    projectName: owned.rows[0].name as string,
    digest,
    staleSources,
    sourcesChecked: freshness.rows.length,
    unchangedCount: freshness.rows.length - digest.itemCount - staleSources.length,
  });
}
