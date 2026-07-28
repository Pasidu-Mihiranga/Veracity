import { featureFlags } from '@/lib/feature-flags';
import { currentExecutor } from '@/lib/agents/workflow/current-executor';
import { langGraphExecutor } from '@/lib/agents/workflow/langgraph-executor';
import type { WorkflowExecutor } from '@/lib/agents/workflow/types';

export type {
  WorkflowExecutor,
  WorkflowExecutorInput,
  WorkflowExecutorResult,
  WorkflowCallbacks,
  SharedScratchpad,
} from '@/lib/agents/workflow/types';
export { currentExecutor } from '@/lib/agents/workflow/current-executor';
export { langGraphExecutor } from '@/lib/agents/workflow/langgraph-executor';
export { formatPriorWaveFindings, mergePriorContext } from '@/lib/agents/workflow/format-prior-findings';

/**
 * Resolve the active wave executor.
 * LangGraph is selected only when `featureFlags.langgraphExecutor` is true (default OFF in code;
 * enable locally via NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR=1).
 */
export function getWorkflowExecutor(): WorkflowExecutor {
  if (featureFlags.langgraphExecutor) {
    return langGraphExecutor;
  }
  return currentExecutor;
}
