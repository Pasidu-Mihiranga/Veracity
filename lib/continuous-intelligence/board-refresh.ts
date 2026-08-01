import { query } from '@/lib/db';
import {
  continuousScopeKey,
  stableContentHash,
  type ContinuousScope,
} from '@/lib/continuous-intelligence/entity-utils';

// Re-export pure types and functions from the DB-free utility module
// so existing imports from this file continue to work.
export {
  assembleContinuousBoardPack,
  type BoardPackSnapshotRow,
  type ContinuousBoardPack,
} from '@/lib/continuous-intelligence/board-utils';

import type {
  BoardPackSnapshotRow,
  ContinuousBoardPack,
} from '@/lib/continuous-intelligence/board-utils';
import { assembleContinuousBoardPack } from '@/lib/continuous-intelligence/board-utils';

export async function buildContinuousBoardPack(
  scope: ContinuousScope,
  periodDays = 30,
  now = new Date(),
): Promise<ContinuousBoardPack> {
  const safeDays = Math.min(Math.max(Math.floor(periodDays), 1), 90);
  const eventScope = scope.workspaceId
    ? { sql: 'workspace_id = $1', params: [scope.workspaceId] }
    : { sql: 'user_id = $1', params: [scope.userId] };
  const { rows: events } = await query<{
    event_date: string;
    competitor: string;
    title: string;
    summary: string;
    category: string;
    severity: 'high' | 'medium' | 'low';
    materiality_score: number;
    source_urls: unknown;
  }>(
    `SELECT event_date::text, competitor, title, summary, category, severity,
            materiality_score, source_urls
     FROM competitive_events
     WHERE ${eventScope.sql}
       AND event_date >= CURRENT_DATE - $2::int
     ORDER BY event_date DESC, materiality_score DESC, created_at DESC
     LIMIT 200`,
    [...eventScope.params, safeDays],
  );
  const decisionScope = scope.workspaceId
    ? { sql: 'workspace_id = $1', params: [scope.workspaceId] }
    : { sql: 'user_id = $1', params: [scope.userId] };
  const { rows: decisions } = await query<{
    title: string;
    decision: string;
    outcome: string;
    reason: string;
    confidence: number;
    created_at: string;
  }>(
    `SELECT title, decision, outcome, reason, confidence, created_at
     FROM decision_memory
     WHERE ${decisionScope.sql}
       AND created_at >= now() - ($2::int * interval '1 day')
     ORDER BY created_at DESC
     LIMIT 50`,
    [...decisionScope.params, safeDays],
  );
  return assembleContinuousBoardPack(events, decisions, safeDays, now);
}

export async function refreshContinuousBoardPack(input: ContinuousScope & {
  periodDays?: number;
  refreshReason?: 'monitoring-event' | 'scheduled' | 'manual' | 'decision-update';
}): Promise<BoardPackSnapshotRow> {
  const periodDays = input.periodDays ?? 30;
  const pack = await buildContinuousBoardPack(input, periodDays);
  const periodEnd = new Date(pack.generatedAt);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - periodDays);
  const content = {
    ...pack,
    generatedAt: undefined,
  };
  const hash = stableContentHash(content);
  const { rows } = await query<BoardPackSnapshotRow>(
    `INSERT INTO board_pack_snapshots (
       user_id, workspace_id, scope_key, period_start, period_end, pack,
       event_count, decision_count, content_hash, refresh_reason, generated_at
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
     ON CONFLICT (scope_key, period_start, period_end, content_hash) DO UPDATE SET
       refresh_reason = EXCLUDED.refresh_reason,
       generated_at = EXCLUDED.generated_at,
       pack = EXCLUDED.pack
     RETURNING *`,
    [
      input.userId,
      input.workspaceId ?? null,
      continuousScopeKey(input),
      periodStart.toISOString().slice(0, 10),
      periodEnd.toISOString().slice(0, 10),
      JSON.stringify(pack),
      pack.operatingMetrics.eventCount,
      pack.operatingMetrics.decisionCount,
      hash,
      input.refreshReason ?? 'manual',
      pack.generatedAt,
    ],
  );
  return rows[0];
}

export async function getLatestContinuousBoardPack(
  scope: ContinuousScope,
): Promise<BoardPackSnapshotRow | null> {
  const { rows } = await query<BoardPackSnapshotRow>(
    `SELECT * FROM board_pack_snapshots
     WHERE scope_key = $1
     ORDER BY generated_at DESC
     LIMIT 1`,
    [continuousScopeKey(scope)],
  );
  return rows[0] ?? null;
}


