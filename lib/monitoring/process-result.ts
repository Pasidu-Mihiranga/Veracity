import { featureFlags } from '@/lib/feature-flags';
import type { OrchestratorOutput } from '@/lib/agents/types';
import { query } from '@/lib/db';
import { buildMonitoringArtifacts } from '@/lib/monitoring/diff-sweep';
import { insertCompetitiveEvent, upsertAlertEvent } from '@/lib/alerts';
import { markWatchlistSweepResult } from '@/lib/watchlists';

export async function processMonitoringJobResult(input: {
  userId: string;
  jobId: string;
  watchlistId?: string;
  product: string;
  competitor: string;
  output: OrchestratorOutput;
  succeeded: boolean;
}): Promise<void> {
  if (input.watchlistId) {
    await markWatchlistSweepResult({
      watchlistId: input.watchlistId,
      userId: input.userId,
      succeeded: input.succeeded,
    });
  }

  if (!input.succeeded || !featureFlags.alerts) return;

  let prev: OrchestratorOutput | null = null;
  try {
    const { rows } = await query<{ result: OrchestratorOutput }>(
      `SELECT result FROM research_jobs
       WHERE user_id = $1
         AND id <> $2
         AND status = 'completed'
         AND result IS NOT NULL
         AND request->>'kind' = 'monitoring'
         AND lower(COALESCE(request->>'competitor','')) = lower($3)
       ORDER BY finished_at DESC NULLS LAST
       LIMIT 1`,
      [input.userId, input.jobId, input.competitor],
    );
    prev = rows[0]?.result ?? null;
  } catch {
    prev = null;
  }

  const { diff, dedupeKey, clusterKey } = buildMonitoringArtifacts({
    userId: input.userId,
    product: input.product,
    competitor: input.competitor,
    output: input.output,
    prev,
    jobId: input.jobId,
    watchlistId: input.watchlistId,
  });

  if (!diff.material && prev) return;

  await upsertAlertEvent({
    userId: input.userId,
    watchlistId: input.watchlistId,
    jobId: input.jobId,
    product: input.product,
    competitor: input.competitor,
    title: diff.title,
    summary: diff.summary,
    severity: diff.severity,
    diff: {
      changedRecTitles: diff.changedRecTitles,
      category: diff.category,
    },
    dedupeKey,
  });

  if (featureFlags.competitiveTimeline) {
    await insertCompetitiveEvent({
      userId: input.userId,
      product: input.product,
      competitor: input.competitor,
      title: diff.title,
      summary: diff.summary,
      category: diff.category,
      sourceUrls: (input.output.outputs ?? [])
        .flatMap((o) => o.sources ?? [])
        .map((s) => s.url)
        .filter(Boolean)
        .slice(0, 6),
      jobId: input.jobId,
      confidence: input.output.totalConfidence,
      clusterKey,
    });
  }
}
