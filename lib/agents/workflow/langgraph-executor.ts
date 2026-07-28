import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { missionWaves } from '@/lib/agents/mission-planner';
import {
  createWaveRunnerState,
  runWave,
  toExecutorResult,
} from '@/lib/agents/workflow/run-agents';
import type {
  WorkflowCallbacks,
  WorkflowExecutor,
  WorkflowExecutorInput,
  WorkflowExecutorResult,
} from '@/lib/agents/workflow/types';

/**
 * LangGraph wave executor — same agent/run semantics as CurrentExecutor,
 * with mission waves driven by a StateGraph control loop.
 *
 * Only imported when the feature flag is on (via getWorkflowExecutor).
 * Platform / agents / quality stack never depend on this module.
 */
export const langGraphExecutor: WorkflowExecutor = {
  id: 'langgraph',

  async execute(
    input: WorkflowExecutorInput,
    cb: WorkflowCallbacks,
  ): Promise<WorkflowExecutorResult> {
    const state = createWaveRunnerState(input, cb);
    const waves = missionWaves(input.steps);

    if (waves.length === 0) {
      return toExecutorResult(state);
    }

    const WaveState = Annotation.Root({
      waveIndex: Annotation<number>,
    });

    const graph = new StateGraph(WaveState)
      .addNode('run_wave', async (graphState) => {
        const idx = graphState.waveIndex;
        const wave = waves[idx];
        if (wave) {
          await runWave(state, wave);
        }
        return { waveIndex: idx + 1 };
      })
      .addEdge(START, 'run_wave')
      .addConditionalEdges('run_wave', (graphState) =>
        graphState.waveIndex < waves.length ? 'run_wave' : END,
      )
      .compile();

    await graph.invoke({ waveIndex: 0 });
    return toExecutorResult(state);
  },
};
