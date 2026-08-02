/**
 * Persistence for Swarm Decision Lab scenarios.
 *
 * The point of storing all of this is that a panel becomes something a user can
 * come back to: read what an individual persona actually said, ask a segment a
 * follow-up, and compare a branch against its base. The previous path ran a
 * panel, streamed a result, and forgot it, which made the lab a novelty.
 *
 * The hard boundary: nothing written here is evidence. These rows are never
 * joined into `evidence_spans`, never cited as sources, and never raise the
 * confidence of an observed claim.
 */

import { pool, query } from '@/lib/db';
import {
  validateScenarioBrief,
  scenarioCacheKey,
  type ScenarioBrief,
} from './scenario-brief';
import type { ScenarioOutcome, PersonaResponseRecord } from './scenario-runner';

export interface SavedScenario {
  id: string;
  version: number;
  cacheKey: string;
}

/**
 * Persist a reviewed brief.
 *
 * Validation happens here rather than at the call site, so an unreviewed or
 * malformed brief cannot reach the panel whatever path produced it.
 */
export async function saveScenarioBrief(params: {
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  decisionId?: string | null;
  brief: unknown;
  modelVersion: string;
  panelVersion: string;
}): Promise<{ ok: true; scenario: SavedScenario } | { ok: false; errors: string[] }> {
  const validation = validateScenarioBrief(params.brief);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const brief = validation.brief;
  const cacheKey = scenarioCacheKey({
    brief,
    modelVersion: params.modelVersion,
    panelVersion: params.panelVersion,
  });

  const { rows } = await query<{ id: string }>(
    `INSERT INTO swarm_scenarios
       (user_id, project_id, session_id, decision_id, brief, version,
        parent_version, branch_reason, model_version, panel_version,
        evidence_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
     RETURNING id`,
    [
      params.userId, params.projectId ?? null, params.sessionId ?? null,
      params.decisionId ?? null, JSON.stringify(brief), brief.version,
      brief.parentVersion, brief.branchReason, params.modelVersion,
      params.panelVersion, cacheKey.split(':').pop() ?? '',
    ],
  );

  return { ok: true, scenario: { id: rows[0].id, version: brief.version, cacheKey } };
}

/**
 * Persist a completed run: rounds and every persona response, in one
 * transaction.
 *
 * All-or-nothing on purpose. A scenario with round 1 stored and round 3 missing
 * would render as a panel that mysteriously stopped answering, and a user would
 * have no way to tell that from a panel that genuinely deadlocked.
 */
export async function saveScenarioRun(params: {
  userId: string;
  scenarioId: string;
  outcome: ScenarioOutcome;
  roundPurposes: Record<number, string>;
  intervention?: string | null;
}): Promise<{ roundIds: string[]; responseCount: number }> {
  const { userId, scenarioId, outcome } = params;

  const client = await pool.connect();
  const roundIds: string[] = [];
  let responseCount = 0;

  try {
    await client.query('BEGIN');

    const rounds = [...new Set(outcome.responses.map((r) => r.round))].sort();

    for (const round of rounds) {
      const roundRow = await client.query<{ id: string }>(
        `INSERT INTO swarm_rounds
           (scenario_id, user_id, round, purpose, intervention, scope)
         VALUES ($1, $2, $3, $4, $5, 'panel')
         ON CONFLICT (scenario_id, round, scope, scope_target) DO UPDATE
           SET purpose = EXCLUDED.purpose
         RETURNING id`,
        [
          scenarioId, userId, round, params.roundPurposes[round] ?? '',
          round === 2 ? (params.intervention ?? null) : null,
        ],
      );
      const roundId = roundRow.rows[0].id;
      roundIds.push(roundId);

      for (const response of outcome.responses.filter((r) => r.round === round)) {
        await client.query(
          `INSERT INTO swarm_responses
             (round_id, scenario_id, user_id, persona_id, segment_id, response,
              chosen_alternative_id, blocking_objection, missing_information,
              changed_from_alternative_id, status, failure_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            roundId, scenarioId, userId, response.personaId, response.segmentId,
            response.response, response.chosenAlternativeId,
            response.blockingObjection, response.missingInformation,
            changedFrom(outcome, response), response.status,
            response.failureReason ?? null,
          ],
        );
        responseCount += 1;
      }
    }

    await client.query(
      `UPDATE swarm_scenarios
          SET status = $2, failure_reason = $3, updated_at = now()
        WHERE id = $1 AND user_id = $4`,
      [
        scenarioId,
        outcome.status === 'failed' ? 'failed' : 'complete',
        outcome.status === 'failed' ? (outcome.distributionWithheldReason ?? null) : null,
        userId,
      ],
    );

    await client.query('COMMIT');
    return { roundIds, responseCount };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function changedFrom(
  outcome: ScenarioOutcome,
  response: PersonaResponseRecord,
): string | null {
  if (response.round !== 3) return null;
  return outcome.positionChanges.find((c) => c.personaId === response.personaId)?.from ?? null;
}

/** Load a scenario and its stored brief. */
export async function loadScenario(userId: string, scenarioId: string) {
  const { rows } = await query(
    `SELECT id, project_id, session_id, decision_id, brief, version, parent_version,
            branch_reason, model_version, panel_version, status, failure_reason,
            created_at, updated_at
       FROM swarm_scenarios
      WHERE id = $1 AND user_id = $2`,
    [scenarioId, userId],
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    projectId: row.project_id as string | null,
    sessionId: row.session_id as string | null,
    decisionId: row.decision_id as string | null,
    brief: row.brief as ScenarioBrief,
    version: row.version as number,
    parentVersion: row.parent_version as number | null,
    branchReason: row.branch_reason as string | null,
    modelVersion: row.model_version as string,
    panelVersion: row.panel_version as string,
    status: row.status as 'draft' | 'running' | 'complete' | 'failed',
    failureReason: row.failure_reason as string | null,
  };
}

/**
 * Every response for a scenario, ordered so a persona's thread reads in
 * sequence.
 *
 * Ordering by persona then round rather than by round then persona is
 * deliberate: the useful reading is "what did this persona think over time",
 * which is the question a follow-up is usually chasing.
 */
export async function loadScenarioResponses(userId: string, scenarioId: string) {
  const { rows } = await query(
    `SELECT r.round, resp.persona_id, resp.segment_id, resp.response,
            resp.chosen_alternative_id, resp.blocking_objection,
            resp.missing_information, resp.changed_from_alternative_id,
            resp.status, resp.failure_reason, resp.created_at
       FROM swarm_responses resp
       JOIN swarm_rounds r ON r.id = resp.round_id
      WHERE resp.scenario_id = $1 AND resp.user_id = $2
      ORDER BY resp.persona_id, r.round`,
    [scenarioId, userId],
  );
  return rows;
}

/**
 * All versions of a scenario lineage, so a branch can be compared to its base.
 *
 * Comparison is the entire point of branching. Without this the branch is just
 * another disposable run.
 */
export async function loadScenarioLineage(userId: string, rootId: string) {
  const { rows } = await query(
    `SELECT id, version, parent_version, branch_reason, status, created_at
       FROM swarm_scenarios
      WHERE user_id = $1
        AND (id = $2 OR brief->>'id' = (SELECT brief->>'id' FROM swarm_scenarios WHERE id = $2))
      ORDER BY version ASC`,
    [userId, rootId],
  );
  return rows;
}

/** Scenarios attached to a decision, newest version first. */
export async function loadScenariosForDecision(userId: string, decisionId: string) {
  const { rows } = await query(
    `SELECT id, brief, version, status, created_at
       FROM swarm_scenarios
      WHERE user_id = $1 AND decision_id = $2
      ORDER BY version DESC`,
    [userId, decisionId],
  );
  return rows;
}
