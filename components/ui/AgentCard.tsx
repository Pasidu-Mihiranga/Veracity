'use client';

import { ChevronRight, RefreshCw } from 'lucide-react';
import type { AgentRun, AgentOutput } from '@/lib/agents/types';
import { DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';
import { useTheme } from '@/lib/theme-provider';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

export function AgentCard({
  domain,
  run,
  output,
  isExpanded,
  onClick,
}: {
  domain: Domain;
  run?: AgentRun;
  output?: AgentOutput;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const { isDark } = useTheme();
  const meta = DOMAIN_META[domain];
  const accent = domainAccent(meta, isDark);
  const status = run?.status ?? 'idle';
  const snippet = output?.facts?.[0] ?? output?.interpretation?.[0];
  const clickable = !!output;

  const bgTint =
    status === 'running' || status === 'completed'
      ? isDark
        ? meta.bg
        : meta.bgLight
      : 'transparent';

  return (
    <button
      onClick={onClick}
      disabled={!clickable && status !== 'running'}
      className="relative flex flex-col gap-3 p-4 rounded-[20px] text-left transition-all duration-300"
      style={{
        background: 'var(--background)',
        border: 'none',
        boxShadow: isExpanded
          ? `var(--shadow-inset), 0 0 0 2px ${accent}44`
          : status === 'running'
            ? `var(--shadow-extruded-sm), 0 0 0 1px ${accent}33`
            : 'var(--shadow-extruded)',
        cursor: clickable ? 'pointer' : 'default',
        opacity: status === 'idle' ? 0.65 : 1,
      }}
    >
      {(status === 'running' || (status === 'completed' && isExpanded)) && (
        <div className="absolute inset-0 rounded-[20px] pointer-events-none" style={{ background: bgTint }} />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: status === 'idle' ? 'var(--foreground-subtle)' : accent }}>{meta.icon}</span>
          <span
            className="text-[11px] font-mono font-semibold uppercase tracking-widest truncate"
            style={{ color: status === 'idle' ? 'var(--foreground-subtle)' : accent }}
          >
            {meta.short}
          </span>
        </div>

        {status === 'idle' && (
          <span className="neu-pill text-[9px] font-mono px-2 py-0.5" style={{ color: 'var(--foreground-subtle)' }}>
            idle
          </span>
        )}
        {status === 'pending' && (
          <span
            className="neu-pill text-[9px] font-mono px-2 py-0.5 flex items-center gap-1"
            style={{ color: 'var(--muted-foreground)' }}
          >
            queued <RefreshCw size={7} className="animate-spin" />
          </span>
        )}
        {status === 'running' && (
          <span
            className="neu-pill-accent text-[9px] font-mono px-2 py-0.5 flex items-center gap-1 font-medium"
            style={{ color: accent }}
          >
            live <RefreshCw size={7} className="animate-spin" />
          </span>
        )}
        {status === 'completed' && output?.confidence && <ConfidenceBadge level={output.confidence} />}
        {status === 'failed' && <span className="neu-pill-negative text-[9px] font-mono px-2 py-0.5">failed</span>}
      </div>

      <div className="relative flex-1 min-h-[52px]">
        {status === 'idle' && (
          <p className="text-xs font-mono" style={{ color: 'var(--foreground-subtle)' }}>
            awaiting query…
          </p>
        )}
        {status === 'pending' && (
          <div className="flex flex-col gap-2 opacity-50">
            <div className="h-2.5 rounded skeleton w-4/5" />
            <div className="h-2.5 rounded skeleton w-3/5" />
          </div>
        )}
        {status === 'running' && (
          <div className="flex flex-col gap-2">
            <div className="h-2.5 rounded skeleton w-full" />
            <div className="h-2.5 rounded skeleton w-4/5" style={{ animationDelay: '0.2s' }} />
            <div className="h-2.5 rounded skeleton w-3/5" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
        {status === 'completed' && snippet && <p className="agent-snippet line-clamp-3">{snippet}</p>}
        {status === 'failed' && (
          <p className="text-xs" style={{ color: '#0B1A2E' }}>
            Agent failed — partial data only.
          </p>
        )}
      </div>

      {output?.sources && output.sources.length > 0 && (
        <div className="relative flex items-center gap-1.5 pt-2.5">
          <span className="text-[10px] font-mono" style={{ color: 'var(--foreground-subtle)' }}>
            {output.sources.length} sources
          </span>
          <ChevronRight
            size={10}
            className="ml-auto transition-transform duration-150"
            style={{ color: accent, transform: isExpanded ? 'rotate(90deg)' : 'none' }}
          />
        </div>
      )}
    </button>
  );
}
