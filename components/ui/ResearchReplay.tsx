'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage } from '@/types/chat-ui';

type Props = {
  message: ChatMessage;
};

/**
 * Replay stored orchestration timeline with metadata header.
 */
export function ResearchReplay({ message }: Props) {
  const lines = message.orchestrationLog ?? [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || lines.length === 0) return;
    if (idx >= lines.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIdx((i) => i + 1), 700);
    return () => window.clearTimeout(t);
  }, [playing, idx, lines.length]);

  if (lines.length === 0) return null;

  const out = message.orchestratorOutput;
  const elapsedMs = out?.metrics?.totalLatencyMs ?? 0;
  const agentCount = out?.agentRuns?.length ?? out?.metrics?.agentCount ?? 0;
  const quality = out?.quality?.evidenceScore;
  const evidenceCount = message.sources?.length
    ?? out?.outputs?.flatMap((o) => o.sources ?? []).length
    ?? 0;

  return (
    <div className="veracity-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          How this answer was built
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-accent/20 bg-accent/5 text-accent"
            onClick={() => {
              setIdx(0);
              setPlaying(true);
            }}
          >
            Play
          </button>
          <button
            type="button"
            className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-border text-muted-foreground"
            onClick={() => setPlaying(false)}
          >
            Pause
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground">
        <span>{out?.generatedAt ? new Date(out.generatedAt).toLocaleString() : '—'}</span>
        <span>·</span>
        <span>{(elapsedMs / 1000).toFixed(1)}s total time</span>
        <span>·</span>
        <span>{agentCount} research agents</span>
        <span>·</span>
        <span>
          answer confidence {quality != null ? `${Math.round(quality * 100)}%` : '—'}
        </span>
        <span>·</span>
        <span>{evidenceCount} supporting sources</span>
      </div>
      <ol className="flex flex-col gap-1 max-h-40 overflow-y-auto m-0 p-0 list-none">
        {lines.slice(0, idx + 1).map((line, i) => (
          <li
            key={`${i}-${line.slice(0, 20)}`}
            className={`text-[11px] font-mono ${i === idx ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {String(i + 1).padStart(2, '0')} · {line}
          </li>
        ))}
      </ol>
    </div>
  );
}
