'use client';

import type { ChatMessage } from '@/types/chat-ui';
import type { CompetitiveOutput, EvidenceCoverageAxis } from '@/lib/agents/types';

type Props = {
  message: ChatMessage;
};

const PILLARS: { key: string; label: string; axis?: EvidenceCoverageAxis['id'] }[] = [
  { key: 'market', label: 'Market position', axis: 'market' },
  { key: 'compete', label: 'Competitive edge', axis: 'competition' },
  { key: 'customer', label: 'Customer voice', axis: 'customers' },
  { key: 'tech', label: 'Messaging / tech', axis: 'technology' },
  { key: 'price', label: 'Pricing power', axis: 'pricing' },
];

/**
 * One-screen strategy pillars vs competitor, annotated with coverage scores.
 */
export function StrategyCanvas({ message }: Props) {
  const out = message.orchestratorOutput;
  if (!out) return null;

  const competitive = out.outputs?.find(
    (o): o is CompetitiveOutput =>
      o.artifactType === 'competitive-matrix' && !o.decisionUseSuppressed,
  );
  const coverage = new Map((out.evidenceCoverage ?? []).map((a) => [a.id, a]));
  const topRecs = (message.recommendations ?? out.topRecommendations ?? []).slice(0, 3);

  const advantageCount =
    competitive?.matrix?.filter((r) => r.gapDirection === 'advantage').length ?? 0;
  const gapCount =
    competitive?.matrix?.filter((r) => r.gapDirection === 'disadvantage').length ?? 0;

  return (
    <section className="results-panel p-5 lg:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="results-section-title">Business snapshot</p>
        <span className="text-[10px] font-mono text-muted-foreground">
          {out.product}
          {out.competitor ? ` vs ${out.competitor}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {PILLARS.map((p) => {
          const axis = p.axis ? coverage.get(p.axis) : undefined;
          const score = axis?.score ?? 0;
          const pct = Math.round(score * 100);
          return (
            <div key={p.key} className="veracity-card p-3 flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {p.label}
              </span>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${score >= 0.7 ? 'bg-emerald-500' : score >= 0.4 ? 'bg-accent' : 'bg-amber-500'}`}
                  style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-foreground">{pct}% evidence coverage</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Current strengths</p>
          <p className="text-sm text-foreground">
            {advantageCount > 0
              ? `${advantageCount} matrix advantages vs ${out.competitor || 'competitor'}.`
              : 'No clear advantage yet. We need more evidence before calling this a real strength.'}
          </p>
          {topRecs[0] ? (
            <p className="text-[12px] text-muted-foreground mt-2">Best next move: {String(topRecs[0].title)}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Current risks</p>
          <p className="text-sm text-foreground">
            {gapCount > 0
              ? `${gapCount} meaningful gaps still need attention.`
              : 'No clear weakness showed up yet, but customer evidence is still thin.'}
          </p>
          {topRecs[1] ? (
            <p className="text-[12px] text-muted-foreground mt-2">Watch closely: {String(topRecs[1].title)}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
