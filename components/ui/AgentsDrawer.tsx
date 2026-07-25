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
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close agents drawer backdrop"
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
        {/* Drawer Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
            >
              <Bot size={14} style={{ color: accentInk }} />
            </span>
            <div>
              <p className="ui-title" style={{ color: textMain }}>
                Swarm Agents
              </p>
              <p className="ui-caption" style={{ color: textSubtle }}>
                {activeCount} of {ALL_DOMAINS.length} agents enabled
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
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
