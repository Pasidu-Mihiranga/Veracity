'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Short label of the artifact (e.g. "Market Trend Analysis") */
  label: string;
  /** Optional one-line reason — usually "Agent returned no signal." */
  reason?: string;
}

/**
 * Inline fallback rendered when an artifact has no usable data.
 * Neumorphic inset well — soft pressed surface, no dashed flat border.
 */
export function EmptyArtifact({ label, reason }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="label-mono">{label}</div>
      <div className="neu-inset rounded-2xl p-4 flex items-start gap-3">
        <span className="neu-well w-8 h-8 shrink-0">
          <AlertTriangle size={14} className="text-accent" />
        </span>
        <div className="flex flex-col gap-1 pt-0.5">
          <p className="text-[13px] text-muted-foreground leading-snug">
            {reason ?? 'Agent returned no usable signal for this view.'}
          </p>
          <p className="text-[11px] font-mono text-muted-foreground/80">
            Try a more specific query or rerun to refresh signals.
          </p>
        </div>
      </div>
    </div>
  );
}
