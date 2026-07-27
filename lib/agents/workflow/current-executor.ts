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
 * Current (custom) wave executor — sequential mission waves via Promise.allSettled.
 * Shares agent-run helpers with LangGraphExecutor for behaviour parity.
 */
export const currentExecutor: WorkflowExecutor = {
  id: 'current',

  async execute(
    input: WorkflowExecutorInput,
    cb: WorkflowCallbacks,
  ): Promise<WorkflowExecutorResult> {
    const state = createWaveRunnerState(input, cb);
    const waves = missionWaves(input.steps);
    for (const wave of waves) {
      await runWave(state, wave);
    }
    return toExecutorResult(state);
  },
};
