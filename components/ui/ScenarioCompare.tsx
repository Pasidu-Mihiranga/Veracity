'use client';

import type { ChatMessage } from '@/types/chat-ui';
import { computeScenarioDiff } from '@/lib/scenario-diff';
import { EvidenceCoverageRadar } from '@/components/ui/EvidenceCoverageRadar';

type Props = {
  left: ChatMessage;
  right: ChatMessage;
  leftLabel?: string;
  rightLabel?: string;
};

export function ScenarioCompare({
  left,
  right,
  leftLabel = 'Scenario A',
  rightLabel = 'Scenario B',
}: Props) {
  const diffs = computeScenarioDiff(left, right);

  return (
    <div className="veracity-card p-4 flex flex-col gap-4">
      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        Scenario comparison
      </span>

      <div className="flex flex-wrap gap-2">
        {diffs.map((d) => (
          <span
            key={d.id}
            className={`text-[10px] font-mono px-2 py-1 rounded border ${
              d.direction === 'up'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : d.direction === 'down'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : d.direction === 'changed'
                    ? 'bg-accent/5 text-accent border-accent/20'
                    : 'bg-muted text-muted-foreground border-border'
            }`}
            title={d.detail}
          >
            {d.detail}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { msg: left, label: leftLabel },
          { msg: right, label: rightLabel },
        ].map(({ msg, label }) => (
          <div key={label} className="rounded-xl border border-border p-3 flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">{label}</span>
            <p className="text-sm text-foreground line-clamp-4">{msg.content}</p>
            {(msg.recommendations ?? []).slice(0, 3).map((r: { title?: string }, i: number) => (
              <p key={i} className="text-[12px] text-muted-foreground">• {r.title}</p>
            ))}
            {msg.orchestratorOutput?.evidenceCoverage ? (
              <EvidenceCoverageRadar axes={msg.orchestratorOutput.evidenceCoverage} />
            ) : null}
            <p className="text-[10px] font-mono text-muted-foreground">
              cost ${msg.orchestratorOutput?.metrics?.estimatedCostUsd?.toFixed(4) ?? '—'} ·{' '}
              {msg.orchestratorOutput?.totalConfidence ?? '—'} confidence
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
