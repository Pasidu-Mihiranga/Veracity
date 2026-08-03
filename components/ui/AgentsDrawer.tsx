'use client';

import React from 'react';
import { Bot, Check, Sparkles, X } from 'lucide-react';
import { ALL_DOMAINS, DOMAIN_META, type Domain } from '@/lib/domain-meta';
import type { AgentRun } from '@/lib/agents/types';

export type AgentsDrawerProps = {
  open: boolean;
  onClose: () => void;
  selectedAgents: Record<Domain, boolean>;
  onToggleAgent: (domain: Domain) => void;
  forceFullSweep?: boolean;
  onToggleForceFullSweep?: () => void;
  getRunForDomain: (domain: Domain) => AgentRun | undefined;
  textMain?: string;
  textMuted?: string;
  textSubtle?: string;
  accentInk?: string;
};

export function AgentsDrawer({
  open,
  onClose,
  selectedAgents,
  onToggleAgent,
  forceFullSweep = false,
  onToggleForceFullSweep,
  getRunForDomain,
  textMain = 'var(--foreground)',
  textMuted = 'var(--foreground-muted)',
  textSubtle = 'var(--foreground-subtle)',
  accentInk = 'var(--accent)',
}: AgentsDrawerProps) {
  if (!open) return null;

  const activeCount = Object.values(selectedAgents).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-2.5 sm:p-4 pointer-events-none">
      <button
        type="button"
        aria-label="Close agents drawer backdrop"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity animate-fadeIn pointer-events-auto"
        onClick={onClose}
      />
      <aside
        className="relative h-full w-full max-w-md flex flex-col overflow-hidden rounded-2xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl pointer-events-auto animate-slideInRight"
        style={{
          boxShadow: 'var(--shadow-extruded), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Window Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border/60 bg-accent/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 shadow-xs">
              <Bot size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                Swarm Agents
                <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                  {activeCount}/{ALL_DOMAINS.length} Active
                </span>
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Multi-agent web research engines
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

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {/* Force full sweep card */}
          {onToggleForceFullSweep ? (
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 shrink-0"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
            >
              <div>
                <p className="ui-body-sm font-semibold flex items-center gap-1.5" style={{ color: textMain }}>
                  <Sparkles size={13} style={{ color: accentInk }} /> Force full sweep
                </p>
                <p className="ui-caption mt-0.5" style={{ color: textSubtle }}>
                  Bypass adaptive selection to run all active agents unconditionally
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleForceFullSweep}
                className="px-2.5 py-1 rounded-md ui-mono text-[10px] uppercase font-bold transition-all shrink-0 cursor-pointer"
                style={{
                  background: forceFullSweep
                    ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                    : 'var(--card)',
                  border: `1px solid ${forceFullSweep ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                  color: forceFullSweep ? accentInk : textMuted,
                }}
              >
                {forceFullSweep ? 'On' : 'Auto'}
              </button>
            </div>
          ) : null}

          {/* Specialist Agents List */}
          <div className="flex flex-col gap-2">
            <p className="ui-section-label" style={{ color: textSubtle }}>
              Specialist Agents
            </p>
            {ALL_DOMAINS.map((domain) => {
              const meta = DOMAIN_META[domain];
              const isSelected = selectedAgents[domain];
              const run = getRunForDomain(domain);
              return (
                <div
                  key={domain}
                  onClick={() => onToggleAgent(domain)}
                  className="rounded-xl px-3.5 py-3 flex items-center justify-between cursor-pointer transition-colors"
                  style={{
                    background: 'var(--surface-raised)',
                    border: `1px solid ${isSelected ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                      style={{
                        background: isSelected
                          ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                          : 'var(--card)',
                        color: meta?.color ?? accentInk,
                      }}
                    >
                      {meta?.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="ui-body-sm font-semibold truncate" style={{ color: textMain }}>
                        {meta?.short ?? meta?.label ?? domain}
                      </p>
                      <p className="ui-caption truncate" style={{ color: textSubtle }}>
                        {meta?.label ?? domain}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {run?.status ? (
                      <span
                        className="ui-mono text-[9px] uppercase px-2 py-0.5 rounded-full"
                        style={{
                          color: run.status === 'completed' ? '#10B981' : run.status === 'running' ? accentInk : textSubtle,
                          background: run.status === 'completed' ? 'rgba(16,185,129,0.12)' : 'rgba(0,196,255,0.1)',
                        }}
                      >
                        {run.status}
                      </span>
                    ) : null}
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center transition-colors"
                      style={{
                        background: isSelected ? accentInk : 'var(--card)',
                        border: `1px solid ${isSelected ? accentInk : 'var(--border)'}`,
                        color: isSelected ? '#FFFFFF' : 'transparent',
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
