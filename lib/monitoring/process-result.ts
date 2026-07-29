import { featureFlags } from '@/lib/feature-flags';
import type { OrchestratorOutput } from '@/lib/agents/types';
import { query } from '@/lib/db';
import { buildMonitoringArtifacts } from '@/lib/monitoring/diff-sweep';
import {
  countWeeklyAlerts,
  insertCompetitiveEvent,
  upsertAlertEventWithinBudget,
} from '@/lib/alerts';
import {
  getWatchlistForUser,
  markWatchlistSweepResult,
  updateWatchlist,
} from '@/lib/watchlists';
import { applyWeeklyAlertBudget } from '@/lib/monitoring/signal-collectors';
import { deliverAlertEgress } from '@/lib/monitoring/egress';

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

  const { diff, artifacts } = buildMonitoringArtifacts({
    userId: input.userId,
    product: input.product,
    competitor: input.competitor,
    output: input.output,
    prev,
    jobId: input.jobId,
    watchlistId: input.watchlistId,
  });

  if (input.watchlistId) {
    await updateWatchlist(input.watchlistId, input.userId, {
      last_sweep_summary: {
        materialEvents: diff.events.length,
        suppressedSignals: diff.suppressedSignals.length,
        limitations: diff.limitations,
      },
    });
  }

  if (!diff.material || artifacts.length === 0) return;

  const watchlist = input.watchlistId
    ? await getWatchlistForUser(input.watchlistId, input.userId)
    : null;
  const alreadySent = await countWeeklyAlerts(input.userId, input.watchlistId);
  const budgeted = applyWeeklyAlertBudget(
    artifacts.map((artifact) => artifact.event),
    alreadySent,
    watchlist?.weekly_alert_budget ?? 12,
  );
  const deliverIds = new Set(budgeted.deliver.map((event) => event.id));
  const deliverArtifacts = artifacts.filter((artifact) => deliverIds.has(artifact.event.id));
  const { rows: users } = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1 LIMIT 1`,
    [input.userId],
  );
  const newlyInsertedEvents: typeof budgeted.deliver = [];

  for (const artifact of deliverArtifacts) {
    const event = artifact.event;
    const alert = await upsertAlertEventWithinBudget({
      userId: input.userId,
      watchlistId: input.watchlistId,
      jobId: input.jobId,
      product: input.product,
      competitor: input.competitor,
      title: `${input.competitor}: ${event.title}`,
      summary: event.summary,
      severity: event.severity,
      diff: {
        category: event.category,
        sourceUrls: event.sourceUrls,
        materialityScore: event.materialityScore,
        materialityReason: event.materialityReason,
        origin: event.origin,
        changedRecTitles: diff.changedRecTitles,
        suppressedSignalCount: diff.suppressedSignals.length,
        suppressedByBudgetCount: budgeted.suppressedByBudget.length,
      },
      dedupeKey: artifact.dedupeKey,
    }, watchlist?.weekly_alert_budget ?? 12);
    if (!alert) continue;
    if (!alert.is_new) continue;
    newlyInsertedEvents.push(event);

    if (featureFlags.competitiveTimeline) {
      await insertCompetitiveEvent({
        userId: input.userId,
        product: input.product,
        competitor: input.competitor,
        title: event.title,
        summary: event.summary,
        category: event.category,
        sourceUrls: event.sourceUrls,
        jobId: input.jobId,
        confidence: event.confidence,
        clusterKey: artifact.clusterKey,
        eventDate: event.eventDate,
        severity: event.severity,
        materialityScore: event.materialityScore,
      });
    }

    await deliverAlertEgress({
      userId: input.userId,
      userEmail: users[0]?.email,
      alert,
      channels: watchlist?.alert_channels ?? ['in_app'],
    }).catch(() => []);
  }

  await ingestMonitoringSignals({
    ...input,
    events: newlyInsertedEvents,
  });
}

async function ingestMonitoringSignals(input: {
  userId: string;
  jobId: string;
  product: string;
  competitor: string;
  output: OrchestratorOutput;
  events: Array<{
    title: string;
    summary: string;
    category: string;
  }>;
}): Promise<void> {
  if (!featureFlags.evidenceGraph || input.events.length === 0) return;
  try {
    const { resolveKgWorkspace } = await import('@/lib/kg/context');
    const { ingestCompetitiveSignal, ingestOrchestratorOutput } = await import('@/lib/kg/ingest');
    const { projectCompetitorProfile } = await import('@/lib/kg/profiles');
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
    if (!workspaceId) return;
    const provenance = {
      createdBy: input.userId,
      jobId: input.jobId,
      sourceAgent: 'monitoring',
    };
    for (const event of input.events) {
      await ingestCompetitiveSignal({
        workspaceId,
        product: input.product,
        competitor: input.competitor,
        title: event.title,
        summary: event.summary,
        category: event.category,
        jobId: input.jobId,
        provenance,
      });
    }
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
  } catch {
    // Alerts must not fail when optional graph/profile projection fails.
  }
}
