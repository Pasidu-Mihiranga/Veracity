import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { loadScenario, saveScenarioRun } from '@/lib/intelligence/scenario-repo';
import { runScenario } from '@/lib/intelligence/scenario-runner';
import { checkPanelAvailable, createMirofishPorts } from '@/lib/intelligence/mirofish-adapter';
import { ROUND_PURPOSE } from '@/lib/intelligence/scenario-brief';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/**
 * Run the panel against a reviewed brief.
 *
 * Availability is re-checked here even though the create route already checked
 * it: minutes may have passed while the user reviewed, and discovering the
 * worker is down after two rounds have been billed is worse than refusing at
 * the door.
 *
 * A failed run is still persisted. A scenario that ran and produced nothing is
 * a fact about the panel worth keeping — silently discarding it would leave the
 * user unable to tell a failed run from one that was never started.
 */
export async function POST(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const scenario = await loadScenario(user.id, id);
  if (!scenario) return apiError('Scenario not found', 404, 'NOT_FOUND');

  if (scenario.status === 'complete') {
    // Re-running would append a second set of rounds to the same scenario and
    // make the thread ambiguous. Branching is the supported way to explore a
    // variation.
    return apiError(
      'This scenario has already run. Branch it to explore a variation.',
      409,
      'ALREADY_RUN',
    );
  }

  let body: { product?: string; challenge?: string } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is fine — product falls back to the brief's project.
  }

  const availability = await checkPanelAvailable(body.product ?? '');
  if (!availability.ok) {
    return apiError(
      `The synthetic panel is unavailable: ${availability.reason}`,
      503,
      'PANEL_UNAVAILABLE',
    );
  }

  const ports = createMirofishPorts({ simulationId: availability.simulationId });

  const outcome = await runScenario(scenario.brief, ports, {
    challenge: body.challenge,
  });

  try {
    await saveScenarioRun({
      userId: user.id,
      scenarioId: id,
      outcome,
      roundPurposes: ROUND_PURPOSE,
      intervention: body.challenge ?? null,
    });
  } catch (err) {
    // The run happened and cost real model calls, so the result is returned
    // even if persistence failed. Losing it entirely would be the worse outcome.
    logger.error('scenario.persist_failed', {
      scenarioId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return apiSuccess({ outcome, persisted: false });
  }

  return apiSuccess({ outcome, persisted: true });
}
