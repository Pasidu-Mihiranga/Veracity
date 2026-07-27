import { featureFlags } from '@/lib/feature-flags';
import { currentExecutor } from '@/lib/agents/workflow/current-executor';
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
 * LangGraph is selected only when `featureFlags.langgraphExecutor` is true (default OFF).
 */
export function getWorkflowExecutor(): WorkflowExecutor {
  if (featureFlags.langgraphExecutor) {
    // Lazy load so default path does not initialize the graph module eagerly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./langgraph-executor') as typeof import('./langgraph-executor');
    return mod.langGraphExecutor;
  }
  return currentExecutor;
}
