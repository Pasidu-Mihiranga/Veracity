'use client';

import type { AgentRun } from '@/lib/agents/types';

type Props = {
  lines?: string[];
  agentRuns?: AgentRun[];
};

/**
 * Chronological thinking timeline from orchestration_log + agent status cues.
 */
export function ThinkingTimeline({ lines = [], agentRuns = [] }: Props) {
  const statusLines = agentRuns
    .filter((r) => r.status !== 'pending')
    .map((r) => {
      const icon =
        r.status === 'completed' ? '✓' : r.status === 'failed' ? '✕' : '…';
      return `${icon} ${r.name}: ${r.status}`;
    });

  const items = [...lines.slice(-24), ...statusLines.slice(-12)];
  if (items.length === 0) return null;

  return (
    <div className="veracity-card p-4 flex flex-col gap-2">
      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        Thinking timeline
      </span>
      <ol className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {items.map((line, i) => (
          <li
            key={`${i}-${line.slice(0, 24)}`}
            className="text-[11px] font-mono text-muted-foreground leading-snug flex gap-2"
          >
            <span className="text-accent shrink-0 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
