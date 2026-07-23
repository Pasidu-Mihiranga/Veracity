import { describe, it, expect } from 'vitest';
import {
  buildPipelineStages,
  getRunForDomain,
  mapRunsToConvergeAgents,
} from '@/lib/agent-progress';
import type { AgentRun } from '@/lib/agents/types';

describe('getRunForDomain', () => {
  const runs: AgentRun[] = [
    { agentId: 'mirofish', name: 'MiroFish (Forecast)', status: 'completed' },
    { agentId: 'mirofish-live', name: 'MiroFish Live (Real VPS)', status: 'running' },
    { agentId: 'competitive', name: 'Competitive Landscape', status: 'completed' },
  ];

  it('prefers exact agentId matches', () => {
    expect(getRunForDomain(runs, 'competitive')?.agentId).toBe('competitive');
  });

  it('does not confuse mirofish with mirofish-live', () => {
    expect(getRunForDomain(runs, 'mirofish')?.agentId).toBe('mirofish');
    expect(getRunForDomain(runs, 'mirofish-live')?.agentId).toBe('mirofish-live');
  });
});

describe('buildPipelineStages', () => {
  it('marks synthesis completed when orchestration finished', () => {
    const stages = buildPipelineStages({
      orchestrationLines: ['reasoning about your query', 'synthesizing answer'],
      agentRuns: [
        { agentId: 'market-trends', name: 'Market', status: 'completed' },
        { agentId: 'competitive', name: 'Competitive', status: 'completed' },
      ],
      orchestratorOutput: { synthesizedAnswer: 'done', outputs: [], agentRuns: [] } as never,
      isLoading: false,
      executionEnabled: false,
    });
    expect(stages.find((s) => s.id === 'synthesis')?.state).toBe('completed');
    expect(stages.find((s) => s.id === 'research')?.state).toBe('completed');
  });
});

describe('mapRunsToConvergeAgents', () => {
  const runs: AgentRun[] = [
    {
      agentId: 'market-trends',
      name: 'Market',
      status: 'running',
      startedAt: new Date().toISOString(),
    },
    { agentId: 'competitive', name: 'Competitive', status: 'pending' },
  ];

  const getRun = (domain: string) => runs.find((r) => r.agentId === domain);

  it('maps running agents with progress and blocks post-research when research incomplete', () => {
    const agents = mapRunsToConvergeAgents({
      domains: ['market-trends', 'competitive', 'execution-engine'],
      getRunForDomain: getRun as never,
      orchestrationLines: ['Searching 24 sources for market trends'],
      isDark: true,
    });

    const market = agents.find((a) => a.id === 'market-trends');
    const exec = agents.find((a) => a.id === 'execution-engine');
    expect(market?.status).toBe('running');
    expect(typeof market?.progressPct).toBe('number');
    expect(market?.progressPct).toBeLessThan(100);
    expect(exec?.status).toBe('blocked');
    expect(exec?.waitingOn).toBe('Research');
    expect(market?.motionSeed).not.toBe(exec?.motionSeed);
  });

  it('marks completed agents done with completion summary when output present', () => {
    const doneRuns: AgentRun[] = [
      { agentId: 'market-trends', name: 'Market', status: 'completed' },
    ];
    const agents = mapRunsToConvergeAgents({
      domains: ['market-trends'],
      getRunForDomain: ((d: string) => doneRuns.find((r) => r.agentId === d)) as never,
      getOutputForDomain: () =>
        ({
          facts: ['a', 'b', 'c'],
          sources: [{ url: 'https://x.com', title: 'x', timestamp: '', tool: 'serpapi' }],
          confidence: 'high',
        }) as never,
      isDark: false,
    });
    expect(agents[0].status).toBe('done');
    expect(agents[0].completionSummary?.stats.some((s) => s.includes('finding'))).toBe(true);
  });
});
