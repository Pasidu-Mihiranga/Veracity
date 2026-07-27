import { featureFlags } from '@/lib/feature-flags';
import { currentExecutor } from '@/lib/agents/workflow/current-executor';
import type { WorkflowExecutor } from '@/lib/agents/workflow/types';

export type { WorkflowExecutor, WorkflowExecutorInput, WorkflowExecutorResult, WorkflowCallbacks, SharedScratchpad } from '@/lib/agents/workflow/types';
export { currentExecutor } from '@/lib/agents/workflow/current-executor';
export { formatPriorWaveFindings, mergePriorContext } from '@/lib/agents/workflow/format-prior-findings';

/**
 * Resolve the active wave executor. LangGraphExecutor is Phase 3 — until then
 * this always returns CurrentExecutor even if the flag is set, with a log path
 * reserved for future wiring.
 */
export function getWorkflowExecutor(): WorkflowExecutor {
  if (featureFlags.langgraphExecutor) {
    // Phase 3: return langGraphExecutor when implemented.
    // Until then, fall back to current to avoid breaking flag experiments.
    return currentExecutor;
  }
  return currentExecutor;
}
