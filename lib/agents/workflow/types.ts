import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  AgentRun,
} from '@/lib/agents/types';
import type { MissionStep } from '@/lib/agents/mission-planner';

export type WorkflowExecutorId = 'current' | 'langgraph';

export type WorkflowCallbacks = {
  onAgentUpdate: (run: AgentRun) => void;
  onOrchestrationLog?: (msg: string) => void;
  shouldCancel?: () => Promise<boolean> | boolean;
};

export type SharedScratchpad = {
  productFacts: string[];
  competitorFacts: string[];
  openQuestions: string[];
};

export type WorkflowExecutorInput = {
  /** Research mission steps only (no execution-engine). */
  steps: MissionStep[];
  agents: AgentConfig[];
  context: AgentContext;
  scratchpad: SharedScratchpad;
};

export type WorkflowExecutorResult = {
  agentRuns: AgentRun[];
  outputs: AgentOutput[];
  agentLatencies: Record<string, number>;
};

export interface WorkflowExecutor {
  readonly id: WorkflowExecutorId;
  execute(
    input: WorkflowExecutorInput,
    cb: WorkflowCallbacks,
  ): Promise<WorkflowExecutorResult>;
}
