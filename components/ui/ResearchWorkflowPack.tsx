'use client';

import { Search, ShieldCheck } from 'lucide-react';
import type { OrchestratorOutput } from '@/lib/agents/types';

type Props = {
  output?: OrchestratorOutput;
};

const STATUS_CLASS = {
  verified: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  open: 'bg-red-50 text-red-600 border-red-200',
} as const;

const SUPPORT_CLASS = {
  supported: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'weakly-supported': 'bg-amber-50 text-amber-700 border-amber-200',
  unsupported: 'bg-red-50 text-red-600 border-red-200',
} as const;

export function ResearchWorkflowPack({ output }: Props) {
  if (!output) return null;
  const diligence = output.dueDiligencePack;
  const comparison = output.comparisonContract;
  const investigation = output.investigationPlan;
  if (!diligence && !comparison && !investigation?.proposedNextProbes.length) return null;

  return (
    <section className="flex flex-col gap-4">
      {diligence ? (
        <div className="veracity-card p-5 lg:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Acquisition diligence · {diligence.target}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diligence.sections.map((section) => (
              <div key={section.id} className="veracity-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-foreground">{section.label}</h4>
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[section.status]}`}>
                    {section.status}
                  </span>
                </div>
                {section.findings.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {section.findings.slice(0, 3).map((finding) => (
                      <li key={finding} className="text-xs text-muted-foreground">• {finding}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No verified finding yet.</p>
                )}
                {section.openItems.slice(0, 2).map((item) => (
                  <p key={item} className="text-[11px] text-amber-700">Open: {item}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {comparison ? (
        <div className="veracity-card p-5 lg:p-6 flex flex-col gap-4 overflow-x-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Shared-dimension comparison
          </p>
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-[10px] font-mono uppercase text-muted-foreground">Dimension</th>
                {comparison.entities.map((entity) => (
                  <th key={entity} className="py-2 px-3 text-[10px] font-mono uppercase text-muted-foreground">
                    {entity}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.dimensions.map((dimension) => (
                <tr key={dimension.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-3 pr-3 text-xs font-medium text-foreground">{dimension.label}</td>
                  {dimension.cells.map((cell) => (
                    <td key={cell.entity} className="py-3 px-3">
                      <span className={`inline-flex text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border mb-1.5 ${SUPPORT_CLASS[cell.confidence]}`}>
                        {cell.confidence.replace('-', ' ')}
                      </span>
                      <p className="text-xs text-muted-foreground">{cell.finding}</p>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {investigation?.proposedNextProbes.length ? (
        <div className="veracity-card p-5 lg:p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-accent" />
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Next investigation probes
            </p>
          </div>
          {investigation.proposedNextProbes.slice(0, 5).map((probe) => (
            <div key={probe.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
              <div>
                <p className="text-xs text-foreground">{probe.question}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  {probe.domain.replace(/-/g, ' ')} · {probe.sourceType}
                </p>
              </div>
              <span className={`shrink-0 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                probe.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                {probe.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

