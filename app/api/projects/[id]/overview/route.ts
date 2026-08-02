import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');
  const { id } = await context.params;
  const owned = await query(`SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`, [id, user.id]);
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  const [conversations, snapshots, events, decisions] = await Promise.all([
    query<{ count: string }>(`SELECT count(*)::text AS count FROM chat_sessions WHERE project_id = $1`, [id]),
    query<{
      id: string; product: string; competitor: string | null; summary: string;
      source_count: number; evidence_score: number | null; generated_at: string; total_count: number;
    }>(
      `SELECT id, product, competitor, summary, source_count, evidence_score, generated_at,
              count(*) OVER ()::int AS total_count
       FROM project_research_snapshots WHERE project_id = $1
       ORDER BY generated_at DESC LIMIT 10`,
      [id],
    ),
    query<{
      id: string; title: string; details: { added?: string[]; removed?: string[] }; observed_at: string;
    }>(
      `SELECT id, title, details, observed_at FROM project_research_events
       WHERE project_id = $1 ORDER BY observed_at DESC LIMIT 10`,
      [id],
    ),
    query<{ total: string; open: string }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE outcome = 'pending')::text AS open
       FROM decision_memory WHERE project_id = $1`,
      [id],
    ),
  ]);

  return apiSuccess({
    conversationCount: Number(conversations.rows[0]?.count ?? 0),
    researchRunCount: snapshots.rows[0]?.total_count ?? 0,
    decisionCount: Number(decisions.rows[0]?.total ?? 0),
    openDecisionCount: Number(decisions.rows[0]?.open ?? 0),
    latestSnapshot: snapshots.rows[0] ?? null,
    recentSnapshots: snapshots.rows,
    coverageEvents: events.rows,
  });
}
