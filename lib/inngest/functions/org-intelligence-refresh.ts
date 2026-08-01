import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { inngest } from '@/lib/inngest/client';
import { refreshContinuousBoardPack } from '@/lib/continuous-intelligence/board-refresh';

export const orgIntelligenceRefreshFn = inngest.createFunction(
  {
    id: 'org-intelligence-refresh',
    retries: 2,
    triggers: [{ cron: '0 10 * * 1' }],
  },
  async ({ step }) => {
    if (!featureFlags.workspaces || !featureFlags.orgIntelligence ||
        !featureFlags.continuousIntelligence) {
      return { skipped: true, reason: 'enterprise-flags-disabled' };
    }
    const workspaces = await step.run('list-active-workspaces', async () => {
      const { rows } = await query<{ workspace_id: string; user_id: string }>(
        `SELECT DISTINCT ON (m.workspace_id) m.workspace_id, m.user_id
         FROM workspace_members m
         JOIN watchlists w ON w.workspace_id = m.workspace_id AND w.enabled = true
         WHERE m.role IN ('owner', 'admin')
         ORDER BY m.workspace_id, CASE m.role WHEN 'owner' THEN 0 ELSE 1 END
         LIMIT 100`,
      );
      return rows;
    });
    const refreshed = await step.run('refresh-board-packs', async () =>
      Promise.allSettled(
        workspaces.map((workspace) =>
          refreshContinuousBoardPack({
            userId: workspace.user_id,
            workspaceId: workspace.workspace_id,
            periodDays: 30,
            refreshReason: 'scheduled',
          }),
        ),
      ),
    );
    return {
      workspaces: workspaces.length,
      refreshed: refreshed.filter((result) => result.status === 'fulfilled').length,
      failed: refreshed.filter((result) => result.status === 'rejected').length,
    };
  },
);

