/**
 * Scheduled project collection.
 *
 * This is what makes the workspace *living* rather than something a user has to
 * remember to poke. The collect route runs inline for a first baseline, when
 * the user is watching; this runs the weekly refresh, when nobody is.
 *
 * The economics only work because of the no-change short circuit. A project
 * whose five tracked pages are untouched costs five HTTP requests and zero
 * model calls, so a weekly sweep across every project is affordable in a way
 * that re-researching each one would not be.
 *
 * Steps are separated so Inngest can retry a single project without repeating
 * the whole sweep — one competitor's slow site should not force every other
 * project to be collected twice.
 */

import { inngest } from '@/lib/inngest/client';
import { query } from '@/lib/db';
import { collectProject, type CollectableProject } from '@/lib/intelligence/project-collection';
import { logger } from '@/lib/logger';

type RefreshRequestedData = {
  /** Refresh one project. Omit to sweep every eligible project. */
  projectId?: string;
  userId?: string;
};

interface EligibleProject extends CollectableProject {
  user_id: string;
}

/**
 * Projects worth refreshing.
 *
 * A project with no product URL and no approved sources has nothing to collect,
 * so including it would burn a step to discover that every week. Ordering by
 * least-recently-collected means a backlog drains fairly rather than the same
 * few projects being refreshed repeatedly.
 */
async function listEligibleProjects(limit = 50): Promise<EligibleProject[]> {
  const { rows } = await query<EligibleProject & { last_collected: string | null }>(
    `SELECT p.id, p.user_id, p.product, p.product_url, p.competitors,
            p.approved_sources, p.blocked_sources, p.decision_context,
            (SELECT max(observed_at) FROM source_snapshots s WHERE s.project_id = p.id)
              AS last_collected
       FROM market_projects p
      WHERE p.product_url IS NOT NULL
         OR cardinality(p.approved_sources) > 0
      ORDER BY last_collected ASC NULLS FIRST
      LIMIT $1`,
    [limit],
  );
  return rows;
}

export const projectRefreshFn = inngest.createFunction(
  {
    id: 'project-refresh',
    name: 'Refresh market project sources',
    // One project at a time per user. A user with ten projects should not be
    // able to saturate the collector, and a slow site should delay only its
    // own project.
    concurrency: [{ key: 'event.data.userId', limit: 1 }],
    retries: 2,
    triggers: [
      { event: 'project/refresh.requested' },
      // Weekly rather than daily: the research favours a digest over noise, and
      // most tracked pages do not change within a week.
      { cron: 'TZ=UTC 0 6 * * 1' },
    ],
  },
  async ({ event, step }) => {
    const data = (event?.data ?? {}) as RefreshRequestedData;

    const projects = await step.run('list-eligible-projects', async () => {
      if (data.projectId) {
        const { rows } = await query<EligibleProject>(
          `SELECT id, user_id, product, product_url, competitors,
                  approved_sources, blocked_sources, decision_context
             FROM market_projects WHERE id = $1`,
          [data.projectId],
        );
        return rows;
      }
      return listEligibleProjects();
    });

    if (projects.length === 0) {
      return { refreshed: 0, reason: 'no eligible projects' };
    }

    let refreshed = 0;
    let failed = 0;
    let materialChanges = 0;
    let shortCircuited = 0;

    for (const project of projects) {
      // A separate step per project: Inngest retries only the one that failed,
      // rather than re-collecting every project because the last one timed out.
      const outcome = await step.run(`collect-${project.id}`, async () => {
        try {
          const result = await collectProject({
            userId: project.user_id,
            project,
          });
          return {
            ok: true as const,
            material: result.materialChanges.length,
            unchanged: result.stats.unchanged,
            checked: result.stats.sourcesChecked,
          };
        } catch (err) {
          // One project's failure must not abort the sweep. The others are
          // still worth refreshing, and a user whose project failed is better
          // served by a logged reason than by everyone's refresh being skipped.
          logger.error('project_refresh.failed', {
            projectId: project.id,
            error: err instanceof Error ? err.message : String(err),
          });
          return { ok: false as const };
        }
      });

      if (outcome.ok) {
        refreshed += 1;
        materialChanges += outcome.material;
        shortCircuited += outcome.unchanged;
      } else {
        failed += 1;
      }
    }

    logger.info('project_refresh.completed', {
      projects: projects.length,
      refreshed,
      failed,
      materialChanges,
      shortCircuited,
    });

    return { refreshed, failed, materialChanges, shortCircuited };
  },
);
