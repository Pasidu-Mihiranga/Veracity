import { describe, expect, it } from 'vitest';
import { planMission } from '@/lib/agents/mission-planner';
import { currentExecutor } from '@/lib/agents/workflow/current-executor';
import {
  formatPriorWaveFindings,
  mergePriorContext,
} from '@/lib/agents/workflow/format-prior-findings';
import { getWorkflowExecutor } from '@/lib/agents/workflow';
import type { AgentConfig, AgentContext, AgentOutput } from '@/lib/agents/types';

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

describe('formatPriorWaveFindings', () => {
  it('returns undefined when empty', () => {
    expect(
      formatPriorWaveFindings({ productFacts: [], competitorFacts: [], openQuestions: [] }),
    ).toBeUndefined();
  });

  it('formats product and competitor facts', () => {
    const text = formatPriorWaveFindings({
      productFacts: ['Product grew 20%'],
      competitorFacts: ['Rival launched X'],
      openQuestions: ['Pricing unclear?'],
    });
    expect(text).toContain('Prior research findings (product)');
    expect(text).toContain('Product grew 20%');
    expect(text).toContain('Rival launched X');
    expect(text).toContain('Pricing unclear?');
  });

  it('mergePriorContext joins base and wave findings', () => {
    expect(mergePriorContext('User: hi', 'Prior research findings (product):\n- fact')).toContain(
      'User: hi',
    );
    expect(mergePriorContext(undefined, undefined)).toBeUndefined();
  });
});

describe('currentExecutor', () => {
  it('runs waves and injects prior findings into later agents', async () => {
    const seenPrior: string[] = [];
    const competitive: AgentConfig = {
      id: 'competitive',
      name: 'Competitive',
      description: 'test',
      run: async (ctx: AgentContext) => {
        seenPrior.push(ctx.priorContext ?? '');
        return stubOutput('competitive', ['Competitor priced at $99']);
      },
    };
    const winLoss: AgentConfig = {
      id: 'win-loss',
      name: 'Win/Loss',
      description: 'test',
      run: async (ctx: AgentContext) => {
        seenPrior.push(ctx.priorContext ?? '');
        return stubOutput('win-loss', ['Buyers cite support']);
      },
    };

    const steps = planMission(['competitive', 'win-loss']);
    const scratchpad = { productFacts: [], competitorFacts: [], openQuestions: [] };
    const updates: string[] = [];

    const result = await currentExecutor.execute(
      {
        steps,
        agents: [competitive, winLoss],
        context: {
          query: 'Compare us vs Rival',
          product: 'Us',
          competitor: 'Rival',
          priorContext: 'User: compare',
        },
        scratchpad,
      },
      {
        onAgentUpdate: (run) => updates.push(`${run.agentId}:${run.status}`),
      },
    );

    expect(result.outputs).toHaveLength(2);
    expect(result.agentRuns.every((r) => r.status === 'completed')).toBe(true);
    expect(scratchpad.competitorFacts).toContain('Competitor priced at $99');
    // win-loss runs in a later wave and should see competitive facts
    const winLossPrior = seenPrior[1] ?? seenPrior.find((p) => p.includes('Competitor priced'));
    expect(winLossPrior).toContain('Competitor priced at $99');
    expect(updates.some((u) => u.includes('running'))).toBe(true);
  });

  it('marks SYNTHESIS_ERROR agents as failed and skips their output', async () => {
    const broken: AgentConfig = {
      id: 'pricing',
      name: 'Pricing',
      description: 'test',
      run: async () => ({
        ...stubOutput('pricing', []),
        interpretation: ['SYNTHESIS_ERROR: boom'],
      }),
    };
    const steps = planMission(['pricing']);
    const result = await currentExecutor.execute(
      {
        steps,
        agents: [broken],
        context: { query: 'q', product: 'P' },
        scratchpad: { productFacts: [], competitorFacts: [], openQuestions: [] },
      },
      { onAgentUpdate: () => undefined },
    );
    expect(result.outputs).toHaveLength(0);
    expect(result.agentRuns[0]?.status).toBe('failed');
  });

  it('throws when shouldCancel returns true before a wave', async () => {
    const agent: AgentConfig = {
      id: 'market-trends',
      name: 'Market',
      description: 'test',
      run: async () => stubOutput('market-trends', ['x']),
    };
    await expect(
      currentExecutor.execute(
        {
          steps: planMission(['market-trends']),
          agents: [agent],
          context: { query: 'q', product: 'P' },
          scratchpad: { productFacts: [], competitorFacts: [], openQuestions: [] },
        },
        {
          onAgentUpdate: () => undefined,
          shouldCancel: () => true,
        },
      ),
    ).rejects.toThrow(/cancelled/i);
  });
});

describe('getWorkflowExecutor', () => {
  it('selects executor from featureFlags.langgraphExecutor', async () => {
    const { featureFlags } = await import('@/lib/feature-flags');
    const exec = getWorkflowExecutor();
    expect(exec.id).toBe(featureFlags.langgraphExecutor ? 'langgraph' : 'current');
  });
});

/**
 * Full `orchestrate()` integration requires validated env (DATABASE_URL, AUTH_SECRET,
 * GEMINI_API_KEY). Covered separately once CI fixtures exist; wave-executor parity
 * above is the Phase 0 gate for the WorkflowExecutor abstraction.
 */
