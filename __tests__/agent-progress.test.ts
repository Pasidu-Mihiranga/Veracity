import { describe, it, expect } from 'vitest';
import { buildPipelineStages, getRunForDomain } from '@/lib/agent-progress';
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
