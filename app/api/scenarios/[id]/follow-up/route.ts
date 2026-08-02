import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { pool, query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { loadScenario } from '@/lib/intelligence/scenario-repo';
import { checkPanelAvailable, createMirofishPorts } from '@/lib/intelligence/mirofish-adapter';
import { buildRoundPrompt } from '@/lib/intelligence/scenario-brief';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/**
 * Ask a follow-up of an existing panel, one segment, or one persona.
 *
 * Recorded as a further round on the same scenario rather than as a new
 * scenario. The thread is the point: "why did procurement object?" is a
 * question about the panel that already answered, and starting a fresh
 * scenario would lose the context that makes the answer meaningful.
 *
 * Scope narrows who is asked. Asking one persona is cheap and specific; asking
 * the whole panel again is neither, so the default is the narrowest scope the
 * caller specified rather than the broadest.
 */
export async function POST(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const scenario = await loadScenario(user.id, id);
  if (!scenario) return apiError('Scenario not found', 404, 'NOT_FOUND');

  if (scenario.status !== 'complete') {
    // A follow-up to a panel that never answered has nothing to follow up on.
    return apiError(
      'This scenario has not completed a run, so there is no panel to question.',
      409,
      'NOT_RUN',
    );
  }

  let body: {
    question?: string;
    scope?: 'panel' | 'segment' | 'persona';
    scopeTarget?: string;
    product?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400, 'BAD_REQUEST');
  }

  const question = body.question?.trim();
  if (!question) return apiError('A question is required', 400, 'BAD_REQUEST');

  const scope = body.scope ?? 'panel';
  const scopeTarget = scope === 'panel' ? null : body.scopeTarget?.trim() || null;
  if (scope !== 'panel' && !scopeTarget) {
    return apiError(`A ${scope} id is required for ${scope} scope`, 400, 'BAD_REQUEST');
  }

  const availability = await checkPanelAvailable(body.product ?? '');
  if (!availability.ok) {
    return apiError(
      `The synthetic panel is unavailable: ${availability.reason}`,
      503,
      'PANEL_UNAVAILABLE',
    );
  }

  // Who is being asked, and what they said before. Prior responses are scoped
  // to each persona: showing one persona another's answers would manufacture
  // the agreement the round structure exists to avoid.
  const { rows: participants } = await query<{ persona_id: string; segment_id: string }>(
    `SELECT DISTINCT persona_id, segment_id
       FROM swarm_responses
      WHERE scenario_id = $1 AND user_id = $2 AND status = 'ok'
        AND ($3::text IS NULL OR segment_id = $3 OR persona_id = $3)`,
    [id, user.id, scopeTarget],
  );

  if (participants.length === 0) {
    return apiError(
      scopeTarget
        ? `No responding persona matches "${scopeTarget}"`
        : 'This panel has no responding personas',
      404,
      'NO_PARTICIPANTS',
    );
  }

  const { rows: nextRound } = await query<{ next: number }>(
    `SELECT COALESCE(max(round), 0) + 1 AS next FROM swarm_rounds
      WHERE scenario_id = $1 AND user_id = $2`,
    [id, user.id],
  );
  const round = nextRound[0].next;

  const ports = createMirofishPorts({ simulationId: availability.simulationId });
  await ports.buildPanel(scenario.brief.targetSegments);

  const segmentsById = new Map(scenario.brief.targetSegments.map((s) => [s.id, s]));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const roundRow = await client.query<{ id: string }>(
      `INSERT INTO swarm_rounds (scenario_id, user_id, round, purpose, intervention, scope, scope_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [id, user.id, round, `Follow-up (${scope})`, question, scope, scopeTarget],
    );
    const roundId = roundRow.rows[0].id;

    let answered = 0;
    let failed = 0;

    for (const participant of participants) {
      const segment = segmentsById.get(participant.segment_id);
      if (!segment) {
        failed += 1;
        continue;
      }

      const { rows: prior } = await client.query<{ round: number; response: string }>(
        `SELECT r.round, resp.response
           FROM swarm_responses resp
           JOIN swarm_rounds r ON r.id = resp.round_id
          WHERE resp.scenario_id = $1 AND resp.persona_id = $2 AND resp.status = 'ok'
          ORDER BY r.round`,
        [id, participant.persona_id],
      );

      const prompt = [
        buildRoundPrompt({
          brief: scenario.brief,
          round: 3,
          segment,
          priorResponses: prior,
        }),
        '',
        `Follow-up question: ${question}`,
      ].join('\n');

      try {
        const answer = await ports.ask({
          persona: { personaId: participant.persona_id, segmentId: participant.segment_id },
          prompt,
          round: 3,
        });

        await client.query(
          `INSERT INTO swarm_responses
             (round_id, scenario_id, user_id, persona_id, segment_id, response, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'ok')`,
          [roundId, id, user.id, participant.persona_id, participant.segment_id, answer.response],
        );
        answered += 1;
      } catch (err) {
        // Recorded as a failure rather than omitted, so a partial follow-up
        // reads as partial instead of as a smaller panel.
        await client.query(
          `INSERT INTO swarm_responses
             (round_id, scenario_id, user_id, persona_id, segment_id, response, status, failure_reason)
           VALUES ($1, $2, $3, $4, $5, '', 'failed', $6)`,
          [
            roundId, id, user.id, participant.persona_id, participant.segment_id,
            err instanceof Error ? err.message : String(err),
          ],
        );
        failed += 1;
      }
    }

    await client.query('COMMIT');
    return apiSuccess({ round, scope, scopeTarget, asked: participants.length, answered, failed });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
