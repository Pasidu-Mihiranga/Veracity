import { NextRequest } from 'next/server';
import { orchestrate, runMirofishAgent, runMirofishLiveAgent } from '../../../lib/agents/orchestrator';
import { createClient } from '@/lib/supabase-server';
import { enforceSweepRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { captureException, getRequestContext, getGeminiUsageSafe, logger, withCorrelation, withSpan } from '@/lib/observability';
import type { ConversationMessage, AgentRun, OrchestratorOutput, ImageAttachment, AgentOutput } from '../../../lib/agents/types';
import { featureFlags } from '@/lib/feature-flags';
import { inngest, inngestConfigured } from '@/lib/inngest/client';
import { createResearchJob, newExecutionId } from '@/lib/research-jobs';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
// Vercel Pro: up to 120s (config). Hobby plan still enforces ~60s wall clock — keep Apify wait (APIFY_MAX_WAIT_SECS) low enough to finish.
export const maxDuration = 120;

interface LiveMetrics {
  elapsedMs: number;
  agentCount: number;
  completedAgentCount: number;
  failedAgentCount: number;
  runningAgentCount: number;
  estimatedCostUsd: number;
  geminiCallCount: number;
  toolCallCount: number;
}

type StreamChunk =
  | { type: 'agent_update'; run: AgentRun; metrics: LiveMetrics }
  | { type: 'orchestration_log'; line: string }
  | { type: 'progress'; pct: number; label?: string; completedSteps?: number; totalSteps?: number }
  | { type: 'mission_summary'; summary: Record<string, unknown> }
  | { type: 'result'; output: OrchestratorOutput }
  | { type: 'mirofish_result'; output: AgentOutput }
  | { type: 'mirofish_live_result'; output: AgentOutput }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

const LIVE_COST_PER_AGENT = (2000 * (0.1 / 1_000_000)) + (1000 * (0.4 / 1_000_000));

function encode(chunk: StreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAsyncSweepEnabled(): boolean {
  if (!featureFlags.asyncSweep) return false;
  try {
    const cfg = getConfig();
    if (cfg.INNGEST_EVENT_KEY || process.env.INNGEST_DEV === '1' || process.env.NODE_ENV === 'development') {
      return inngestConfigured();
    }
  } catch {
    return false;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return jsonError('Not authenticated', 401);
  }

  return withCorrelation(
    {
      correlationId: req.headers.get('x-correlation-id'),
      requestId: req.headers.get('x-request-id'),
      sessionId: req.headers.get('x-session-id'),
      conversationId: req.headers.get('x-conversation-id'),
      userId: user.id,
    },
    () => handleChatPost(req, user.id),
  );
}

async function handleChatPost(req: NextRequest, userId: string) {
  const rate = await enforceSweepRateLimit(userId);
  if (!rate.success) {
    return rateLimitExceededResponse(rate);
  }

  let body: {
    query: string;
    history: ConversationMessage[];
    images?: ImageAttachment[];
    memoryContext?: string;
    includeMirofish?: boolean;
    includeMirofishLive?: boolean;
    followUpMode?: 'full' | 'targeted';
    selectedAgents?: string[];
    forceFullSweep?: boolean;
    sessionId?: string;
    conversationId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const {
    query, history = [], images = [], memoryContext, includeMirofish = false, includeMirofishLive = false,
    followUpMode = 'full', selectedAgents = [], forceFullSweep = false, sessionId, conversationId,
  } = body;

  if (!query?.trim()) {
    return jsonError('query is required', 400);
  }

  const { buildLearningContext } = await import('@/lib/feedback-learning');
  let learningContext = '';
  try {
    learningContext = await buildLearningContext(userId);
  } catch {
    learningContext = '';
  }
  const mergedMemoryContext = [memoryContext, learningContext].filter(Boolean).join('\n\n') || undefined;

  const requestCtx = getRequestContext();
  logger.info('chat.started', {
    queryPreview: query.slice(0, 120),
    selectedAgents,
    includeMirofish,
    includeMirofishLive,
    followUpMode,
    sessionId,
    conversationId,
    asyncSweep: isAsyncSweepEnabled(),
  });

  if (isAsyncSweepEnabled()) {
    try {
      const executionId = newExecutionId();
      const job = await createResearchJob({
        userId,
        sessionId,
        executionId,
        request: {
          query,
          history,
          images,
          memoryContext: mergedMemoryContext,
          selectedAgents,
          followUpMode,
          forceFullSweep,
          includeMirofish,
          includeMirofishLive,
        },
      });
      await inngest.send({
        name: 'research/sweep.requested',
        data: {
          jobId: job.id,
          executionId,
          userId,
          sessionId,
          query,
          history,
          images,
          memoryContext: mergedMemoryContext,
          selectedAgents,
          followUpMode,
          forceFullSweep,
          includeMirofish,
          includeMirofishLive,
        },
      });
      return new Response(
        JSON.stringify({ mode: 'async', jobId: job.id, executionId }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...(requestCtx?.correlationId ? { 'x-correlation-id': requestCtx.correlationId } : {}),
          },
        },
      );
    } catch (err) {
      captureException(err, { route: 'chat-async' });
      logger.warn('chat.async_fallback_sync', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const readable = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });

  const write = (chunk: StreamChunk) => {
    try { controller.enqueue(encoder.encode(encode(chunk))); } catch { /* stream closed */ }
  };

  const orchestrationStart = Date.now();
  const liveAgentState = new Map<string, AgentRun['status']>();

  const computeLiveMetrics = (): LiveMetrics => {
    let completed = 0;
    let failed = 0;
    let running = 0;
    for (const status of liveAgentState.values()) {
      if (status === 'completed') completed += 1;
      else if (status === 'failed') failed += 1;
      else if (status === 'running') running += 1;
    }
    const billedCalls = completed + failed + 1;
    const estimatedToolCalls = (completed + failed) * 3;
    return {
      elapsedMs: Date.now() - orchestrationStart,
      agentCount: liveAgentState.size,
      completedAgentCount: completed,
      failedAgentCount: failed,
      runningAgentCount: running,
      estimatedCostUsd: Number.parseFloat((billedCalls * LIVE_COST_PER_AGENT).toFixed(5)),
      geminiCallCount: billedCalls,
      toolCallCount: estimatedToolCalls,
    };
  };

  (async () => {
    try {
      write({ type: 'orchestration_log', line: 'Starting orchestration…' });
      const result = await withSpan(
        'chat.orchestrate',
        { sessionId, conversationId },
        () => orchestrate(
          query,
          history,
          (agentRun: AgentRun) => {
            liveAgentState.set(agentRun.agentId, agentRun.status);
            write({ type: 'agent_update', run: agentRun, metrics: computeLiveMetrics() });
            const completed = [...liveAgentState.values()].filter((s) => s === 'completed' || s === 'failed').length;
            const total = Math.max(liveAgentState.size, 1);
            write({
              type: 'progress',
              pct: Math.min(99, Math.round((completed / total) * 100)),
              completedSteps: completed,
              totalSteps: total,
            });
          },
          images,
          mergedMemoryContext,
          {
            followUpMode,
            selectedAgents,
            forceFullSweep,
            onOrchestrationLog: (line: string) => write({ type: 'orchestration_log', line }),
            onMissionSummary: (summary) => write({ type: 'mission_summary', summary }),
          },
        ),
      );

      write({ type: 'progress', pct: 100, label: 'completed' });
      write({ type: 'result', output: result });

      if (includeMirofish) {
        try {
          const mirofishOutput = await runMirofishAgent(
            query,
            history,
            (agentRun: AgentRun) => {
              liveAgentState.set(agentRun.agentId, agentRun.status);
              write({ type: 'agent_update', run: agentRun, metrics: computeLiveMetrics() });
            },
            images,
            mergedMemoryContext,
            (line: string) => write({ type: 'orchestration_log', line }),
          );
          if (mirofishOutput) {
            write({ type: 'mirofish_result', output: mirofishOutput });
          }
        } catch (err) {
          captureException(err, { agent: 'mirofish' });
        }
      }

      if (includeMirofishLive) {
        try {
          const mirofishLiveOutput = await runMirofishLiveAgent(
            query,
            history,
            (agentRun: AgentRun) => {
              liveAgentState.set(agentRun.agentId, agentRun.status);
              write({ type: 'agent_update', run: agentRun, metrics: computeLiveMetrics() });
            },
            images,
            mergedMemoryContext,
            (line: string) => write({ type: 'orchestration_log', line }),
          );
          if (mirofishLiveOutput) {
            write({ type: 'mirofish_live_result', output: mirofishLiveOutput });
          }
        } catch (err) {
          captureException(err, { agent: 'mirofish-live' });
        }
      }

      const usage = getGeminiUsageSafe();
      logger.info('chat.completed', {
        latencyMs: Date.now() - orchestrationStart,
        geminiCalls: usage?.calls,
        geminiCostUsd: usage?.estimatedCostUsd,
        totalTokens: usage?.totalTokens,
        sessionId,
        conversationId,
      });
    } catch (err) {
      captureException(err, { route: 'chat' });
      const message = err instanceof Error ? err.message : 'Internal error';
      write({ type: 'error', message });
    } finally {
      try { controller.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(requestCtx?.correlationId ? { 'x-correlation-id': requestCtx.correlationId } : {}),
      ...(requestCtx?.requestId ? { 'x-request-id': requestCtx.requestId } : {}),
      ...(requestCtx?.traceId ? { 'x-trace-id': requestCtx.traceId } : {}),
    },
  });
}
