'use client';

import { useEffect, useState } from 'react';
import { Brain, X } from 'lucide-react';
import type { UserMemory } from '@/lib/memory';
import { featureFlags } from '@/lib/feature-flags';

export type MemoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  memory: UserMemory | null;
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
  textMain,
  textMuted,
  textSubtle,
  accentInk,
}: MemoryDrawerProps) {
  const [decisions, setDecisions] = useState<DecisionLite[]>([]);

  useEffect(() => {
    if (!open || !featureFlags.decisionMemory) return;
    void fetch('/api/decisions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { decisions?: DecisionLite[] } | null) => {
        setDecisions(d?.decisions ?? []);
      })
      .catch(() => {});
  }, [open]);

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
      body: JSON.stringify({ id, outcome }),
    });
    const res = await fetch('/api/decisions');
    if (res.ok) {
      const d = await res.json() as { decisions?: DecisionLite[] };
      setDecisions(d.decisions ?? []);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close memory drawer"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <aside
        className="relative h-full w-full max-w-md flex flex-col overflow-hidden"
        style={{
          background: 'var(--card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'none',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
            >
              <Brain size={14} style={{ color: accentInk }} />
            </span>
            <div>
              <p className="ui-title" style={{ color: textMain }}>
                Durable memory
              </p>
              <p className="ui-caption" style={{ color: textSubtle }}>
                Facts carried into the next sweep
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              color: textMuted,
              border: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {!hasProfile ? (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
            >
              <p className="ui-body-sm" style={{ color: textMuted }}>
                No durable memory yet. After a few research sweeps, role, company, products, and competitors will appear here and feed the next query.
              </p>
            </div>
          ) : (
            <>
              {(memory?.role || memory?.company) && (
                <div
                  className="rounded-xl px-4 py-3 flex flex-col gap-2"
                  style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                >
                  {memory?.role && (
                    <p className="ui-body-sm" style={{ color: textMain }}>
                      <span className="ui-section-label mr-2" style={{ color: textSubtle }}>
                        Role
                      </span>
                      {memory.role}
                    </p>
                  )}
                  {memory?.company && (
                    <p className="ui-body-sm" style={{ color: textMain }}>
                      <span className="ui-section-label mr-2" style={{ color: textSubtle }}>
                        Company
                      </span>
                      {memory.company}
                    </p>
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
                        className="rounded-xl px-3.5 py-3 ui-caption min-h-[56px] flex items-start"
                        style={{
                          color: textMuted,
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                        }}
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
                  <p
                    className="ui-body-sm rounded-xl px-4 py-3"
                    style={{
                      color: textMuted,
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {memory.raw_summary}
                  </p>
                </div>
              )}
            </>
          )}

          {featureFlags.decisionMemory ? (
            <div className="flex flex-col gap-2">
              <p className="ui-section-label" style={{ color: textSubtle }}>
                Decisions
              </p>
              {decisions.length === 0 ? (
                <p className="ui-caption" style={{ color: textMuted }}>
                  Thumbs on recommendations become durable decisions with reasons.
                </p>
              ) : (
                decisions.slice(0, 12).map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl px-3.5 py-3 flex flex-col gap-1.5"
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="ui-mono" style={{ color: accentInk, fontSize: 10 }}>
                        {d.decision}
                      </span>
                      <span className="ui-mono" style={{ color: textSubtle, fontSize: 10 }}>
                        {(Number(d.confidence) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="ui-body-sm" style={{ color: textMain }}>{d.title}</p>
                    {d.reason ? (
                      <p className="ui-caption" style={{ color: textMuted }}>Because {d.reason}</p>
                    ) : null}
                    <p className="ui-mono" style={{ color: textSubtle, fontSize: 10 }}>
                      Outcome · {d.outcome}
                    </p>
                    {d.outcome === 'pending' ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-600"
                          onClick={() => { void setOutcome(d.id, 'validated'); }}
                        >
                          Validated
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700"
                          onClick={() => { void setOutcome(d.id, 'invalidated'); }}
                        >
                          Invalidated
                        </button>
                        {d.decision === 'rejected' ? (
                          <button
                            type="button"
                            className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-accent/20 bg-accent/5 text-accent"
                            onClick={() => { void setOutcome(d.id, 'adopted_after_reject'); }}
                          >
                            Later adopted
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
