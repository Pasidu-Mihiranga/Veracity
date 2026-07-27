import { describe, expect, it } from 'vitest';
import { planMission } from '@/lib/agents/mission-planner';
import { currentExecutor } from '@/lib/agents/workflow/current-executor';
import { langGraphExecutor } from '@/lib/agents/workflow/langgraph-executor';
import { getWorkflowExecutor } from '@/lib/agents/workflow';
import type { AgentConfig, AgentContext, AgentOutput } from '@/lib/agents/types';
import type { WorkflowExecutor } from '@/lib/agents/workflow/types';

function stubOutput(agentId: string, facts: string[]): AgentOutput {
  return {
    agentId,
    domain: agentId as AgentOutput['domain'],
    confidence: 'high',
    confidenceScore: 0.8,
    facts,
    interpretation: ['ok'],
    sources: [],
    generatedAt: new Date().toISOString(),
    artifactType: 'competitive-matrix',
  };
}

function makeAgents(order: string[]): AgentConfig[] {
  return order.map((id) => ({
    id: id as AgentConfig['id'],
    name: id,
    description: 'test',
    run: async (ctx: AgentContext) =>
      stubOutput(id, [`${id}-fact`, `prior:${(ctx.priorContext ?? '').includes('competitive-fact') ? 'yes' : 'no'}`]),
  }));
}

async function runBoth(executors: WorkflowExecutor[]) {
  const agentIds = ['competitive', 'win-loss', 'market-trends'] as const;
  const steps = planMission([...agentIds]);
  const results = [];
  for (const exec of executors) {
    const scratchpad: {
      productFacts: string[];
      competitorFacts: string[];
      openQuestions: string[];
    } = { productFacts: [], competitorFacts: [], openQuestions: [] };
    const agents = makeAgents([...agentIds]);
    const result = await exec.execute(
      {
        steps,
        agents,
        context: { query: 'Compare Us vs Rival', product: 'Us', competitor: 'Rival', priorContext: 'User: compare' },
        scratchpad,
      },
      { onAgentUpdate: () => undefined },
    );
    results.push({
      id: exec.id,
      statuses: result.agentRuns.map((r) => `${r.agentId}:${r.status}`).sort(),
      outputIds: result.outputs.map((o) => o.agentId).sort(),
      competitorFacts: [...scratchpad.competitorFacts],
      productFacts: [...scratchpad.productFacts].sort(),
      winLossSawCompetitive: result.outputs
        .find((o) => o.agentId === 'win-loss')
        ?.facts.some((f) => f.includes('prior:yes')),
    });
  }
  return results;
}

describe('langGraphExecutor', () => {
  it('completes dependent waves and records scratchpad facts', async () => {
    const scratchpad: {
      productFacts: string[];
      competitorFacts: string[];
      openQuestions: string[];
    } = { productFacts: [], competitorFacts: [], openQuestions: [] };
    const steps = planMission(['competitive', 'win-loss']);
    const result = await langGraphExecutor.execute(
      {
        steps,
        agents: makeAgents(['competitive', 'win-loss']),
        context: { query: 'q', product: 'P', competitor: 'C' },
        scratchpad,
      },
      { onAgentUpdate: () => undefined },
    );
    expect(langGraphExecutor.id).toBe('langgraph');
    expect(result.agentRuns.every((r) => r.status === 'completed')).toBe(true);
    expect(result.outputs).toHaveLength(2);
    expect(scratchpad.competitorFacts.some((f) => f.includes('competitive-fact'))).toBe(true);
  });

  it('throws on cancel like CurrentExecutor', async () => {
    await expect(
      langGraphExecutor.execute(
        {
          steps: planMission(['market-trends']),
          agents: makeAgents(['market-trends']),
          context: { query: 'q', product: 'P' },
          scratchpad: { productFacts: [], competitorFacts: [], openQuestions: [] },
        },
        { onAgentUpdate: () => undefined, shouldCancel: () => true },
      ),
    ).rejects.toThrow(/cancelled/i);
  });
});

describe('executor parity', () => {
  it('CurrentExecutor and LangGraphExecutor produce matching agent outcomes', async () => {
    const [current, langgraph] = await runBoth([currentExecutor, langGraphExecutor]);
    expect(langgraph.statuses).toEqual(current.statuses);
    expect(langgraph.outputIds).toEqual(current.outputIds);
    expect(langgraph.competitorFacts).toEqual(current.competitorFacts);
    expect(langgraph.productFacts).toEqual(current.productFacts);
    expect(langgraph.winLossSawCompetitive).toBe(true);
    expect(current.winLossSawCompetitive).toBe(true);
  });
});

describe('getWorkflowExecutor flag', () => {
  it('selects executor from featureFlags.langgraphExecutor', async () => {
    const { featureFlags } = await import('@/lib/feature-flags');
    const exec = getWorkflowExecutor();
    expect(exec.id).toBe(featureFlags.langgraphExecutor ? 'langgraph' : 'current');
  });
});
