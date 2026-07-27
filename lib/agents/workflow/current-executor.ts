import { missionWaves } from '@/lib/agents/mission-planner';
import {
  formatPriorWaveFindings,
  mergePriorContext,
} from '@/lib/agents/workflow/format-prior-findings';
import type {
  WorkflowCallbacks,
  WorkflowExecutor,
  WorkflowExecutorInput,
  WorkflowExecutorResult,
  SharedScratchpad,
} from '@/lib/agents/workflow/types';
import type { AgentConfig, AgentOutput, AgentRun } from '@/lib/agents/types';

function recordFacts(scratchpad: SharedScratchpad, agentId: string, facts: string[]) {
  const slice = facts.slice(0, 3);
  if (agentId === 'competitive') {
    for (const f of slice) scratchpad.competitorFacts.push(f);
  } else {
    for (const f of slice) scratchpad.productFacts.push(f);
  }
}

/**
 * Current (custom) wave executor — behaviour-preserving extraction of the
 * mission-wave loop from orchestrate(). LangGraph must mirror this contract.
 */
export const currentExecutor: WorkflowExecutor = {
  id: 'current',

  async execute(
    input: WorkflowExecutorInput,
    cb: WorkflowCallbacks,
  ): Promise<WorkflowExecutorResult> {
    const { steps, agents, scratchpad } = input;
    const basePriorContext = input.context.priorContext;
    const agentsToRun = agents;
    const agentRuns: AgentRun[] = agentsToRun.map((a) => ({
      agentId: a.id,
      name: a.name,
      status: 'pending',
    }));
    const agentLatencies: Record<string, number> = {};
    const outputs: AgentOutput[] = [];
    const runIndex = new Map(agentsToRun.map((a, i) => [a.id, i]));
    const waves = missionWaves(steps);

    const runOneAgent = async (agent: AgentConfig): Promise<AgentOutput | null> => {
      const i = runIndex.get(agent.id) ?? 0;
      const agentStart = Date.now();
      agentRuns[i] = {
        ...agentRuns[i],
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      cb.onAgentUpdate(agentRuns[i]);

      const waveFindings = formatPriorWaveFindings(scratchpad);
      const priorContext = mergePriorContext(basePriorContext, waveFindings);

      try {
        const output = await agent.run({
          ...input.context,
          priorContext,
          scratchpad: { ...scratchpad },
        });
        agentLatencies[agent.id] = Date.now() - agentStart;
        const synthError = output.interpretation.find((line) =>
          line.startsWith('SYNTHESIS_ERROR:'),
        );
        if (synthError) {
          agentRuns[i] = {
            ...agentRuns[i],
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: synthError.replace(/^SYNTHESIS_ERROR:\s*/, ''),
          };
        } else {
          agentRuns[i] = {
            ...agentRuns[i],
            status: 'completed',
            completedAt: new Date().toISOString(),
          };
          recordFacts(scratchpad, agent.id, output.facts);
        }
        cb.onAgentUpdate(agentRuns[i]);
        return synthError ? null : output;
      } catch (err) {
        agentLatencies[agent.id] = Date.now() - agentStart;
        const error = err instanceof Error ? err.message : String(err);
        agentRuns[i] = {
          ...agentRuns[i],
          status: 'failed',
          completedAt: new Date().toISOString(),
          error,
        };
        cb.onAgentUpdate(agentRuns[i]);
        return null;
      }
    };

    for (const wave of waves) {
      if (cb.shouldCancel && (await cb.shouldCancel())) {
        cb.onOrchestrationLog?.('Cancel requested — stopping remaining mission waves.');
        throw new Error('Job cancelled');
      }
      const waveAgents = wave
        .map((s) => agentsToRun.find((a) => a.id === s.agentId))
        .filter(Boolean) as AgentConfig[];
      if (waveAgents.length === 0) continue;
      const settled = await Promise.allSettled(waveAgents.map((a) => runOneAgent(a)));
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) outputs.push(r.value);
      }
    }

    return { agentRuns, outputs, agentLatencies };
  },
};
