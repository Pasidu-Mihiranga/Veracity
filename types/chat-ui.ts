import type { AgentRun, OrchestratorOutput } from '@/lib/agents/types';

export type ProductViewMode = 'executive' | 'business' | 'analyst' | 'developer';

export type SourceLink = { title: string; url: string };

export type AttachedImage = {
  dataUrl: string;
  data: string;
  mimeType: string;
  name: string;
};

export type LiveRunMetrics = {
  elapsedMs: number;
  agentCount: number;
  completedAgentCount: number;
  failedAgentCount: number;
  runningAgentCount: number;
  estimatedCostUsd: number;
  geminiCallCount: number;
  toolCallCount: number;
};

export type ChatMessage = {
  id: number;
  /** Persisted chat_messages row id for refine/feedback. */
  persistedId?: string | null;
  role: 'user' | 'assistant';
  type?: 'text' | 'intelligence';
  content: string;
  images?: AttachedImage[];
  sources?: SourceLink[];
  suggestions?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommendations?: any[];
  agentRuns?: AgentRun[];
  orchestratorOutput?: OrchestratorOutput;
  liveMetrics?: LiveRunMetrics;
  /** Live backend status lines while the chat stream is open (also persisted after Phase 4). */
  orchestrationLog?: string[];
  /** 0–100 mission progress while running */
  progressPct?: number;
  missionSummary?: Record<string, unknown> | null;
  activeJobId?: string | null;
};

export type FollowUp = {
  id: number;
  question: string;
  answer: string;
  sources?: SourceLink[];
  loading?: boolean;
};

export type PipelineStageState = 'pending' | 'running' | 'completed' | 'failed';

export type PipelineStage = {
  id: string;
  label: string;
  state: PipelineStageState;
};

export type SessionUsage = {
  queries: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  totalGeminiCalls: number;
  totalToolCalls: number;
};

export type ChatStreamChunk =
  | { type: 'agent_update'; run: AgentRun; metrics: LiveRunMetrics }
  | { type: 'orchestration_log'; line: string }
  | { type: 'progress'; pct: number; label?: string; completedSteps?: number; totalSteps?: number }
  | { type: 'mission_summary'; summary: Record<string, unknown> }
  | { type: 'job_started'; jobId: string }
  | { type: 'result'; output: OrchestratorOutput }
  | { type: 'mirofish_result'; output: import('@/lib/agents/types').AgentOutput }
  | { type: 'mirofish_live_result'; output: import('@/lib/agents/types').AgentOutput }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
