import {
  formatPriorWaveFindings,
  mergePriorContext,
} from '@/lib/agents/workflow/format-prior-findings';
import type {
  WorkflowCallbacks,
  WorkflowExecutorInput,
  WorkflowExecutorResult,
  SharedScratchpad,
} from '@/lib/agents/workflow/types';
import type { AgentConfig, AgentOutput, AgentRun } from '@/lib/agents/types';
import type { MissionStep } from '@/lib/agents/mission-planner';

export function recordFacts(scratchpad: SharedScratchpad, agentId: string, facts: string[]) {
  const slice = facts.slice(0, 3);
  if (agentId === 'competitive') {
    for (const f of slice) scratchpad.competitorFacts.push(f);
  } else {
    for (const f of slice) scratchpad.productFacts.push(f);
  }
}

export function recordOpenQuestions(
  scratchpad: SharedScratchpad,
  output: AgentOutput,
) {
  const explicit = (output.openQuestions ?? [])
    .filter((question) => question.trim().length > 0)
    .slice(0, 3);
  const inferred = explicit.length === 0 && output.confidence !== 'high'
    ? [`What primary evidence would resolve the remaining ${output.domain.replace(/-/g, ' ')} uncertainty?`]
    : [];
  for (const question of [...explicit, ...inferred]) {
    if (!scratchpad.openQuestions.includes(question)) {
      scratchpad.openQuestions.push(question);
    }
  }
}

export type WaveRunnerState = {
  agentRuns: AgentRun[];
  outputs: AgentOutput[];
  agentLatencies: Record<string, number>;
  runIndex: Map<string, number>;
  basePriorContext: string | undefined;
  scratchpad: SharedScratchpad;
  agentsToRun: AgentConfig[];
  context: WorkflowExecutorInput['context'];
  cb: WorkflowCallbacks;
};

export function createWaveRunnerState(
  input: WorkflowExecutorInput,
  cb: WorkflowCallbacks,
): WaveRunnerState {
  const agentsToRun = input.agents;
  return {
    agentRuns: agentsToRun.map((a) => ({
      agentId: a.id,
      name: a.name,
      status: 'pending',
    })),
    outputs: [],
    agentLatencies: {},
    runIndex: new Map(agentsToRun.map((a, i) => [a.id, i])),
    basePriorContext: input.context.priorContext,
    scratchpad: input.scratchpad,
    agentsToRun,
    context: input.context,
    cb,
  };
}

export async function runOneAgent(
  state: WaveRunnerState,
  agent: AgentConfig,
): Promise<AgentOutput | null> {
  const i = state.runIndex.get(agent.id) ?? 0;
  const agentStart = Date.now();
  state.agentRuns[i] = {
    ...state.agentRuns[i],
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  state.cb.onAgentUpdate(state.agentRuns[i]);

  const waveFindings = formatPriorWaveFindings(state.scratchpad);
  const priorContext = mergePriorContext(state.basePriorContext, waveFindings);

  try {
    const output = await agent.run({
      ...state.context,
      priorContext,
      scratchpad: { ...state.scratchpad },
    });
    state.agentLatencies[agent.id] = Date.now() - agentStart;
    const synthError = output.interpretation.find((line) =>
      line.startsWith('SYNTHESIS_ERROR:'),
    );
    if (synthError) {
      state.agentRuns[i] = {
        ...state.agentRuns[i],
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: synthError.replace(/^SYNTHESIS_ERROR:\s*/, ''),
      };
    } else {
      state.agentRuns[i] = {
        ...state.agentRuns[i],
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
      recordFacts(state.scratchpad, agent.id, output.facts);
      recordOpenQuestions(state.scratchpad, output);
    }
    state.cb.onAgentUpdate(state.agentRuns[i]);
    return synthError ? null : output;
  } catch (err) {
    state.agentLatencies[agent.id] = Date.now() - agentStart;
    const error = err instanceof Error ? err.message : String(err);
    state.agentRuns[i] = {
      ...state.agentRuns[i],
      status: 'failed',
      completedAt: new Date().toISOString(),
      error,
    };
    state.cb.onAgentUpdate(state.agentRuns[i]);
    return null;
  }
}

/** Run a single parallel wave; throws on cancel. */
export async function runWave(
  state: WaveRunnerState,
  wave: MissionStep[],
): Promise<void> {
  if (state.cb.shouldCancel && (await state.cb.shouldCancel())) {
    state.cb.onOrchestrationLog?.('Cancel requested — stopping remaining mission waves.');
    throw new Error('Job cancelled');
  }
  const waveAgents = wave
    .map((s) => state.agentsToRun.find((a) => a.id === s.agentId))
    .filter(Boolean) as AgentConfig[];
  if (waveAgents.length === 0) return;
  const settled = await Promise.allSettled(waveAgents.map((a) => runOneAgent(state, a)));
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) state.outputs.push(r.value);
  }
}

export function toExecutorResult(state: WaveRunnerState): WorkflowExecutorResult {
  return {
    agentRuns: state.agentRuns,
    outputs: state.outputs,
    agentLatencies: state.agentLatencies,
  };
}
