import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getResearchJobForUser, type ResearchJobRow } from '@/lib/research-jobs';
import type { AgentRun, OrchestratorOutput } from '@/lib/agents/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

type StreamChunk =
  | { type: 'orchestration_log'; line: string }
  | { type: 'agent_update'; run: AgentRun; metrics: Record<string, unknown> }
  | { type: 'progress'; pct: number; label?: string; completedSteps?: number; totalSteps?: number }
  | { type: 'mission_summary'; summary: Record<string, unknown> }
  | { type: 'result'; output: OrchestratorOutput }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

function encode(chunk: StreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  const { id } = await ctx.params;
  const encoder = new TextEncoder();
  let lastLogLen = 0;
  let sentResult = false;
  let sentMission = false;
  let lastPct = -1;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: StreamChunk) => {
        try {
          controller.enqueue(encoder.encode(encode(chunk)));
        } catch { /* closed */ }
      };

      write({ type: 'orchestration_log', line: 'Connected to async job stream…' });

      const poll = async (): Promise<boolean> => {
        const job = await getResearchJobForUser(id, user.id);
        if (!job) {
          write({ type: 'error', message: 'Job not found' });
          return true;
        }
        return emitJob(job, write);
      };

      const emitJob = (
        job: ResearchJobRow,
        write: (c: StreamChunk) => void,
      ): boolean => {
        if (job.mission_summary && !sentMission) {
          sentMission = true;
          write({ type: 'mission_summary', summary: job.mission_summary });
        }

        const logs = Array.isArray(job.orchestration_log)
          ? (job.orchestration_log as string[])
          : [];
        for (let i = lastLogLen; i < logs.length; i++) {
          write({ type: 'orchestration_log', line: logs[i] });
        }
        lastLogLen = logs.length;

        const progress = (job.progress ?? {}) as {
          pct?: number;
          completedSteps?: number;
          totalSteps?: number;
          lastRun?: AgentRun;
          stage?: string;
        };
        if (typeof progress.pct === 'number' && progress.pct !== lastPct) {
          lastPct = progress.pct;
          write({
            type: 'progress',
            pct: progress.pct,
            label: progress.stage,
            completedSteps: progress.completedSteps,
            totalSteps: progress.totalSteps,
          });
        }
        if (progress.lastRun) {
          write({
            type: 'agent_update',
            run: progress.lastRun,
            metrics: {
              elapsedMs: 0,
              agentCount: progress.totalSteps ?? 0,
              completedAgentCount: progress.completedSteps ?? 0,
              failedAgentCount: 0,
              runningAgentCount: job.status === 'running' ? 1 : 0,
              estimatedCostUsd: 0,
              geminiCallCount: 0,
              toolCallCount: 0,
            },
          });
        }

        if (job.status === 'cancelled') {
          write({ type: 'cancelled' });
          return true;
        }
        if (job.status === 'failed' || job.status === 'dead_letter') {
          write({ type: 'error', message: job.error || 'Job failed' });
          return true;
        }
        if (job.status === 'completed' && job.result && !sentResult) {
          sentResult = true;
          write({ type: 'result', output: job.result as OrchestratorOutput });
          return true;
        }
        return false;
      };

      try {
        for (let i = 0; i < 900; i++) {
          if (req.signal.aborted) break;
          const done = await poll();
          if (done) break;
          await new Promise((r) => setTimeout(r, 400));
        }
      } finally {
        try { controller.close(); } catch { /* */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
