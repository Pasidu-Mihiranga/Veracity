/**
 * Chat SSE stream helpers — shared by the main query + follow-up paths.
 */

import type { AgentOutput, AgentRun, ImageAttachment, OrchestratorOutput } from '@/lib/agents/types';
import { filterDisplaySources } from '@/lib/tools/source-validator';
import type {
  ChatMessage,
  ChatStreamChunk,
  LiveRunMetrics,
  SessionUsage,
  SourceLink,
} from '@/types/chat-ui';

export type ChatRequestBody = {
  query: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
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

export type StreamChatOptions = {
  signal?: AbortSignal;
};

/** Split an SSE buffer into complete events; returns leftover partial buffer. */
export function parseSseBuffer(buffer: string): { chunks: ChatStreamChunk[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const chunks: ChatStreamChunk[] = [];

  for (const part of parts) {
    if (!part.startsWith('data: ')) continue;
    try {
      chunks.push(JSON.parse(part.slice(6)) as ChatStreamChunk);
    } catch {
      // skip malformed event
    }
  }

  return { chunks, rest };
}

export function accumulateSessionUsage(
  prev: SessionUsage,
  metrics?: OrchestratorOutput['metrics'],
): SessionUsage {
  if (!metrics) {
    return { ...prev, queries: prev.queries + 1 };
  }
  return {
    queries: prev.queries + 1,
    totalCostUsd: prev.totalCostUsd + metrics.estimatedCostUsd,
    totalLatencyMs: prev.totalLatencyMs + metrics.totalLatencyMs,
    totalGeminiCalls: prev.totalGeminiCalls + metrics.geminiCallCount,
    totalToolCalls: prev.totalToolCalls + metrics.toolCallCount,
  };
}

export function recommendationsFromOutput(out: OrchestratorOutput) {
  return out.topRecommendations?.map(r => ({
    title: r.title,
    rationale: r.rationale,
    score: r.confidence === 'high' ? 90 : r.confidence === 'medium' ? 65 : 40,
    confidence: r.confidence,
    evidence: r.evidence,
    priority: r.priority,
    sourceUrls: r.sourceUrls ?? [],
  }));
}

export function sourcesFromOutput(out: OrchestratorOutput, limit = 12): SourceLink[] {
  return filterDisplaySources(
    out.outputs?.flatMap(o => o.sources?.map(s => ({ title: s.title, url: s.url })) ?? []) ?? [],
    limit,
  );
}

export function isMirofishLiveFailed(liveOut: AgentOutput): boolean {
  const interpretationFailed =
    Array.isArray(liveOut.interpretation)
    && liveOut.interpretation.some(line =>
      /mirofish live unavailable|live swarm unavailable|live swarm interviews failed/i.test(line),
    );
  const swarmEmpty = (liveOut as { swarmSize?: number }).swarmSize === 0;
  const rationaleFailed = /unavailable|failed/i.test((liveOut as { rationale?: string }).rationale ?? '');
  return interpretationFailed || swarmEmpty || rationaleFailed;
}

export function applyAgentUpdate(
  message: ChatMessage,
  run: AgentRun,
  metrics?: LiveRunMetrics,
): ChatMessage {
  return {
    ...message,
    agentRuns: [
      ...(message.agentRuns ?? []).filter(r => r.agentId !== run.agentId),
      run,
    ],
    liveMetrics: metrics ?? message.liveMetrics,
  };
}

export function applyOrchestrationLog(message: ChatMessage, line: string): ChatMessage {
  return {
    ...message,
    orchestrationLog: [...(message.orchestrationLog ?? []), line].slice(-48),
  };
}

export function applyResultToAssistant(
  message: ChatMessage,
  out: OrchestratorOutput,
  opts: { includeMirofish?: boolean; includeMirofishLive?: boolean },
): ChatMessage {
  let agentRuns = message.agentRuns ?? [];

  if (opts.includeMirofish) {
    agentRuns = [
      ...agentRuns.filter(r => r.agentId !== 'mirofish'),
      {
        agentId: 'mirofish',
        name: 'MiroFish (Forecast)',
        status: 'running',
        startedAt: new Date().toISOString(),
      } as AgentRun,
    ];
  }

  if (opts.includeMirofishLive) {
    agentRuns = [
      ...agentRuns.filter(r => r.agentId !== 'mirofish-live'),
      {
        agentId: 'mirofish-live',
        name: 'MiroFish Live (Real VPS)',
        status: 'running',
        startedAt: new Date().toISOString(),
      } as AgentRun,
    ];
  }

  return {
    ...message,
    content: out.synthesizedAnswer,
    type: 'intelligence',
    orchestratorOutput: out,
    recommendations: recommendationsFromOutput(out),
    sources: sourcesFromOutput(out, 12),
    suggestions: out.suggestedFollowUps?.slice(0, 3),
    agentRuns,
  };
}

export function mergeAgentOutputIntoFinal(
  finalOutput: OrchestratorOutput,
  agentOut: AgentOutput,
  domain: 'mirofish' | 'mirofish-live',
  run: AgentRun,
): OrchestratorOutput {
  return {
    ...finalOutput,
    outputs: [
      ...(finalOutput.outputs ?? []).filter(o => o.domain !== domain),
      agentOut,
    ],
    agentRuns: [
      ...(finalOutput.agentRuns ?? []).filter(r => r.agentId !== domain),
      run,
    ],
  };
}

export function applyAgentDomainResult(
  message: ChatMessage,
  agentOut: AgentOutput,
  domain: 'mirofish' | 'mirofish-live',
  run: AgentRun,
): ChatMessage {
  if (!message.orchestratorOutput) return message;
  const updatedOutputs = [
    ...(message.orchestratorOutput.outputs ?? []).filter(o => o.domain !== domain),
    agentOut,
  ];
  return {
    ...message,
    orchestratorOutput: { ...message.orchestratorOutput, outputs: updatedOutputs },
    agentRuns: [
      ...(message.agentRuns ?? []).filter(r => r.agentId !== domain),
      run,
    ],
  };
}

/**
 * POST /api/chat and invoke onChunk for each SSE event.
 * Supports async Inngest mode: JSON { mode:'async', jobId } then job events SSE.
 * Throws on HTTP errors (including 429 with server message).
 */
export async function streamChatRequest(
  body: ChatRequestBody,
  onChunk: (chunk: ChatStreamChunk) => void | Promise<void>,
  options: StreamChatOptions = {},
): Promise<void> {
  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      ...(body.sessionId ? { 'x-session-id': body.sessionId } : {}),
      ...(body.conversationId ? { 'x-conversation-id': body.conversationId } : {}),
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (res.status === 429) {
    const payload = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(payload.error || 'Rate limit exceeded. Try again later.');
  }
  if (!res.ok || !res.body) {
    throw new Error(`API error ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await res.json() as { mode?: string; jobId?: string };
    if (payload.mode === 'async' && payload.jobId) {
      await onChunk({ type: 'job_started', jobId: payload.jobId });
      await streamJobEvents(payload.jobId, onChunk, options);
      return;
    }
    throw new Error('Unexpected JSON chat response');
  }

  await consumeSseBody(res.body, onChunk);
}

async function streamJobEvents(
  jobId: string,
  onChunk: (chunk: ChatStreamChunk) => void | Promise<void>,
  options: StreamChatOptions = {},
): Promise<void> {
  const res = await fetch(`/api/jobs/${jobId}/events`, {
    method: 'GET',
    signal: options.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Job stream error ${res.status}`);
  }
  await consumeSseBody(res.body, onChunk);
}

async function consumeSseBody(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: ChatStreamChunk) => void | Promise<void>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;
    for (const chunk of parsed.chunks) {
      await onChunk(chunk);
    }
  }
}
