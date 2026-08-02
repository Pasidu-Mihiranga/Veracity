import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateScenarioBrief } from '@/lib/intelligence/scenario-brief';
import { saveScenarioBrief } from '@/lib/intelligence/scenario-repo';
import { checkPanelAvailable } from '@/lib/intelligence/mirofish-adapter';

export const runtime = 'nodejs';

/**
 * Create a scenario brief for review.
 *
 * Creating and running are deliberately separate calls. A synthetic panel is
 * expensive and its output is easy to misread, so the user gets to inspect the
 * alternatives, segments, facts, and assumptions before anything is spent —
 * which is the whole reason the brief exists rather than a raw prompt.
 *
 * Panel availability is checked here too, so "MIROFISH_SERVICE_TOKEN is not
 * configured" surfaces while the user is still reviewing rather than after they
 * commit to a run.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  let body: {
    projectId?: string;
    sessionId?: string;
    decisionId?: string;
    brief?: unknown;
    product?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400, 'BAD_REQUEST');
  }

  const validation = validateScenarioBrief(body.brief);
  if (!validation.ok) {
    return apiError(
      `The scenario brief is not valid: ${validation.errors.join('; ')}`,
      400,
      'INVALID_BRIEF',
    );
  }

  if (body.projectId) {
    const owned = await query(
      `SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`,
      [body.projectId, user.id],
    );
    if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');
  }

  const availability = await checkPanelAvailable(body.product ?? '');

  const saved = await saveScenarioBrief({
    userId: user.id,
    projectId: body.projectId ?? null,
    sessionId: body.sessionId ?? null,
    decisionId: body.decisionId ?? null,
    brief: validation.brief,
    modelVersion: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
    panelVersion: availability.ok ? availability.simulationId : 'unavailable',
  });

  if (!saved.ok) {
    return apiError(`Could not save the brief: ${saved.errors.join('; ')}`, 400, 'INVALID_BRIEF');
  }

  return apiSuccess({
    scenario: saved.scenario,
    // Warnings never block. A brief resting entirely on assumptions is a
    // legitimate thing to explore — it just has to be labelled as such.
    warnings: validation.warnings,
    panelAvailable: availability.ok,
    panelUnavailableReason: availability.ok ? null : availability.reason,
  });
}
