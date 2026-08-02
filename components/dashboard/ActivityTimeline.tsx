'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History, Check, Minus, AlertTriangle } from 'lucide-react';
import { importanceOf, TONE_CLASS, freshnessOf } from '@/lib/ux/vocabulary';
import { summariseChange } from '@/lib/intelligence/plain-language';

/**
 * The competitor activity timeline and source coverage matrix.
 *
 * The digest answers "what should I look at since last time" and applies
 * materiality gates. This answers "what has happened at all" — including the
 * quiet changes the gates suppressed. Someone investigating a competitor needs
 * those too; the gates protect attention, not history.
 *
 * The matrix reports **coverage**, not features. Claiming a feature comparison
 * the ledger cannot support would be precisely the fabrication this product
 * exists to avoid. What it can honestly say is "we have read their pricing page
 * twice this month, and we have never seen their changelog" — which is what a
 * user needs to judge how much weight the rest deserves.
 */

export interface ActivityTimelineProps {
  projectId: string;
  onOpenEvidence?: (spanIds: string[]) => void;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  before_value: string | null;
  after_value: string | null;
  observed_at: string;
  materiality: number;
  materiality_reason: string;
  confidence: string;
  evidence_span_id: string | null;
  entity_label: string | null;
}

interface CoverageRow {
  entity_id: string;
  entity_label: string;
  source_type: string | null;
  last_seen: string | null;
  snapshot_count: number;
  span_count: number;
}

/**
 * Freshness through the shared vocabulary, so "Never checked" reads the same
 * here as everywhere else. A user should learn each phrase once.
 */
function freshnessLabel(iso: string | null): { text: string; className: string; title: string } {
  const term = freshnessOf(iso);
  return {
    text: term.label,
    title: term.meaning,
    className: term.tone === 'good' ? 'text-muted-foreground' : 'text-amber-700',
  };
}

export function ActivityTimeline({ projectId, onOpenEvidence }: ActivityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/timeline`);
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? 'Could not load the timeline');
        return;
      }
      setEvents(body.data.events ?? []);
      setCoverage(body.data.coverage ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the timeline');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="veracity-card p-6 flex flex-col gap-3">
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse-line" />
        <div className="h-20 bg-muted rounded animate-pulse-line" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-2">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Activity
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Group coverage by entity so the matrix reads per competitor.
  const byEntity = new Map<string, CoverageRow[]>();
  for (const row of coverage) {
    const list = byEntity.get(row.entity_label) ?? [];
    list.push(row);
    byEntity.set(row.entity_label, list);
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
          <History size={12} /> Everything we have seen — including the small things
        </div>

        {events.length === 0 ? (
          <div className="veracity-card p-5 flex flex-col gap-2">
            <p className="text-sm text-foreground">No changes recorded yet.</p>
            <p className="text-xs text-muted-foreground">
              Changes appear once we have read a source twice and can compare. The first read
              just establishes what things look like now.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2 list-none p-0 m-0">
            {events.map((event) => {
              const plain = summariseChange({
                entityLabel: event.entity_label ?? 'Untracked',
                eventType: event.event_type,
                beforeValue: event.before_value,
                afterValue: event.after_value,
                materiality: event.materiality,
                observedAt: event.observed_at,
              });
              const importance = importanceOf(event.materiality);
              const belowThreshold = event.materiality < 0.5;

              return (
                <li key={event.id} className="veracity-card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${TONE_CLASS[importance.tone]}`}
                      title={importance.meaning}
                    >
                      {importance.label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(event.observed_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-sm text-foreground break-words">{plain.sentence}</div>

                  <p className="text-xs text-muted-foreground">{plain.importance}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    {belowThreshold ? (
                      // Shown, but marked. A user browsing history should be able
                      // to tell which items were deliberately kept out of alerts.
                      <span className="text-[10px] font-mono text-muted-foreground">
                        we did not interrupt you for this
                      </span>
                    ) : null}
                    {event.evidence_span_id && onOpenEvidence ? (
                      <button
                        type="button"
                        onClick={() => onOpenEvidence([event.evidence_span_id!])}
                        className="text-[10px] font-mono text-accent hover:underline"
                      >
                        See the quote
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-amber-700">
                        no quote saved
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {byEntity.size > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            What we have read, and when
          </div>

          <div className="veracity-card p-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Entity
                  </th>
                  <th className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Source
                  </th>
                  <th className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Last checked
                  </th>
                  <th className="pb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Quotes saved
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...byEntity.entries()].map(([entity, rows]) =>
                  rows.map((row, i) => {
                    const freshness = freshnessLabel(row.last_seen);
                    return (
                      <tr key={`${entity}-${row.source_type ?? 'none'}-${i}`} className="border-t border-border">
                        <td className="py-2 pr-4 text-foreground">{i === 0 ? entity : ''}</td>
                        <td className="py-2 pr-4 font-mono text-[11px] text-muted-foreground">
                          {row.source_type ?? '—'}
                        </td>
                        <td
                          className={`py-2 pr-4 font-mono text-[11px] ${freshness.className}`}
                          title={freshness.title}
                        >
                          {freshness.text}
                        </td>
                        <td className="py-2 text-muted-foreground inline-flex items-center gap-1">
                          {row.span_count > 0 ? (
                            <>
                              <Check size={11} className="text-emerald-500" />
                              {row.span_count}
                            </>
                          ) : (
                            <>
                              <Minus size={11} />
                              none
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground inline-flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
            This shows what we have read, not a feature comparison. A source we have never
            opened means we cannot say what is on it — not that the competitor lacks
            something.
          </p>
        </div>
      ) : null}
    </section>
  );
}
