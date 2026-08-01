'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Download, Fish, FlaskConical, Users } from 'lucide-react';
import type { DistributionBucket, ForecastSignal, SwarmScenarioOutput } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme-provider';
import { downloadCsv, rowsToCsv } from '@/lib/csv-download';

function Distribution({ buckets }: { buckets: DistributionBucket[] }) {
  if (!buckets.length) return null;
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
  return (
    <div className="flex flex-col gap-3">
      <p className="label-mono">Scenario response distribution</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(buckets.length, 6)}, minmax(0, 1fr))` }}>
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex min-w-0 flex-col justify-end gap-1.5 text-center">
            <span className="text-[11px] font-mono text-muted-foreground">{bucket.count}</span>
            <div className="flex h-24 items-end rounded-lg bg-muted/60 p-1">
              <div
                className="w-full rounded-md bg-accent/70"
                style={{ height: `${bucket.count === 0 ? 0 : Math.max(5, (bucket.count / max) * 100)}%` }}
              />
            </div>
            <span className="truncate text-[10px] font-mono text-muted-foreground" title={bucket.label}>
              {bucket.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Perspectives({ perspectives }: { perspectives: ForecastSignal[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!perspectives.length) return null;
  const visible = expanded ? perspectives : perspectives.slice(0, 4);
  return (
    <div className="flex flex-col gap-2">
      <p className="label-mono">Distinct synthetic perspectives</p>
      {visible.map((perspective, index) => (
        <div key={`${perspective.persona}-${index}`} className="rounded-xl bg-muted/60 p-3">
          <p className="text-[12px] font-semibold text-foreground">{perspective.persona}</p>
          {perspective.excerpt ? (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">“{perspective.excerpt}”</p>
          ) : null}
        </div>
      ))}
      {perspectives.length > 4 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-1 self-start text-[10px] font-mono text-accent"
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Show fewer' : `Show ${perspectives.length - 4} more`}
        </button>
      ) : null}
    </div>
  );
}

export function SwarmScenarioChart({ output }: { output: SwarmScenarioOutput; product: string }) {
  const { border, surface, surface2, text, textMuted } = useTheme();
  const downloadData = () => {
    const distributionRows = output.distribution.map((bucket) => [
      'distribution', bucket.label, bucket.count, '', '', '',
    ]);
    const perspectiveRows = output.perspectives.map((perspective) => [
      'perspective', '', '', perspective.persona, perspective.weight, perspective.excerpt ?? '',
    ]);
    downloadCsv('veracity-synthetic-scenario.csv', rowsToCsv(
      ['row_type', 'category', 'count', 'persona', 'weight', 'excerpt'],
      [...distributionRows, ...perspectiveRows],
    ));
  };
  return (
    <div className="veracity-card flex w-full flex-col gap-5 p-6 lg:p-7" style={{ background: surface }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-accent">
            <Fish size={16} />
            <span className="text-[10px] font-mono uppercase tracking-wider">Swarm Decision Lab</span>
          </div>
          <h3 className="text-[16px] font-semibold leading-snug" style={{ color: text }}>{output.question}</h3>
        </div>
        <button type="button" onClick={downloadData} className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:opacity-80">
          <Download size={11} /> Download scenario CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl p-4" style={{ background: surface2, border: `1px solid ${border}` }}>
          <Users size={14} className="mb-2 text-accent" />
          <p className="text-xl font-semibold" style={{ color: text }}>{output.swarmSize}</p>
          <p className="text-[10px] font-mono uppercase" style={{ color: textMuted }}>Synthetic personas</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: surface2, border: `1px solid ${border}` }}>
          <FlaskConical size={14} className="mb-2 text-accent" />
          <p className="text-[13px] font-semibold" style={{ color: text }}>{output.timeHorizon || 'Not specified'}</p>
          <p className="text-[10px] font-mono uppercase" style={{ color: textMuted }}>Scenario horizon</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: surface2, border: `1px solid ${border}` }}>
          <AlertTriangle size={14} className="mb-2 text-amber-500" />
          <p className="text-[13px] font-semibold" style={{ color: text }}>{output.limitations.length}</p>
          <p className="text-[10px] font-mono uppercase" style={{ color: textMuted }}>Recorded limitations</p>
        </div>
      </div>

      <Distribution buckets={output.distribution ?? []} />

      {output.scenarioObservations.length > 0 ? (
        <div className="rounded-xl p-4" style={{ background: surface2, border: `1px solid ${border}` }}>
          <p className="label-mono mb-2">Scenario observations</p>
          <ul className="flex flex-col gap-1.5">
            {output.scenarioObservations.map((observation, index) => (
              <li key={index} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: text }}>
                <span className="text-accent">›</span><span>{observation}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Perspectives perspectives={output.perspectives ?? []} />

      {output.rationale ? (
        <div className="rounded-xl p-4" style={{ border: `1px solid ${border}` }}>
          <p className="label-mono mb-2">Scenario synthesis</p>
          <p className="text-[13px] leading-relaxed" style={{ color: text }}>{output.rationale}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
        <p className="text-[10px] font-mono uppercase text-amber-700 dark:text-amber-300">Method and limitations</p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: textMuted }}>{output.methodology}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {output.limitations.map((limitation, index) => (
            <li key={index} className="text-[11px] leading-relaxed" style={{ color: textMuted }}>• {limitation}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
