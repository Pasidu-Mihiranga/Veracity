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
        </div>
      </aside>
    </div>
  );
}
