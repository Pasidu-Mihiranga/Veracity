'use client';

import type { EvidenceCoverageAxis } from '@/lib/agents/types';

type Props = {
  axes: EvidenceCoverageAxis[];
  /** Larger bars for Board Mode */
  large?: boolean;
};

function fillClass(score: number): string {
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.4) return 'bg-accent';
  return 'bg-amber-500';
}

/**
 * Horizontal domain coverage bars — demo-friendly Evidence Coverage Radar.
 */
export function EvidenceCoverageRadar({ axes, large = false }: Props) {
  if (!axes?.length) return null;

  return (
    <div className={`veracity-card ${large ? 'p-6' : 'p-4'} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Evidence coverage
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          Where signals are strong / thin
        </span>
      </div>
      <div className={`flex flex-col ${large ? 'gap-4' : 'gap-2.5'}`}>
        {axes.map((axis) => {
          const pct = Math.round(Math.max(0, Math.min(1, axis.score)) * 100);
          return (
            <div key={axis.id} className="flex flex-col gap-1" title={`${axis.sourceCount} sources · ${axis.agentIds.join(', ')}`}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono uppercase tracking-wider text-muted-foreground ${
                    large ? 'text-sm' : 'text-[11px]'
                  }`}
                  style={{ minWidth: large ? 110 : 88 }}
                >
                  {axis.label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {pct}% · {axis.sourceCount} src
                </span>
              </div>
              <div className={`rounded-full bg-muted overflow-hidden ${large ? 'h-3' : 'h-2'}`}>
                <div
                  className={`h-full rounded-full transition-all ${fillClass(axis.score)}`}
                  style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
