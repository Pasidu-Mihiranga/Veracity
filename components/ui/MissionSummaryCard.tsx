'use client';

import type { MissionSummary } from '@/lib/agents/mission-summary';

type Props = {
  summary: MissionSummary | Record<string, unknown>;
};

export function MissionSummaryCard({ summary }: Props) {
  const steps = (summary.steps as Array<{ id?: string; label: string }> | undefined) ?? [];
  const agentCount = Number(summary.agentCount ?? steps.length);
  const estimatedSeconds = Number(summary.estimatedSeconds ?? agentCount * 12);
  const estimatedCostUsd = Number(summary.estimatedCostUsd ?? 0);
  const objective = typeof summary.objective === 'string' ? summary.objective : undefined;
  const intent = typeof summary.intent === 'string' ? summary.intent.replace(/_/g, ' ') : undefined;
  const deliverables = Array.isArray(summary.deliverables)
    ? summary.deliverables.filter((item): item is string => typeof item === 'string')
    : [];

  if (steps.length === 0 && !agentCount) return null;

  return (
    <div className="veracity-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {intent ? `${intent} mission` : 'What the system checked'}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          About {agentCount} research steps · ~{estimatedSeconds}s · ~${estimatedCostUsd.toFixed(3)}
        </span>
      </div>
      {objective ? <p className="text-sm text-muted-foreground">{objective}</p> : null}
      <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
        {steps.map((s, i) => (
          <li key={s.id ?? `${s.label}-${i}`} className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-emerald-600 font-mono text-xs">✓</span>
            {s.label}
          </li>
        ))}
      </ul>
      {deliverables.length > 0 ? (
        <p className="text-[10px] font-mono text-muted-foreground">
          Deliverables: {deliverables.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
