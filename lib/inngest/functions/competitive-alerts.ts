import { inngest } from '@/lib/inngest/client';
import { featureFlags } from '@/lib/feature-flags';
import {
  createResearchJob,
  newExecutionId,
} from '@/lib/research-jobs';
import {
  getWatchlistForUser,
  listEnabledMonitoringTargets,
  listWatchlistItems,
} from '@/lib/watchlists';

type RunRequestedData = {
  userId?: string;
  watchlistId?: string;
};

async function enqueueTargets(
  targets: Array<{ userId: string; watchlistId: string; product: string; competitor: string }>,
) {
  for (const t of targets) {
    const executionId = newExecutionId();
    const queryText = `What changed for ${t.product} vs ${t.competitor} this week? Focus on pricing, launches, features, hiring, and funding.`;
    const job = await createResearchJob({
      userId: t.userId,
      executionId,
      request: {
        kind: 'monitoring',
        query: queryText,
        history: [],
        selectedAgents: ['competitive', 'market-trends', 'pricing', 'adjacent'],
        forceFullSweep: false,
        followUpMode: 'full',
        product: t.product,
        competitor: t.competitor,
        watchlistId: t.watchlistId,
      },
    });
    await inngest.send({
      name: 'research/sweep.requested',
      data: {
        jobId: job.id,
        executionId,
        userId: t.userId,
        query: queryText,
        history: [],
        selectedAgents: ['competitive', 'market-trends', 'pricing', 'adjacent'],
        forceFullSweep: false,
        followUpMode: 'full',
        watchlistId: t.watchlistId,
        product: t.product,
        competitor: t.competitor,
        kind: 'monitoring',
      },
    });
  }
}

export const competitiveAlertsFn = inngest.createFunction(
  {
    id: 'competitive-alerts',
    retries: 0,
    triggers: [
      { cron: '0 9 * * 1' },
      { event: 'monitoring/run.requested' },
    ],
  },
  async ({ event, step }) => {
    if (!featureFlags.alerts) {
      return { skipped: true, reason: 'ff_alerts_off' };
    }

    const data = (event?.data ?? {}) as RunRequestedData;

    const targets = await step.run('resolve-targets', async () => {
      if (data.userId && data.watchlistId) {
        const wl = await getWatchlistForUser(data.watchlistId, data.userId);
        if (!wl || !wl.enabled) return [];
        const items = (await listWatchlistItems(wl.id)).filter((i) => i.enabled).slice(0, 3);
        return items.map((i) => ({
          userId: data.userId!,
          watchlistId: wl.id,
          product: wl.product,
          competitor: i.competitor,
        }));
      }
      return listEnabledMonitoringTargets(3);
    });

    if (targets.length === 0) {
      return { enqueued: 0 };
    }

    await step.run('enqueue-sweeps', async () => enqueueTargets(targets));
    return { enqueued: targets.length };
  },
);
