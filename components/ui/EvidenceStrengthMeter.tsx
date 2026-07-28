'use client';

import type { OutputQualityReport } from '@/lib/agents/types';

type Props = {
  quality: OutputQualityReport;
};

function pct(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

const PARTS: { key: keyof Pick<OutputQualityReport, 'toolHealth' | 'entityMatch' | 'agentAvg' | 'qualityGate'>; label: string }[] = [
  { key: 'toolHealth', label: 'System reliability' },
  { key: 'entityMatch', label: 'Right company/product match' },
  { key: 'agentAvg', label: 'Average research confidence' },
  { key: 'qualityGate', label: 'Final answer safety check' },
];

/**
 * Shows why overall confidence is high/medium/low via gate breakdown.
 */
export function EvidenceStrengthMeter({ quality }: Props) {
  const overall = pct(quality.evidenceScore);
  const tone =
    overall >= 70 ? 'emerald' : overall >= 45 ? 'amber' : 'red';

  const barClass =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="veracity-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          How trustworthy this answer is
        </span>
        <span className="text-xs font-mono text-foreground">{overall}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${overall}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PARTS.map(({ key, label }) => {
          const v = pct(quality[key]);
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex justify-between gap-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{v}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent/80"
                  style={{ width: `${v}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {quality.flags.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Warnings: {quality.flags.join(', ').replaceAll('_', ' ')}
        </p>
      ) : null}
    </div>
  );
}
