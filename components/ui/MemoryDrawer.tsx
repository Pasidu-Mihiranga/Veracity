'use client';

import { Brain, X } from 'lucide-react';
import type { UserMemory } from '@/lib/memory';

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

function ChipList({
  label,
  items,
  textSubtle,
  accentInk,
  cardBg,
  neuExtrudedSm,
}: {
  label: string;
  items: string[];
  textSubtle: string;
  accentInk: string;
  cardBg: string;
  neuExtrudedSm: string;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span
            key={item}
            className="text-[11px] font-mono px-2 py-0.5 rounded-full"
            style={{
              color: accentInk,
              background: cardBg,
              boxShadow: neuExtrudedSm,
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
  cardBg,
  cardBg2,
  neuExtruded,
  neuExtrudedSm,
  accentInk,
}: MemoryDrawerProps) {
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
        style={{ background: cardBg, boxShadow: neuExtruded }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="neu-well w-8 h-8">
              <Brain size={14} style={{ color: accentInk }} />
            </span>
            <div>
              <p className="text-[14px] font-bold tracking-tight" style={{ color: textMain }}>Durable memory</p>
              <p className="text-[11px] font-mono" style={{ color: textSubtle }}>
                Facts carried into the next sweep
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ color: textMuted }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 flex flex-col gap-5">
          {!hasProfile ? (
            <div className="neu-inset rounded-2xl p-4" style={{ background: cardBg2 }}>
              <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
                No durable memory yet. After a few research sweeps, role, company, products, and competitors will appear here and feed the next query.
              </p>
            </div>
          ) : (
            <>
              {(memory?.role || memory?.company) && (
                <div className="neu-extruded rounded-2xl p-4 flex flex-col gap-2" style={{ background: cardBg2 }}>
                  {memory?.role && (
                    <p className="text-[13px]" style={{ color: textMain }}>
                      <span className="font-mono text-[10px] uppercase tracking-widest mr-2" style={{ color: textSubtle }}>Role</span>
                      {memory.role}
                    </p>
                  )}
                  {memory?.company && (
                    <p className="text-[13px]" style={{ color: textMain }}>
                      <span className="font-mono text-[10px] uppercase tracking-widest mr-2" style={{ color: textSubtle }}>Company</span>
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
                cardBg={cardBg2}
                neuExtrudedSm={neuExtrudedSm}
              />
              <ChipList
                label="Competitors"
                items={memory?.competitors ?? []}
                textSubtle={textSubtle}
                accentInk={accentInk}
                cardBg={cardBg2}
                neuExtrudedSm={neuExtrudedSm}
              />
              <ChipList
                label="Interests"
                items={memory?.interests ?? []}
                textSubtle={textSubtle}
                accentInk={accentInk}
                cardBg={cardBg2}
                neuExtrudedSm={neuExtrudedSm}
              />

              {(memory?.facts?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>Facts</p>
                  <ul className="flex flex-col gap-2">
                    {memory!.facts.map((f, i) => (
                      <li
                        key={`${f.fact}-${i}`}
                        className="neu-inset rounded-xl px-3 py-2 text-[12px] leading-relaxed"
                        style={{ color: textMuted, background: cardBg2 }}
                      >
                        {f.fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {memory?.raw_summary && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>Summary</p>
                  <p className="text-[13px] leading-relaxed neu-inset rounded-2xl p-4" style={{ color: textMuted, background: cardBg2 }}>
                    {memory.raw_summary}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
