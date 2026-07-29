import type {
  AgentRun,
  ConversationMessage,
  ImageAttachment,
  OrchestratorOutput,
} from '@/lib/agents/types';
import { orchestrate } from '@/lib/agents/orchestrator';
import { inngest } from '@/lib/inngest/client';
import { retryBackoffMs } from '@/lib/research-job-policy';
import {
  appendJobLog,
  claimResearchJob,
  completeResearchJobExecution,
  failResearchJobExecution,
  getResearchJob,
  isCancelRequested,
  newExecutionId,
  ownsResearchJobExecution,
  patchResearchJob,
  transitionResearchJobRetry,
} from '@/lib/research-jobs';
import { processMonitoringJobResult } from '@/lib/monitoring/process-result';

export type SweepRequestedData = {
  jobId: string;
  executionId: string;
  userId: string;
  sessionId?: string;
  query: string;
  history: ConversationMessage[];
  images?: ImageAttachment[];
  memoryContext?: string;
  selectedAgents?: string[];
  followUpMode?: 'full' | 'targeted';
  forceFullSweep?: boolean;
  forceExecution?: boolean;
  includeMirofish?: boolean;
  includeMirofishLive?: boolean;
  kind?: string;
  watchlistId?: string;
  product?: string;
  competitor?: string;
  competitorUrl?: string;
};

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|ECONNRESET|ETIMEDOUT|429|503|fetch failed|network|socket/i.test(msg);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export const researchSweepFn = inngest.createFunction(
  {
    id: 'research-sweep',
    retries: 0,
    triggers: [{ event: 'research/sweep.requested' }],
  },
  async ({ event, step }) => {
    const data = event.data as SweepRequestedData;
    const { jobId, executionId } = data;

    const claimed = await step.run('claim-job', async () => {
      return claimResearchJob(jobId, executionId);
    });

    if (!claimed) {
      return { skipped: true, reason: 'idempotent-skip' };
    }

    const queuedAt = new Date(claimed.queued_at).getTime();
    const queueWaitMs = Math.max(0, Date.now() - queuedAt);

    await appendJobLog(jobId, 'Async sweep claimed — starting orchestration…');

    const runOnce = async (): Promise<OrchestratorOutput> => {
      const completedIds: string[] = [];
      const agentStart = Date.now();
      let plannedSteps = Math.max(
        1,
        (data.selectedAgents ?? []).filter(
          (id) => id !== 'mirofish' && id !== 'mirofish-live',
        ).length || 6,
      );

      const output = await orchestrate(
        data.query,
        data.history ?? [],
        async (run: AgentRun) => {
          if (run.status === 'completed' || run.status === 'failed') {
            if (!completedIds.includes(run.agentId)) completedIds.push(run.agentId);
          }
          const pct = Math.min(99, Math.round((completedIds.length / plannedSteps) * 100));
          await patchResearchJob(jobId, {
            progress: {
              pct,
              completedSteps: completedIds.length,
              totalSteps: plannedSteps,
              stage: run.status,
              lastRun: run,
            },
          });
        },
        data.images ?? [],
        data.memoryContext,
        {
          followUpMode: data.followUpMode ?? 'full',
          selectedAgents: data.selectedAgents,
          forceExecution: data.forceExecution,
          forceFullSweep: data.forceFullSweep,
          onOrchestrationLog: async (line: string) => {
            await appendJobLog(jobId, line);
          },
          onMissionSummary: async (summary) => {
            plannedSteps = Math.max(1, summary.agentCount || summary.steps?.length || plannedSteps);
            await patchResearchJob(jobId, { missionSummary: summary });
          },
          shouldCancel: async () => isCancelRequested(jobId),
        },
      );

      const executionMs = Date.now() - agentStart;
      await patchResearchJob(jobId, {
        metrics: {
          queueWaitMs,
          executionMs,
          agentRuntimeMs: executionMs,
          retries: claimed.attempt,
        },
        progress: {
          pct: 100,
          completedSteps: output.agentRuns.filter((r) => r.status === 'completed').length,
          totalSteps: output.agentRuns.length,
          stage: 'completed',
        },
        missionSummary: output.missionPlan
          ? {
              steps: output.missionPlan.steps,
              agentCount: output.missionPlan.steps.length,
            }
          : undefined,
      });

      return output;
    };

    try {
      if (await isCancelRequested(jobId)) {
        await patchResearchJob(jobId, {
          status: 'cancelled',
          finished: true,
          error: 'Cancelled by user',
        });
        return { cancelled: true };
      }

      const result = await step.run('orchestrate', async () => runOnce());
      if (!(await ownsResearchJobExecution(jobId, executionId))) {
        return { skipped: true, reason: 'superseded-execution' };
      }

      if (await isCancelRequested(jobId)) {
        await patchResearchJob(jobId, {
          status: 'cancelled',
          finished: true,
          result,
          error: 'Cancelled by user',
        });
        return { cancelled: true };
      }

      const completed = await completeResearchJobExecution({
        jobId,
        executionId,
        result,
      });
      if (!completed) return { skipped: true, reason: 'superseded-execution' };
      await appendJobLog(jobId, 'Async sweep completed.');

      if (data.kind === 'monitoring') {
        await step.run('process-monitoring', async () => {
          await processMonitoringJobResult({
            userId: data.userId,
            jobId,
            watchlistId: data.watchlistId,
            product: data.product || result.product || 'Product',
            competitor: data.competitor || result.competitor || 'Competitor',
            competitorUrl: data.competitorUrl,
            output: result,
            succeeded: true,
          });
        });
      }

      return { ok: true, jobId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const job = await getResearchJob(jobId);
      if (job && job.execution_id !== executionId) {
        return { skipped: true, reason: 'superseded-execution' };
      }
      const attempt = (job?.attempt ?? 0) + 1;
      const maxAttempts = job?.max_attempts ?? 2;

      if (isTransientError(err) && attempt < maxAttempts) {
        const nextExecutionId = newExecutionId(jobId);
        const transitioned = await transitionResearchJobRetry({
          jobId,
          executionId,
          nextExecutionId,
          attempt,
          error: message,
          metrics: { queueWaitMs, retries: attempt },
        });
        if (!transitioned) return { skipped: true, reason: 'superseded-execution' };
        await appendJobLog(jobId, `Transient failure — retrying (attempt ${attempt})…`);
        const backoffMs = retryBackoffMs(attempt);
        await sleep(backoffMs);
        await inngest.send({
          name: 'research/sweep.requested',
          data: {
            ...data,
            executionId: nextExecutionId,
          },
        });
        return { retrying: true, attempt };
      }

      const failed = await failResearchJobExecution({
        jobId,
        executionId,
        attempt,
        error: message,
      });
      if (!failed) return { skipped: true, reason: 'superseded-execution' };
      await appendJobLog(jobId, `Dead-letter: ${message}`);
      if (data.kind === 'monitoring' && data.watchlistId) {
        await processMonitoringJobResult({
          userId: data.userId,
          jobId,
          watchlistId: data.watchlistId,
          product: data.product || 'Product',
          competitor: data.competitor || 'Competitor',
          competitorUrl: data.competitorUrl,
          output: {
            query: data.query,
            product: data.product || 'Product',
            competitor: data.competitor,
            agentRuns: [],
            outputs: [],
            synthesizedAnswer: '',
            topRecommendations: [],
            suggestedFollowUps: [],
            totalConfidence: 'low',
            generatedAt: new Date().toISOString(),
          },
          succeeded: false,
        }).catch(() => {});
      }
      throw err;
    }
  },
);
