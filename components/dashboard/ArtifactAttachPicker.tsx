'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Paperclip, X, Search } from 'lucide-react';
import type { AttachedArtifact } from '@/lib/intelligence/conversation-context';

/**
 * Attach a stored claim, chart, or change event to the next turn.
 *
 * "Ask about this chart" only works if the chart's content travels with the
 * question. Without it the model has to guess which chart was meant, and a
 * wrong guess produces a confident answer about the wrong thing — worse than
 * asking the user to restate.
 *
 * Attaching is also what makes a turn cheap. A question with an attached claim
 * can be answered from the ledger by the Explain path; the same question
 * without it looks like new research and triggers a sweep.
 */

export interface ArtifactAttachPickerProps {
  projectId: string;
  attached: AttachedArtifact[];
  onChange: (attached: AttachedArtifact[]) => void;
}

interface Candidate extends AttachedArtifact {
  /** Extra context shown in the list but not sent. */
  meta?: string;
}

export function ArtifactAttachPicker({
  projectId,
  attached,
  onChange,
}: ArtifactAttachPickerProps) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Claims and change events come from the two routes that already exist,
      // rather than adding a third endpoint that would drift from them.
      const [explainable, timeline] = await Promise.all([
        fetch(`/api/projects/${projectId}/charts`).then((r) => r.json()).catch(() => null),
        fetch(`/api/projects/${projectId}/timeline?limit=40`).then((r) => r.json()).catch(() => null),
      ]);

      const found: Candidate[] = [];

      for (const chart of explainable?.data?.charts ?? []) {
        found.push({
          kind: 'chart',
          id: String(chart.id),
          label: String(chart.title),
          // The rows travel with it, so the model reads the actual series
          // rather than inferring one from the title.
          detail: `${chart.questionAnswered} — ${(chart.rows ?? [])
            .slice(0, 8)
            .map((row: Record<string, unknown>) => JSON.stringify(row))
            .join('; ')}`,
          meta: `${chart.dataClass} · ${chart.unit}`,
        });
      }

      for (const event of timeline?.data?.events ?? []) {
        const movement =
          event.before_value && event.after_value
            ? `${event.before_value} → ${event.after_value}`
            : (event.after_value ?? event.before_value ?? '');
        found.push({
          kind: 'event',
          id: String(event.id),
          label: `${event.entity_label ?? 'Untracked'}: ${String(event.event_type).replace(/_/g, ' ')}`,
          detail: `${movement}. ${event.materiality_reason}`,
          meta: new Date(event.observed_at).toLocaleDateString(),
        });
      }

      setCandidates(found);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && candidates.length === 0) void load();
  }, [open, candidates.length, load]);

  const toggle = (candidate: Candidate) => {
    const already = attached.some((a) => a.id === candidate.id && a.kind === candidate.kind);
    if (already) {
      onChange(attached.filter((a) => !(a.id === candidate.id && a.kind === candidate.kind)));
    } else {
      // `meta` is display-only and is dropped here, so nothing decorative ends
      // up in the prompt.
      const { meta: _meta, ...artifact } = candidate;
      onChange([...attached, artifact]);
    }
  };

  const visible = filter
    ? candidates.filter((c) => `${c.label} ${c.detail}`.toLowerCase().includes(filter.toLowerCase()))
    : candidates;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[10px] font-mono text-accent hover:opacity-80 inline-flex items-center gap-1"
        >
          <Paperclip size={11} /> Attach evidence
        </button>

        {attached.map((artifact) => (
          <span
            key={`${artifact.kind}-${artifact.id}`}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/5 text-accent border border-accent/20 inline-flex items-center gap-1.5"
          >
            {artifact.kind}: {artifact.label}
            <button
              type="button"
              onClick={() => onChange(attached.filter((a) => a.id !== artifact.id))}
              aria-label={`Detach ${artifact.label}`}
              className="hover:opacity-70"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      {open ? (
        <div className="veracity-card p-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Search size={12} className="text-muted-foreground shrink-0" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter charts and changes"
              className="flex-1 text-xs bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {loading ? (
            <div className="h-4 bg-muted rounded animate-pulse-line" />
          ) : visible.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {candidates.length === 0
                ? 'Nothing stored to attach yet. Run a collection first.'
                : 'No match.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {visible.map((candidate) => {
                const selected = attached.some(
                  (a) => a.id === candidate.id && a.kind === candidate.kind,
                );
                return (
                  <li key={`${candidate.kind}-${candidate.id}`}>
                    <button
                      type="button"
                      onClick={() => toggle(candidate)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${
                        selected ? 'bg-accent/10' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {candidate.kind}
                        </span>
                        <span className="text-xs text-foreground">{candidate.label}</span>
                        {candidate.meta ? (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {candidate.meta}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
