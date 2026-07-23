'use client';

import type { AgentRun } from '@/lib/agents/types';
import type { PipelineStage } from '@/types/chat-ui';

type Props = {
  agentRuns: AgentRun[];
  pipelineStages?: PipelineStage[];
  selectedAgentIds?: string[];
  isLoading?: boolean;
};

type NodeState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

function nodeClass(state: NodeState): string {
  switch (state) {
    case 'running':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'completed':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'failed':
      return 'bg-red-50 text-red-600 border-red-200';
    case 'skipped':
      return 'bg-muted text-muted-foreground border-border opacity-60';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function stageState(stages: PipelineStage[] | undefined, id: string, fallback: NodeState): NodeState {
  const s = stages?.find((x) => x.id === id);
  if (!s) return fallback;
  return s.state;
}

/**
 * Live DAG: Classify → Agents → Synth → Gate → Done
 */
export function LiveOrchestratorView({
  agentRuns,
  pipelineStages = [],
  selectedAgentIds,
  isLoading,
}: Props) {
  const selected = selectedAgentIds?.length
    ? new Set(selectedAgentIds)
    : null;

  const classify: NodeState = isLoading
    ? stageState(pipelineStages, 'classify', agentRuns.some((r) => r.status !== 'pending') ? 'completed' : 'running')
    : 'completed';

  const synth: NodeState = isLoading
    ? agentRuns.every((r) => r.status === 'completed' || r.status === 'failed')
      ? 'running'
      : 'pending'
    : 'completed';

  const gate: NodeState = isLoading
    ? synth === 'completed' || (!isLoading && agentRuns.length > 0)
      ? 'running'
      : 'pending'
    : 'completed';

  const done: NodeState = isLoading ? 'pending' : 'completed';

  return (
    <div className="veracity-card p-4 flex flex-col gap-3">
      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        Live orchestrator
      </span>
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
        <span className={`px-2 py-1 rounded border ${nodeClass(classify)}`}>Classify</span>
        <span className="text-muted-foreground">→</span>
        <div className="flex flex-wrap gap-1.5">
          {agentRuns.map((run) => {
            const skipped = selected && !selected.has(run.agentId);
            const state: NodeState = skipped ? 'skipped' : run.status;
            return (
              <span
                key={run.agentId}
                className={`px-2 py-1 rounded border ${nodeClass(state)}`}
                title={run.agentId}
              >
                {run.name}
              </span>
            );
          })}
          {agentRuns.length === 0 ? (
            <span className={`px-2 py-1 rounded border ${nodeClass('pending')}`}>Agents</span>
          ) : null}
        </div>
        <span className="text-muted-foreground">→</span>
        <span className={`px-2 py-1 rounded border ${nodeClass(synth)}`}>Synth</span>
        <span className="text-muted-foreground">→</span>
        <span className={`px-2 py-1 rounded border ${nodeClass(gate)}`}>Gate</span>
        <span className="text-muted-foreground">→</span>
        <span className={`px-2 py-1 rounded border ${nodeClass(done)}`}>Done</span>
      </div>
    </div>
  );
}
