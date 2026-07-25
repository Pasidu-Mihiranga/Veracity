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

  if (featureFlags.evidenceGraph) {
    try {
      const { resolveKgWorkspace } = await import('@/lib/kg/context');
      const { ingestCompetitiveSignal, ingestOrchestratorOutput } = await import('@/lib/kg/ingest');
      const { projectCompetitorProfile } = await import('@/lib/kg/profiles');
      // Prefer workspace from job if stamped; else resolve personal
      const { rows } = await query<{ workspace_id: string | null; email: string }>(
        `SELECT j.workspace_id, u.email
         FROM research_jobs j
         JOIN users u ON u.id = j.user_id
         WHERE j.id = $1
         LIMIT 1`,
        [input.jobId],
      );
      let workspaceId = rows[0]?.workspace_id ?? null;
      if (!workspaceId && rows[0]?.email) {
        workspaceId = (await resolveKgWorkspace(input.userId, rows[0].email)).workspaceId;
      }
      if (workspaceId) {
        const provenance = {
          createdBy: input.userId,
          jobId: input.jobId,
          sourceAgent: 'monitoring',
        };
        await ingestCompetitiveSignal({
          workspaceId,
          product: input.product,
          competitor: input.competitor,
          title: diff.title,
          summary: diff.summary,
          category: diff.category,
          jobId: input.jobId,
          provenance,
        });
        await ingestOrchestratorOutput({
          workspaceId,
          output: input.output,
          product: input.product,
          competitor: input.competitor,
          provenance,
        });
        if (featureFlags.competitorProfiles) {
          await projectCompetitorProfile(workspaceId, input.competitor);
        }
      }
    } catch {
      // never block monitoring on KG failure
    }
  }
}
