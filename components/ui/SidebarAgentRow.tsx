'use client';

import { Check, RefreshCw, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import type { AgentRun } from '@/lib/agents/types';
import { DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';
import { useTheme } from '@/lib/theme-provider';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

export function SidebarAgentRow({
  domain,
  run,
  selected,
  onToggle,
}: {
  domain: Domain;
  run?: AgentRun;
  selected: boolean;
  onToggle: () => void;
}) {
  const { isDark, textSubtle } = useTheme();
  const meta = DOMAIN_META[domain];
  const accent = domainAccent(meta, isDark);
  const status = run?.status ?? 'idle';

  return (
    <div
      className="agent-row-enhanced flex items-center gap-2.5"
      style={{
        background: selected
          ? isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(15,23,42,0.03)'
          : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${selected ? 'Disable' : 'Enable'} ${meta.short}`}
        className="w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all"
        style={{
          background: selected ? accent : 'var(--background)',
          boxShadow: selected
            ? `inset 2px 2px 4px rgba(0,0,0,0.2), 0 0 6px ${accent}44`
            : 'var(--shadow-extruded-sm)',
          border: 'none',
        }}
      >
        {selected && <Check size={10} color="#fff" strokeWidth={3} />}
      </button>
      <div className="w-4 shrink-0 flex justify-center">
        {status === 'running' && <RefreshCw size={12} style={{ color: accent }} className="animate-spin" />}
        {status === 'completed' && <CheckCircle2 size={12} style={{ color: 'var(--status-ok)' }} />}
        {status === 'failed' && <AlertCircle size={12} style={{ color: 'var(--status-fail)' }} />}
        {(status === 'idle' || status === 'pending') && (
          <Circle size={12} style={{ color: 'var(--foreground-subtle)' }} />
        )}
      </div>
      <span
        className="text-[13px] flex-1 truncate"
        style={{
          textDecoration: selected ? 'none' : 'line-through',
          color:
            status === 'running'
              ? accent
              : status === 'completed'
                ? undefined
                : status === 'failed'
                  ? 'var(--status-fail)'
                  : textSubtle,
          fontWeight: status === 'running' ? 600 : selected ? 500 : 400,
          letterSpacing: '-0.01em',
        }}
      >
        {meta.short}
        {domain === 'mirofish-live' && status === 'idle' && (
          <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 neu-pill-positive">
            VPS
          </span>
        )}
      </span>
      {status === 'running' && (
        <span className="neu-pill-accent text-[9px] font-mono font-semibold px-1.5 py-0.5" style={{ color: accent }}>
          live
        </span>
      )}
      {status === 'completed' && (run as { confidence?: string } | undefined)?.confidence && (
        <ConfidenceBadge level={(run as { confidence?: string }).confidence} />
      )}
    </div>
  );
}
