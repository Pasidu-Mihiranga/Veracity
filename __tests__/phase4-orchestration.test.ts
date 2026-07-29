import { describe, expect, it } from 'vitest';
import { resolveAgentSet } from '@/lib/agents/adaptive-selection';
import { planMission, missionWaves } from '@/lib/agents/mission-planner';
import {
  buildMissionSummary,
  EST_COST_PER_AGENT_USD,
  EST_SECONDS_PER_AGENT,
  progressFromSteps,
} from '@/lib/agents/mission-summary';
import { shouldRunExecution } from '@/lib/agents/execution-planner';
import { computeScenarioDiff } from '@/lib/scenario-diff';
import {
  applyCancelStatus,
  decideJobFailureAction,
  retryBackoffMs,
} from '@/lib/research-job-policy';
import type { ChatMessage } from '@/types/chat-ui';
import { featureFlags } from '@/lib/feature-flags';

describe('resolveAgentSet', () => {
  it('intersects UI and classifier domains with floor ≥3 and ≤4 on narrow competitive', () => {
    const result = resolveAgentSet({
      uiSelected: ['competitive', 'market-trends', 'win-loss', 'pricing', 'positioning', 'adjacent'],
      classifierDomains: ['competitive'],
    });
    expect(result.researchIds.length).toBeGreaterThanOrEqual(3);
    expect(result.researchIds.length).toBeLessThanOrEqual(4);
    expect(result.researchIds).toContain('competitive');
    expect(result.mode).toBe('adaptive');
    expect(result.savedVsFull).toBeGreaterThan(0);
  });

  it('forceFullSweep uses full research set from UI', () => {
    const result = resolveAgentSet({
      uiSelected: ['competitive', 'market-trends', 'win-loss', 'pricing', 'positioning', 'adjacent'],
      classifierDomains: ['competitive'],
      forceFullSweep: true,
    });
    expect(result.researchIds.length).toBe(6);
    expect(result.mode).toBe('full');
    expect(result.savedVsFull).toBe(0);
  });
});

describe('mission planner', () => {
  it('builds dependency-aware steps and waves', () => {
    const steps = planMission(['market-trends', 'competitive', 'win-loss', 'positioning']);
    expect(steps.map((s) => s.agentId)).toEqual(
      expect.arrayContaining(['market-trends', 'competitive', 'win-loss', 'positioning']),
    );
    const winLoss = steps.find((s) => s.agentId === 'win-loss');
    expect(winLoss?.dependsOn).toContain('step-competitive');
    const waves = missionWaves(steps);
    expect(waves.length).toBeGreaterThanOrEqual(2);
    expect(waves[0].some((s) => s.agentId === 'competitive' || s.agentId === 'market-trends')).toBe(true);
  });
});

describe('mission summary estimates', () => {
  it('scales seconds and cost by agent count', () => {
    const steps = planMission(['competitive', 'market-trends', 'pricing']);
    const summary = buildMissionSummary({ steps, includeExecution: false });
    expect(summary.agentCount).toBe(3);
    expect(summary.estimatedSeconds).toBe(3 * EST_SECONDS_PER_AGENT);
    expect(summary.estimatedCostUsd).toBeCloseTo(3 * EST_COST_PER_AGENT_USD, 4);
  });

  it('progressFromSteps tracks completed / planned mission agents', () => {
    const progress = progressFromSteps(4, ['competitive', 'market-trends'], [
      'competitive',
      'market-trends',
      'pricing',
      'positioning',
    ]);
    expect(progress.completedSteps).toBe(2);
    expect(progress.totalSteps).toBe(4);
    expect(progress.pct).toBe(50);
  });
});

describe('execution planner gate', () => {
  it('defers when execution agent not selected', () => {
    const gate = shouldRunExecution({
      query: 'Draft a cold email sequence for Vector Agents',
      classifierRunExecution: true,
      executionAgentSelected: false,
    });
    expect(gate.run).toBe(false);
    expect(gate.reason).toMatch(/not selected/i);
  });

  it('runs when classifier intent and agent selected', () => {
    const gate = shouldRunExecution({
      query: 'What should we build?',
      classifierRunExecution: true,
      executionAgentSelected: true,
    });
    expect(gate.run).toBe(true);
  });
});

describe('job claim / retry / cancel state machine', () => {
  it('retries once on transient then dead-letters', () => {
    expect(decideJobFailureAction({ isTransient: true, nextAttempt: 1, maxAttempts: 2 })).toBe('retry');
    expect(decideJobFailureAction({ isTransient: true, nextAttempt: 2, maxAttempts: 2 })).toBe('dead_letter');
    expect(decideJobFailureAction({ isTransient: false, nextAttempt: 1, maxAttempts: 2 })).toBe('fail');
  });

  it('uses 1s then 4s backoff', () => {
    expect(retryBackoffMs(1)).toBe(1000);
    expect(retryBackoffMs(2)).toBe(4000);
  });

  it('cancels queued immediately; leaves running flagged', () => {
    expect(applyCancelStatus('queued')).toBe('cancelled');
    expect(applyCancelStatus('running')).toBe('running');
    expect(applyCancelStatus('retrying')).toBe('retrying');
  });
});

describe('asyncSweep flag default', () => {
  it('defaults on while transport readiness preserves sync fallback', () => {
    expect(featureFlags.asyncSweep).toBe(true);
  });
});

describe('scenario diff', () => {
  it('flags recommendation / confidence / evidence / cost deltas', () => {
    const left: ChatMessage = {
      id: 1,
      role: 'assistant',
      content: 'A',
      recommendations: [{ title: 'Ship sequencer' }],
      sources: [{ title: 'a', url: 'https://a.example' }],
      orchestratorOutput: {
        query: 'q',
        product: 'P',
        agentRuns: [],
        outputs: [],
        synthesizedAnswer: 'A',
        topRecommendations: [{ title: 'Ship sequencer', rationale: '', evidence: [], confidence: 'medium', priority: 'short-term' }],
        suggestedFollowUps: [],
        totalConfidence: 'medium',
        generatedAt: new Date().toISOString(),
        metrics: { totalLatencyMs: 40000, agentLatencies: {}, estimatedCostUsd: 0.04, toolCallCount: 6, geminiCallCount: 4, agentCount: 4, completedAgentCount: 4, failedAgentCount: 0 },
      },
    };
    const right: ChatMessage = {
      ...left,
      id: 2,
      content: 'B',
      recommendations: [{ title: 'Ship sequencer' }, { title: 'Raise pricing' }],
      sources: [{ title: 'a', url: 'https://a.example' }, { title: 'b', url: 'https://b.example' }],
      orchestratorOutput: {
        ...left.orchestratorOutput!,
        totalConfidence: 'high',
        topRecommendations: [
          { title: 'Ship sequencer', rationale: '', evidence: [], confidence: 'high', priority: 'immediate' },
          { title: 'Raise pricing', rationale: '', evidence: [], confidence: 'medium', priority: 'strategic' },
        ],
        metrics: { ...left.orchestratorOutput!.metrics!, totalLatencyMs: 55000, estimatedCostUsd: 0.06, agentCount: 6, completedAgentCount: 6 },
      },
    };
    const diffs = computeScenarioDiff(left, right);
    expect(diffs.find((d) => d.id === 'recs')?.direction).toBe('changed');
    expect(diffs.find((d) => d.id === 'confidence')?.direction).toBe('up');
    expect(diffs.find((d) => d.id === 'evidence')?.direction).toBe('up');
    expect(diffs.find((d) => d.id === 'cost')?.direction).toBe('up');
  });
});
