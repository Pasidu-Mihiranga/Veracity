import { describe, expect, it } from 'vitest';
import {
  accumulateSessionUsage,
  applyAgentUpdate,
  applyResultToAssistant,
  isMirofishLiveFailed,
  historyItemFromMessage,
  parseSseBuffer,
  recommendationsFromOutput,
} from '@/lib/chat-stream';
import type { AgentOutput, AgentRun, OrchestratorOutput } from '@/lib/agents/types';
import type { ChatMessage } from '@/types/chat-ui';

describe('historyItemFromMessage', () => {
  it('carries only slim investigation state across turns', () => {
    const item = historyItemFromMessage({
      role: 'assistant',
      content: 'Initial findings',
      orchestratorOutput: {
        product: 'TargetCo',
        investigationPlan: {
          intent: 'dd_acquisition',
          openQuestions: ['What is audited ARR?'],
          proposedNextProbes: [],
          targetedFollowUpPlan: [],
        },
      } as unknown as OrchestratorOutput,
    });
    expect(item.investigationOpenQuestions).toEqual(['What is audited ARR?']);
    expect(item.researchProduct).toBe('TargetCo');
    expect(item).not.toHaveProperty('orchestratorOutput');
  });
});

describe('parseSseBuffer', () => {
  it('parses complete SSE data events and keeps the partial tail', () => {
    const { chunks, rest } = parseSseBuffer(
      'data: {"type":"orchestration_log","line":"a"}\n\ndata: {"type":"agent_update","run":{"agentId":"x","name":"X","status":"running"},"metrics":{"elapsedMs":1,"agentCount":1,"completedAgentCount":0,"failedAgentCount":0,"runningAgentCount":1,"estimatedCostUsd":0,"geminiCallCount":0,"toolCallCount":0}}\n\ndata: {"type":"res',
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ type: 'orchestration_log', line: 'a' });
    expect(chunks[1].type).toBe('agent_update');
    expect(rest).toBe('data: {"type":"res');
  });

  it('skips malformed JSON events', () => {
    const { chunks } = parseSseBuffer('data: {not-json}\n\ndata: {"type":"error","message":"x"}\n\n');
    expect(chunks).toEqual([{ type: 'error', message: 'x' }]);
  });
});

describe('accumulateSessionUsage', () => {
  const base = {
    queries: 1,
    totalCostUsd: 0.1,
    totalLatencyMs: 100,
    totalGeminiCalls: 2,
    totalToolCalls: 3,
  };

  it('increments query count without metrics', () => {
    expect(accumulateSessionUsage(base).queries).toBe(2);
  });

  it('adds metrics when present', () => {
    const next = accumulateSessionUsage(base, {
      estimatedCostUsd: 0.05,
      totalLatencyMs: 50,
      geminiCallCount: 1,
      toolCallCount: 2,
      agentCount: 1,
      completedAgentCount: 1,
      failedAgentCount: 0,
    } as OrchestratorOutput['metrics']);
    expect(next.queries).toBe(2);
    expect(next.totalCostUsd).toBeCloseTo(0.15);
    expect(next.totalLatencyMs).toBe(150);
    expect(next.totalGeminiCalls).toBe(3);
    expect(next.totalToolCalls).toBe(5);
  });
});

describe('message reducers', () => {
  const baseMsg: ChatMessage = {
    id: 1,
    role: 'assistant',
    type: 'intelligence',
    content: '',
    agentRuns: [],
  };

  it('applyAgentUpdate replaces same agent id', () => {
    const run: AgentRun = { agentId: 'pricing', name: 'Pricing', status: 'completed' };
    const withOld = applyAgentUpdate(baseMsg, { agentId: 'pricing', name: 'Pricing', status: 'running' });
    const next = applyAgentUpdate(withOld, run, {
      elapsedMs: 10,
      agentCount: 1,
      completedAgentCount: 1,
      failedAgentCount: 0,
      runningAgentCount: 0,
      estimatedCostUsd: 0,
      geminiCallCount: 0,
      toolCallCount: 0,
    });
    expect(next.agentRuns).toHaveLength(1);
    expect(next.agentRuns?.[0].status).toBe('completed');
    expect(next.liveMetrics?.elapsedMs).toBe(10);
  });

  it('applyResultToAssistant marks mirofish running when requested', () => {
    const out = {
      synthesizedAnswer: 'hello',
      outputs: [],
      topRecommendations: [{
        title: 'A',
        rationale: 'r',
        confidence: 'high',
        evidence: [],
        priority: 'immediate',
        rank: 1,
        impact: 'high',
        effort: 'low',
        falsifier: 'A primary test fails.',
      }],
      suggestedFollowUps: ['next'],
    } as unknown as OrchestratorOutput;

    const next = applyResultToAssistant(baseMsg, out, { includeMirofish: true });
    expect(next.content).toBe('hello');
    expect(next.agentRuns?.some(r => r.agentId === 'mirofish' && r.status === 'running')).toBe(true);
    expect(recommendationsFromOutput(out)?.[0].score).toBe(90);
    expect(recommendationsFromOutput(out)?.[0].rank).toBe(1);
    expect(recommendationsFromOutput(out)?.[0].falsifier).toBe('A primary test fails.');
  });
});

describe('isMirofishLiveFailed', () => {
  it('detects unavailable interpretation', () => {
    const out = {
      interpretation: ['MiroFish Live unavailable: backend down'],
      confidence: 'low',
    } as unknown as AgentOutput;
    expect(isMirofishLiveFailed(out)).toBe(true);
  });

  it('passes healthy outputs', () => {
    const out = {
      interpretation: ['Swarm consensus is bullish'],
      confidence: 'high',
      swarmSize: 8,
    } as unknown as AgentOutput;
    expect(isMirofishLiveFailed(out)).toBe(false);
  });
});
