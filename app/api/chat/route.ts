import { NextRequest } from 'next/server';
import { orchestrate, runMirofishAgent, runMirofishLiveAgent } from '../../../lib/agents/orchestrator';
import { createClient } from '@/lib/supabase-server';
import { enforceSweepRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { captureException, getRequestContext, getGeminiUsageSafe, logger, withCorrelation, withSpan } from '@/lib/observability';
import type { ConversationMessage, AgentRun, OrchestratorOutput, ImageAttachment, AgentOutput } from '../../../lib/agents/types';
import { featureFlags } from '@/lib/feature-flags';
import { inngest } from '@/lib/inngest/client';
import { createResearchJob, newExecutionId } from '@/lib/research-jobs';
import { getConfig } from '@/lib/config';
import { EST_COST_PER_MODEL_CALL } from '@/lib/agents/cost-estimates';
import {
  buildChatErrorPayload,
  orchestrationLogLineForError,
} from '@/lib/errors/chat-error';
import { assessAsyncSweepReadiness } from '@/lib/async-sweep-readiness';

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
  | {
      type: 'error';
      message: string;
      code?: string;
      correlationId?: string;
      detail?: string;
    };

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
  try {
    const cfg = getConfig();
    return assessAsyncSweepReadiness({
      featureEnabled: featureFlags.asyncSweep,
      eventKey: cfg.INNGEST_EVENT_KEY,
      signingKey: cfg.INNGEST_SIGNING_KEY,
      inngestDev: process.env.INNGEST_DEV === '1',
      production: process.env.NODE_ENV === 'production',
    }).ready;
  } catch {
    return false;
  }
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

  let workspaceId: string | null = null;
  if (featureFlags.workspaces) {
    try {
      const { resolveTenantFromCookies, requireWorkspaceAccess } = await import('@/lib/workspace');
      const { getCurrentUser } = await import('@/lib/auth');
      const authUser = await getCurrentUser();
      if (authUser) {
        const tenant = await resolveTenantFromCookies(authUser.id, authUser.email);
        workspaceId = tenant.workspaceId;
        if (workspaceId) {
          await requireWorkspaceAccess(authUser.id, workspaceId, 'session.write');
        }
      }
    } catch (err) {
      const { PermissionError } = await import('@/lib/rbac');
      if (err instanceof PermissionError) {
        return jsonError(err.message, err.status);
      }
      // tables may not be migrated yet — continue without workspace stamp
    }
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
        workspaceId,
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
      estimatedCostUsd: Number.parseFloat((billedCalls * EST_COST_PER_MODEL_CALL).toFixed(5)),
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

      if (featureFlags.evidenceGraph) {
        void (async () => {
          try {
            const { resolveKgWorkspace } = await import('@/lib/kg/context');
            const { ingestOrchestratorOutput } = await import('@/lib/kg/ingest');
            const { getCurrentUser } = await import('@/lib/auth');
            const authUser = await getCurrentUser();
            if (!authUser) return;
            const { workspaceId } = await resolveKgWorkspace(authUser.id, authUser.email);
            await ingestOrchestratorOutput({
              workspaceId,
              output: result,
              provenance: {
                createdBy: authUser.id,
                sessionId: sessionId ?? null,
                sourceAgent: 'orchestrator',
              },
            });
          } catch {
            /* ignore kg ingest errors */
          }
        })();
      }

      if (featureFlags.crossAgentMemory) {
        void (async () => {
          try {
            const { resolveKgWorkspace } = await import('@/lib/kg/context');
            const { putAgentMemory } = await import('@/lib/kg/agent-memory');
            const { getCurrentUser } = await import('@/lib/auth');
            const authUser = await getCurrentUser();
            if (!authUser) return;
            const { workspaceId } = await resolveKgWorkspace(authUser.id, authUser.email);
            const product = result.product;
            if (product) {
              await putAgentMemory({
                workspaceId,
                scope: 'product',
                key: `last-sweep:${product.slice(0, 80)}`,
                value: {
                  text: `Last intel on ${product}: ${(result.synthesizedAnswer ?? '').slice(0, 240)}`,
                },
                confidence: 0.7,
                sessionId: sessionId ?? null,
                provenance: { createdBy: authUser.id, sourceAgent: 'orchestrator' },
              });
            }
          } catch {
            /* ignore */
          }
        })();
      }

      const isTier0 =
        result.selectionMeta?.tier === 0 ||
        (result.outputs.length === 0 && (!result.topRecommendations || result.topRecommendations.length === 0));

      if (includeMirofish && !isTier0) {
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

      if (includeMirofishLive && !isTier0) {
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
      const ctx = getRequestContext();
      const payload = buildChatErrorPayload(err, ctx?.correlationId);
      logger.error('chat.failed', {
        code: payload.code,
        detail: payload.detail,
        correlationId: payload.correlationId,
        sessionId,
        conversationId,
        stack: err instanceof Error ? err.stack : undefined,
      });
      write({ type: 'orchestration_log', line: orchestrationLogLineForError(payload) });
      write({
        type: 'error',
        message: payload.userMessage,
        code: payload.code,
        correlationId: payload.correlationId,
        detail: payload.detail,
      });
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
