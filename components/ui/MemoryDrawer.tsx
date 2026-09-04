'use client';

import { useEffect, useState } from 'react';
import { Brain, X } from 'lucide-react';
import type { UserMemory } from '@/lib/memory';
import { featureFlags } from '@/lib/feature-flags';

export type MemoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  memory: UserMemory | null;
  projectId?: string | null;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  cardBg: string;
  cardBg2: string;
  neuExtruded: string;
  neuExtrudedSm: string;
  accentInk: string;
};

type DecisionLite = {
  id: string;
  title: string;
  decision: string;
  reason: string;
  outcome: string;
  outcome_note?: string | null;
  confidence: number;
};

function ChipList({
  label,
  items,
  textSubtle,
  accentInk,
}: {
  label: string;
  items: string[];
  textSubtle: string;
  accentInk: string;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="ui-section-label" style={{ color: textSubtle }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="ui-caption px-2.5 py-1 rounded-md"
            style={{
              color: accentInk,
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MemoryDrawer({
  open,
  onClose,
  memory,
  projectId,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
}: MemoryDrawerProps) {
  const [decisions, setDecisions] = useState<DecisionLite[]>([]);
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});

  const decisionsUrl = projectId
    ? `/api/decisions?projectId=${encodeURIComponent(projectId)}`
    : '/api/decisions';

  useEffect(() => {
    if (!open || !featureFlags.decisionMemory) return;
    void fetch(decisionsUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { decisions?: DecisionLite[] } | null) => {
        setDecisions(d?.decisions ?? []);
      })
      .catch(() => {});
  }, [open, decisionsUrl]);

  if (!open) return null;

  const hasProfile = Boolean(
    memory?.role
    || memory?.company
    || (memory?.products?.length ?? 0)
    || (memory?.competitors?.length ?? 0)
    || (memory?.interests?.length ?? 0)
    || (memory?.facts?.length ?? 0)
    || memory?.raw_summary,
  );

  const setOutcome = async (id: string, outcome: string) => {
    await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, outcome, note: outcomeNotes[id]?.trim() || undefined }),
    });
    const res = await fetch(decisionsUrl);
    if (res.ok) {
      const d = await res.json() as { decisions?: DecisionLite[] };
      setDecisions(d.decisions ?? []);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-2.5 sm:p-4 pointer-events-none">
      <button
        type="button"
        aria-label="Close memory drawer"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity animate-fadeIn pointer-events-auto"
        onClick={onClose}
      />
      <aside
        className="relative h-full w-full max-w-md flex flex-col overflow-hidden rounded-2xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl pointer-events-auto animate-slideInRight"
        style={{
          boxShadow: 'var(--shadow-extruded), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Floating Window Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border/60 bg-accent/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 shadow-xs">
              <Brain size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                Durable Memory
                <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                  AI Context
                </span>
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Facts & entity preferences carried into sweeps
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/15 border border-border/50 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Window Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {!hasProfile ? (
            <div className="rounded-xl p-4 bg-accent/5 border border-border/60 text-xs text-muted-foreground leading-relaxed">
              No durable memory yet. After a few research sweeps, role, company, products, and competitors will appear here and feed the next query.
            </div>
          ) : (
            <>
              {(memory?.role || memory?.company) && (
                <div className="rounded-xl p-4 bg-accent/5 border border-border/60 flex flex-col gap-2 shadow-2xs">
                  {memory?.role && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">Role</span>
                      <span className="font-semibold text-foreground">{memory.role}</span>
                    </div>
                  )}
                  {memory?.company && (
                    <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">Company</span>
                      <span className="font-semibold text-foreground">{memory.company}</span>
                    </div>
                  )}
                </div>
              )}

              <ChipList
                label="Products"
                items={memory?.products ?? []}
                textSubtle={textSubtle}
                accentInk={accentInk}
              />
              <ChipList
                label="Competitors"
                items={memory?.competitors ?? []}
                textSubtle={textSubtle}
                accentInk={accentInk}
              />
              <ChipList
                label="Interests"
                items={memory?.interests ?? []}
                textSubtle={textSubtle}
                accentInk={accentInk}
              />

              {(memory?.facts?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="ui-section-label" style={{ color: textSubtle }}>
                    Facts
                  </p>
                  <ul className="flex flex-col gap-2">
                    {memory!.facts.map((f, i) => (
                      <li
                        key={`${f.fact}-${i}`}
                        className="rounded-xl p-3 text-xs text-muted-foreground bg-accent/5 border border-border/60 flex items-start"
                      >
                        {f.fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {memory?.raw_summary && (
                <div className="flex flex-col gap-2">
                  <p className="ui-section-label" style={{ color: textSubtle }}>
                    Summary
                  </p>
                  <p className="text-xs text-muted-foreground rounded-xl p-3.5 bg-accent/5 border border-border/60 leading-relaxed">
                    {memory.raw_summary}
                  </p>
                </div>
              )}
            </>
          )}

          {featureFlags.decisionMemory ? (
            <div className="flex flex-col gap-2.5">
              <p className="ui-section-label" style={{ color: textSubtle }}>
                Decisions
              </p>
              {decisions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Thumbs on recommendations become durable decisions with reasons.
                </p>
              ) : (
                decisions.slice(0, 12).map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl p-3.5 bg-accent/5 border border-border/60 flex flex-col gap-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-accent text-[10px] uppercase">
                        {d.decision}
                      </span>
                      <span className="font-mono text-muted-foreground text-[10px]">
                        {(Number(d.confidence) * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="font-semibold text-foreground text-xs">{d.title}</p>
                    {d.reason ? (
                      <p className="text-muted-foreground text-[11px]">Because {d.reason}</p>
                    ) : null}
                    <p className="font-mono text-muted-foreground text-[10px]">
                      Outcome · {d.outcome}
                    </p>
                    {d.outcome_note ? (
                      <p className="text-muted-foreground text-[11px] italic">{d.outcome_note}</p>
                    ) : null}
                    {d.outcome === 'pending' ? (
                      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
                        <input
                          value={outcomeNotes[d.id] ?? ''}
                          onChange={(event) => setOutcomeNotes((current) => ({
                            ...current,
                            [d.id]: event.target.value,
                          }))}
                          placeholder="Optional result note"
                          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:border-accent"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors"
                            onClick={() => { void setOutcome(d.id, 'validated'); }}
                          >
                            Validated
                          </button>
                          <button
                            type="button"
                            className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer transition-colors"
                            onClick={() => { void setOutcome(d.id, 'invalidated'); }}
                          >
                            Invalidated
                          </button>
                          {d.decision === 'rejected' ? (
                            <button
                              type="button"
                              className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 cursor-pointer transition-colors"
                              onClick={() => { void setOutcome(d.id, 'adopted_after_reject'); }}
                            >
                              Later adopted
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Floating Window Footer Bar */}
        <div className="px-5 py-3.5 border-t border-border/60 bg-accent/5 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Synced with Research Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-colors shadow-xs cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </aside>
    </div>
  );
}
