import { query } from '@/lib/db';
import {
  applyOutcomeConfidence,
  confidenceFromRecLevel,
  type DecisionOutcome,
} from '@/lib/decision-policy';

export type { DecisionOutcome } from '@/lib/decision-policy';
export { applyOutcomeConfidence, confidenceFromRecLevel } from '@/lib/decision-policy';

export type DecisionRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  session_id: string | null;
  project_id: string | null;
  title: string;
  rationale: string;
  decision: string;
  reason: string;
  outcome: DecisionOutcome;
  confidence: number;
  outcome_note: string | null;
  source_recommendation_key: string | null;
  evidence_urls: unknown;
  created_at: string;
  updated_at: string;
};

export async function upsertDecision(input: {
  userId: string;
  workspaceId?: string | null;
  sessionId?: string | null;
  title: string;
  rationale?: string;
  decision: string;
  reason?: string;
  confidence?: number;
  sourceRecommendationKey?: string | null;
  evidenceUrls?: string[];
}): Promise<DecisionRow> {
  const conf = input.confidence ?? 0.65;
  let projectId: string | null = null;
  if (input.sessionId) {
    const { rows } = await query<{ project_id: string | null }>(
      `SELECT project_id FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [input.sessionId, input.userId],
    );
    projectId = rows[0]?.project_id ?? null;
  }
  if (input.sourceRecommendationKey) {
    const { rows: existing } = await query<DecisionRow>(
      `SELECT * FROM decision_memory
       WHERE user_id = $1 AND source_recommendation_key = $2
         AND ($3::uuid IS NULL OR workspace_id = $3)
         AND project_id IS NOT DISTINCT FROM $4::uuid
       ORDER BY created_at DESC LIMIT 1`,
      [input.userId, input.sourceRecommendationKey, input.workspaceId ?? null, projectId],
    );
    if (existing[0]) {
      const { rows } = await query<DecisionRow>(
        `UPDATE decision_memory SET
           title = $1, rationale = $2, decision = $3, reason = $4,
           confidence = $5, evidence_urls = $6::jsonb, updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [
          input.title,
          input.rationale ?? '',
          input.decision,
          input.reason ?? existing[0].reason,
          conf,
          JSON.stringify(input.evidenceUrls ?? []),
          existing[0].id,
        ],
      );
      return rows[0];
    }
  }

  const { rows } = await query<DecisionRow>(
    `INSERT INTO decision_memory (
       user_id, workspace_id, session_id, project_id, title, rationale, decision, reason,
       confidence, source_recommendation_key, evidence_urls
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     RETURNING *`,
    [
      input.userId,
      input.workspaceId ?? null,
      input.sessionId ?? null,
      projectId,
      input.title,
      input.rationale ?? '',
      input.decision,
      input.reason ?? '',
      conf,
      input.sourceRecommendationKey ?? null,
      JSON.stringify(input.evidenceUrls ?? []),
    ],
  );
  return rows[0];
}

export async function listDecisions(userId: string, limit = 40): Promise<DecisionRow[]> {
  const { rows } = await query<DecisionRow>(
    `SELECT * FROM decision_memory WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(Math.max(limit, 1), 100)],
  );
  return rows;
}

export async function listProjectDecisions(
  userId: string,
  projectId: string,
  limit = 40,
): Promise<DecisionRow[]> {
  const { rows } = await query<DecisionRow>(
    `SELECT * FROM decision_memory
     WHERE user_id = $1 AND project_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [userId, projectId, Math.min(Math.max(limit, 1), 100)],
  );
  return rows;
}

export async function setDecisionOutcome(input: {
  id: string;
  userId: string;
  outcome: DecisionOutcome;
  note?: string;
}): Promise<DecisionRow | null> {
  const { rows: cur } = await query<DecisionRow>(
    `SELECT * FROM decision_memory WHERE id = $1 AND user_id = $2`,
    [input.id, input.userId],
  );
  const row = cur[0];
  if (!row) return null;
  const nextConf = applyOutcomeConfidence(Number(row.confidence), input.outcome);
  const { rows } = await query<DecisionRow>(
    `UPDATE decision_memory SET
       outcome = $1, confidence = $2, outcome_note = $3, updated_at = now()
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [input.outcome, nextConf, input.note ?? null, input.id, input.userId],
  );
  return rows[0] ?? null;
}

export function formatDecisionsForMemory(rows: DecisionRow[], limit = 8): string {
  if (!rows.length) return '';
  const lines = rows.slice(0, limit).map((d) => {
    const outcome = d.outcome !== 'pending' ? ` · outcome=${d.outcome}` : '';
    const reason = d.reason ? ` because ${d.reason}` : '';
    return `- ${d.decision.toUpperCase()}: ${d.title}${reason}${outcome} (confidence ${Number(d.confidence).toFixed(2)})`;
  });
  return `Prior decisions:\n${lines.join('\n')}`;
}
