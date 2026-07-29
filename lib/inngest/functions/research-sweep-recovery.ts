import { query } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { newExecutionId } from '@/lib/research-jobs';

type StaleJob = {
  id: string;
  execution_id: string;
  user_id: string;
  session_id: string | null;
  status: string;
  attempt: number;
  max_attempts: number;
  request: Record<string, unknown>;
};

export const researchSweepRecoveryFn = inngest.createFunction(
  {
    id: 'research-sweep-recovery',
    retries: 0,
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }) => {
    const stale = await step.run('find-stale-jobs', async () => {
      const { rows } = await query<StaleJob>(
        `SELECT id, execution_id, user_id, session_id, status, attempt, max_attempts, request
         FROM research_jobs
         WHERE status IN ('queued', 'running', 'retrying')
           AND updated_at < now() - interval '20 minutes'
         ORDER BY updated_at ASC
         LIMIT 50`,
      );
      return rows;
    });
    const recovered = await step.run('recover-stale-jobs', async () => {
      const results = await Promise.all(stale.map(async (job) => {
        const nextAttempt = job.attempt + 1;
        if (nextAttempt >= job.max_attempts) {
          const exhausted = await query(
            `UPDATE research_jobs
             SET status = 'failed',
                 error = 'Async sweep exceeded the stale-job recovery limit',
                 attempt = $1,
                 finished_at = now(),
                 updated_at = now()
             WHERE id = $2 AND execution_id = $3
               AND status IN ('queued', 'running', 'retrying')
             RETURNING id`,
            [nextAttempt, job.id, job.execution_id],
          );
          return exhausted.rowCount ? 'failed' : 'raced';
        }
        const executionId = newExecutionId(job.id);
        const claimed = await query(
          `UPDATE research_jobs
           SET execution_id = $1,
               status = 'retrying',
               attempt = $2,
               error = 'Recovered after stale async execution',
               updated_at = now()
           WHERE id = $3 AND execution_id = $4
             AND status IN ('queued', 'running', 'retrying')
           RETURNING id`,
          [executionId, nextAttempt, job.id, job.execution_id],
        );
        if (!claimed.rowCount) return 'raced';
        await inngest.send({
          name: 'research/sweep.requested',
          data: {
            ...job.request,
            jobId: job.id,
            executionId,
            userId: job.user_id,
            sessionId: job.session_id ?? undefined,
          },
        });
        return 'requeued';
      }));
      return results;
    });
    return {
      stale: stale.length,
      requeued: recovered.filter((result) => result === 'requeued').length,
      failed: recovered.filter((result) => result === 'failed').length,
      raced: recovered.filter((result) => result === 'raced').length,
    };
  },
);

