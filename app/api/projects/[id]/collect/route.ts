import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { collectProject, type CollectableProject } from '@/lib/intelligence/project-collection';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/**
 * Collect a project's sources into the evidence ledger.
 *
 * This is what makes the dashboard populate. Everything upstream — connectors,
 * snapshots, diffing, materiality — existed but had no caller in the running
 * app, so a real project's dashboard would have stayed empty indefinitely.
 *
 * Runs inline rather than as a background job. A first collection is the moment
 * a user is most likely to be watching, and a job id they have to poll is worse
 * than a wait they can see. Scheduled refreshes are the case that belongs in a
 * queue, and that is tracked separately.
 */
export async function POST(_req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;

  const owned = await query<CollectableProject>(
    `SELECT id, product, product_url, competitors, approved_sources,
            blocked_sources, decision_context
       FROM market_projects
      WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  const project = owned.rows[0];
  if (!project) return apiError('Project not found', 404, 'NOT_FOUND');

  const hasSomethingToCollect =
    Boolean(project.product_url) || (project.approved_sources?.length ?? 0) > 0;

  if (!hasSomethingToCollect) {
    // Refused with a specific instruction rather than returning an empty run
    // that looks like "we looked and found nothing".
    return apiError(
      'This project has no product URL and no approved sources, so there is nothing to collect. ' +
        'Add a product URL or approve at least one source first.',
      400,
      'NO_SOURCES',
    );
  }

  const result = await collectProject({ userId: user.id, project });

  return apiSuccess({
    stats: result.stats,
    sourcesConsidered: result.sourcesConsidered,
    materialChanges: result.materialChanges.length,
    // Per-source outcomes travel back so the UI can name what could not be
    // reached. "No change" and "we could not look" mean opposite things.
    outcomes: result.outcomes,
  });
}
