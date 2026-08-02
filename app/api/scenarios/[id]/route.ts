import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import {
  loadScenario,
  loadScenarioResponses,
  loadScenarioLineage,
} from '@/lib/intelligence/scenario-repo';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

/**
 * Load a scenario with every persona response and its version lineage.
 *
 * Responses come back in full rather than summarised: a user must be able to
 * read what a persona actually said instead of trusting a distribution chart.
 * The lineage is included because comparing a branch against its base is the
 * entire point of branching — without it a branch is just another disposable
 * run.
 */
export async function GET(_req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;

  // Ownership-scoped: a scenario belonging to someone else returns 404 rather
  // than 403, so the response does not confirm the id exists.
  const scenario = await loadScenario(user.id, id);
  if (!scenario) return apiError('Scenario not found', 404, 'NOT_FOUND');

  const [responses, lineage] = await Promise.all([
    loadScenarioResponses(user.id, id),
    loadScenarioLineage(user.id, id),
  ]);

  return apiSuccess({ scenario, responses, lineage });
}
