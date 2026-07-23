import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import type { ResearchJobStatus } from '@/lib/research-jobs-types';

export type { ResearchJobStatus } from '@/lib/research-jobs-types';
export {
  applyCancelStatus,
  decideJobFailureAction,
  retryBackoffMs,
} from '@/lib/research-job-policy';

export type ResearchJobRow = {
  id: string;
  execution_id: string;
  user_id: string;
  session_id: string | null;
  status: ResearchJobStatus;
  attempt: number;
  max_attempts: number;
  cancel_requested: boolean;
  request: Record<string, unknown>;
  mission_summary: Record<string, unknown> | null;
  progress: Record<string, unknown>;
  orchestration_log: unknown;
  metrics: Record<string, unknown>;
  result: unknown;
  error: string | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export function newExecutionId(jobId?: string): string {
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return jobId ? `${jobId}:${rand}` : rand;
}

export async function createResearchJob(input: {
  userId: string;
  sessionId?: string | null;
  executionId: string;
  request: Record<string, unknown>;
  missionSummary?: Record<string, unknown> | null;
}): Promise<ResearchJobRow> {
  const { rows } = await query<ResearchJobRow>(
    `INSERT INTO research_jobs (
      execution_id, user_id, session_id, status, request, mission_summary
    ) VALUES ($1, $2, $3, 'queued', $4::jsonb, $5::jsonb)
    RETURNING *`,
    [
      input.executionId,
      input.userId,
      input.sessionId ?? null,
      JSON.stringify(input.request),
      input.missionSummary ? JSON.stringify(input.missionSummary) : null,
    ],
  );
  return rows[0];
}

export async function getResearchJob(id: string): Promise<ResearchJobRow | null> {
  const { rows } = await query<ResearchJobRow>(
    `SELECT * FROM research_jobs WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getResearchJobForUser(
  id: string,
  userId: string,
): Promise<ResearchJobRow | null> {
  const { rows } = await query<ResearchJobRow>(
    `SELECT * FROM research_jobs WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/** Claim job for an execution attempt. Returns null if already claimed by another execution. */
export async function claimResearchJob(
  jobId: string,
  executionId: string,
): Promise<ResearchJobRow | null> {
  const { rows } = await query<ResearchJobRow>(
    `UPDATE research_jobs
     SET status = 'running',
         started_at = COALESCE(started_at, now()),
         execution_id = $1,
         updated_at = now()
     WHERE id = $2
       AND status IN ('queued', 'retrying')
       AND execution_id = $1
     RETURNING *`,
    [executionId, jobId],
  );
  return rows[0] ?? null;
}

export async function patchResearchJob(
  jobId: string,
  patch: {
    status?: ResearchJobStatus;
    progress?: Record<string, unknown>;
    orchestrationLog?: string[];
    metrics?: Record<string, unknown>;
    missionSummary?: Record<string, unknown>;
    result?: unknown;
    error?: string | null;
    attempt?: number;
    finished?: boolean;
  },
): Promise<void> {
  const sets: string[] = ['updated_at = now()'];
  const vals: unknown[] = [];
  let i = 1;

  const add = (col: string, val: unknown, json = false) => {
    sets.push(`${col} = $${i}${json ? '::jsonb' : ''}`);
    vals.push(json ? JSON.stringify(val) : val);
    i += 1;
  };

  if (patch.status) add('status', patch.status);
  if (patch.progress) add('progress', patch.progress, true);
  if (patch.orchestrationLog) add('orchestration_log', patch.orchestrationLog, true);
  if (patch.metrics) add('metrics', patch.metrics, true);
  if (patch.missionSummary) add('mission_summary', patch.missionSummary, true);
  if (patch.result !== undefined) add('result', patch.result, true);
  if (patch.error !== undefined) add('error', patch.error);
  if (patch.attempt !== undefined) add('attempt', patch.attempt);
  if (patch.finished) {
    sets.push('finished_at = now()');
  }

  vals.push(jobId);
  await query(
    `UPDATE research_jobs SET ${sets.join(', ')} WHERE id = $${i}`,
    vals,
  );

  const terminal = ['completed', 'failed', 'cancelled', 'dead_letter'] as const;
  if (patch.status && (terminal as readonly string[]).includes(patch.status)) {
    const job = await getResearchJob(jobId);
    if (job) {
      await writeAuditLog({
        userId: job.user_id,
        action: `job_${patch.status}`,
        resourceType: 'research_job',
        resourceId: jobId,
        metadata: {
          error: patch.error ?? job.error,
          attempt: patch.attempt ?? job.attempt,
        },
      });
    }
  }
}

export async function requestCancelJob(jobId: string, userId: string): Promise<ResearchJobRow | null> {
  const { rows } = await query<ResearchJobRow>(
    `UPDATE research_jobs
     SET cancel_requested = true,
         status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
         finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END,
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [jobId, userId],
  );
  return rows[0] ?? null;
}

export async function isCancelRequested(jobId: string): Promise<boolean> {
  const { rows } = await query<{ cancel_requested: boolean; status: string }>(
    `SELECT cancel_requested, status FROM research_jobs WHERE id = $1`,
    [jobId],
  );
  const row = rows[0];
  return Boolean(row?.cancel_requested || row?.status === 'cancelled');
}

export async function appendJobLog(jobId: string, line: string): Promise<string[]> {
  const job = await getResearchJob(jobId);
  if (!job) return [];
  const prev = Array.isArray(job.orchestration_log) ? (job.orchestration_log as string[]) : [];
  const next = [...prev, line].slice(-64);
  await patchResearchJob(jobId, { orchestrationLog: next });
  return next;
}

export type QueueMetricsSnapshot = {
  sessionId: string | null;
  jobsTotal: number;
  completed: number;
  failed: number;
  cancelled: number;
  deadLetter: number;
  retries: number;
  avgQueueWaitMs: number | null;
  avgExecutionMs: number | null;
  avgAgentRuntimeMs: number | null;
  lastJob: {
    id: string;
    status: ResearchJobStatus;
    metrics: Record<string, unknown>;
    finishedAt: string | null;
  } | null;
};

/** Aggregate queue metrics for usage panel (session-scoped when sessionId provided). */
export async function getQueueMetricsForUser(
  userId: string,
  sessionId?: string | null,
): Promise<QueueMetricsSnapshot> {
  const params: unknown[] = [userId];
  let sessionClause = '';
  if (sessionId) {
    params.push(sessionId);
    sessionClause = ` AND session_id = $2`;
  }

  const { rows } = await query<{
    id: string;
    status: ResearchJobStatus;
    attempt: number;
    metrics: Record<string, unknown>;
    finished_at: string | null;
  }>(
    `SELECT id, status, attempt, metrics, finished_at
     FROM research_jobs
     WHERE user_id = $1${sessionClause}
     ORDER BY created_at DESC
     LIMIT 50`,
    params,
  );

  const metricsNums = (key: string) =>
    rows
      .map((r) => Number((r.metrics ?? {})[key]))
      .filter((n) => Number.isFinite(n) && n >= 0);

  const avg = (vals: number[]) =>
    vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;

  const last = rows[0];
  return {
    sessionId: sessionId ?? null,
    jobsTotal: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    deadLetter: rows.filter((r) => r.status === 'dead_letter').length,
    retries: rows.reduce((s, r) => s + Math.max(0, (r.attempt ?? 0)), 0),
    avgQueueWaitMs: avg(metricsNums('queueWaitMs')),
    avgExecutionMs: avg(metricsNums('executionMs')),
    avgAgentRuntimeMs: avg(metricsNums('agentRuntimeMs')),
    lastJob: last
      ? {
        id: last.id,
        status: last.status,
        metrics: last.metrics ?? {},
        finishedAt: last.finished_at,
      }
      : null,
  };
}

