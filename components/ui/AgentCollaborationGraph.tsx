'use client';

import type { AgentRun } from '@/lib/agents/types';

type MissionStepLite = {
  id: string;
  label: string;
  agentId: string;
  dependsOn?: string[];
  rationale?: string;
};

type Props = {
  product?: string;
  competitor?: string;
  agentRuns: AgentRun[];
  selectedAgentIds?: string[];
  missionSteps?: MissionStepLite[];
};

const MISSION_ORDER = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
  'execution-engine',
] as const;

/**
 * Lite collaboration graph + ordered mission steps from Mission Planner (or run fallback).
 */
export function AgentCollaborationGraph({
  product,
  competitor,
  agentRuns,
  selectedAgentIds,
  missionSteps,
}: Props) {
  const selected = selectedAgentIds?.length
    ? new Set(selectedAgentIds)
    : null;

  const byId = new Map(agentRuns.map((r) => [r.agentId, r]));

  const steps = missionSteps?.length
    ? missionSteps.map((s, index) => {
      const run = byId.get(s.agentId);
      return {
        id: s.id,
        step: index + 1,
        name: s.label || run?.name || s.agentId,
        status: run?.status ?? 'pending',
        dependsOn: s.dependsOn ?? [],
      };
    })
    : MISSION_ORDER.filter((id) => byId.has(id) || (selected?.has(id) ?? false))
      .map((id, index) => {
        const run = byId.get(id);
        const skipped = selected ? !selected.has(id) : false;
        return {
          id,
          step: index + 1,
          name: run?.name ?? id,
          status: skipped ? 'skipped' : run?.status ?? 'pending',
          dependsOn: [] as string[],
        };
      });

  if (steps.length === 0 && !product) return null;

  return (
    <div className="veracity-card p-4 flex flex-col gap-3">
      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        Mission DAG · collaboration
      </span>
      <p className="text-[12px] text-muted-foreground">
        Shared context:{' '}
        <span className="font-mono text-accent">{product || 'product'}</span>
        {competitor ? (
          <>
            {' '}vs <span className="font-mono text-accent">{competitor}</span>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`rounded-xl border px-3 py-2 min-w-[7rem] ${
                s.status === 'completed'
                  ? 'bg-emerald-50 border-emerald-200'
                  : s.status === 'running'
                    ? 'bg-amber-50 border-amber-200'
                    : s.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-muted border-border'
              }`}
              title={s.dependsOn?.length ? `Depends on: ${s.dependsOn.join(', ')}` : undefined}
            >
              <div className="text-[9px] font-mono uppercase text-muted-foreground">
                Step {s.step}
              </div>
              <div className="text-[11px] font-medium text-foreground truncate">{s.name}</div>
              <div className="text-[9px] font-mono text-muted-foreground">{s.status}</div>
            </div>
            {i < steps.length - 1 ? (
              <span className="text-muted-foreground text-xs">→</span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Research agents share product/competitor context; execution (if enabled) depends on Stage 1
        outputs.
      </p>
    </div>
  );
}
