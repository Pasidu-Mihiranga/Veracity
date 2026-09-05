'use client';

import { useCallback, useEffect, useState } from 'react';
import { Presentation, X } from 'lucide-react';
import type { ChatMessage } from '@/types/chat-ui';
import { EvidenceCoverageRadar } from '@/components/ui/EvidenceCoverageRadar';
import { featureFlags } from '@/lib/feature-flags';
import type { Recommendation } from '@/lib/agents/types';

type Props = {
  message: ChatMessage;
};

type SlideId = 'decision' | 'coverage' | 'recs' | 'matrix' | 'context' | 'sources';

const SLIDES: { id: SlideId; label: string }[] = [
  { id: 'decision', label: 'Decision' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'recs', label: 'Recommendations' },
  { id: 'matrix', label: 'Battlefield' },
  { id: 'context', label: 'Timeline & Memory' },
  { id: 'sources', label: 'Sources' },
];

/**
 * Full-screen Executive Board / Presentation Mode.
 */
export function ExecutiveBoardMode({ message }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setIndex(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!featureFlags.boardMode) return null;

  const slide = SLIDES[index];
  const out = message.orchestratorOutput;
  const competitive = out?.outputs?.find(
    (o) => o.artifactType === 'competitive-matrix' && !o.decisionUseSuppressed,
  ) as
    | { matrix?: Array<{ feature: string; yourProduct: string; competitor: string; gapDirection: string }>; competitor?: string }
    | undefined;
  const boardPack = out?.boardPack;
  const comparison = out?.comparisonContract;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-accent/20 bg-accent/5 text-accent hover:bg-accent/10 transition-colors"
      >
        <Presentation size={14} />
        Board Mode
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Executive Board Mode"
        >
          <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Veracity · Board Mode
              </p>
              <h2 className="font-serif text-xl text-foreground">
                {out?.product ?? 'Intelligence'} {out?.competitor ? `vs ${out.competitor}` : ''}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground">
                {index + 1}/{SLIDES.length} · ← → Esc
              </span>
              <button
                type="button"
                onClick={close}
                className="p-2 rounded-lg hover:bg-muted"
                aria-label="Close Board Mode"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <nav className="flex flex-wrap gap-2 px-6 py-3 border-b border-border">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  i === index
                    ? 'bg-accent/10 text-accent border-accent/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10 max-w-5xl w-full mx-auto">
            {slide.id === 'decision' && (
              <div className="flex flex-col gap-6">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Decision</p>
                <p className="text-lg sm:text-2xl md:text-3xl leading-snug text-foreground whitespace-pre-wrap">
                  {boardPack?.executiveBrief ?? message.content}
                </p>
                {boardPack?.decision ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="veracity-card p-5">
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Situation</p>
                      <p className="text-sm text-foreground">{boardPack.decision.situation}</p>
                    </div>
                    <div className="veracity-card p-5">
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Recommendation</p>
                      <p className="text-sm text-foreground">{boardPack.decision.recommendation}</p>
                    </div>
                    <div className="veracity-card p-5">
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Criteria</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {boardPack.decision.criteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}
                      </ul>
                    </div>
                    <div className="veracity-card p-5">
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">What would change this</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {boardPack.decision.falsifiers.map((falsifier) => <li key={falsifier}>• {falsifier}</li>)}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {slide.id === 'coverage' && (
              <div className="flex flex-col gap-6">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Where evidence is strong or thin
                </p>
                {out?.evidenceCoverage ? (
                  <EvidenceCoverageRadar axes={out.evidenceCoverage} large />
                ) : (
                  <p className="text-muted-foreground">Coverage data unavailable for this run.</p>
                )}
              </div>
            )}

            {slide.id === 'recs' && (
              <div className="flex flex-col gap-5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Recommendations
                </p>
                {(message.recommendations ?? out?.topRecommendations ?? []).map((rec: Partial<Recommendation>, i: number) => (
                  <div key={i} className="veracity-card p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold text-accent">#{rec.rank ?? i + 1}</span>
                      <span className="text-[10px] font-mono uppercase text-accent">{rec.priority}</span>
                      {rec.evidenceStatus ? (
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          rec.evidenceStatus === 'supported'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : rec.evidenceStatus === 'weakly-supported'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {rec.evidenceStatus.replace('-', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-medium text-foreground">{rec.title}</h3>
                    <p className="text-muted-foreground">{rec.rationale}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      Impact {rec.impact ?? 'unknown'} · Effort {rec.effort ?? 'unknown'} · {rec.timing ?? 'timing unknown'} · Owner {rec.ownerSuggestion ?? 'unassigned'}
                    </p>
                    {rec.riskOfInaction ? <p className="text-sm text-amber-700">Risk of inaction: {rec.riskOfInaction}</p> : null}
                    {rec.falsifier ? <p className="text-sm text-muted-foreground">Falsifier: {rec.falsifier}</p> : null}
                    {(rec.sourceUrls?.length ?? 0) > 0 ? (
                      <ul className="flex flex-col gap-1 mt-1">
                        {rec.sourceUrls!.slice(0, 3).map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {slide.id === 'matrix' && (
              <div className="flex flex-col gap-5">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Competitive battlefield{competitive?.competitor ? ` · ${competitive.competitor}` : ''}
                </p>
                {comparison ? (
                  <div className="veracity-card overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] font-mono uppercase text-muted-foreground">
                          <th className="p-3">Dimension</th>
                          {comparison.entities.map((entity) => <th key={entity} className="p-3">{entity}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.dimensions.map((dimension) => (
                          <tr key={dimension.id} className="border-b border-border/60 align-top">
                            <td className="p-3 font-medium">{dimension.label}</td>
                            {dimension.cells.map((cell) => (
                              <td key={cell.entity} className="p-3">
                                <p>{cell.finding}</p>
                                <span className="text-[9px] font-mono uppercase text-muted-foreground">{cell.confidence}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (competitive?.matrix?.length ?? 0) > 0 ? (
                  <div className="veracity-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] font-mono uppercase text-muted-foreground">
                          <th className="p-3">Feature</th>
                          <th className="p-3">Yours</th>
                          <th className="p-3">Competitor</th>
                          <th className="p-3">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitive!.matrix!.map((row, i) => (
                          <tr key={i} className="border-b border-border/60">
                            <td className="p-3 font-medium">{row.feature}</td>
                            <td className="p-3 font-mono text-xs">{row.yourProduct}</td>
                            <td className="p-3 font-mono text-xs">{row.competitor}</td>
                            <td className="p-3 font-mono text-xs">{row.gapDirection}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No competitive matrix in this run.</p>
                )}
              </div>
            )}

            {slide.id === 'context' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="veracity-card p-5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Evidence timeline</p>
                  {boardPack?.timeline.length ? (
                    <ul className="space-y-3">
                      {boardPack.timeline.map((item, i) => (
                        <li key={`${item.date}-${i}`} className="border-l border-accent/20 pl-3">
                          <p className="text-[10px] font-mono text-muted-foreground">{new Date(item.date).toLocaleDateString()}</p>
                          <p className="text-sm text-foreground">{item.label}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No dated evidence available.</p>}
                </div>
                <div className="veracity-card p-5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Decision memory</p>
                  {boardPack?.decisionMemory.length ? (
                    <ul className="space-y-2 text-sm text-foreground">
                      {boardPack.decisionMemory.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  ) : <p className="text-muted-foreground">No prior accepted or rejected decisions informed this run.</p>}
                </div>
              </div>
            )}

            {slide.id === 'sources' && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Sources</p>
                <ul className="flex flex-col gap-2">
                  {(message.sources ?? []).map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </main>
        </div>
      ) : null}
    </>
  );
}
