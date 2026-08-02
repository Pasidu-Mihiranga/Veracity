'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldQuestion, Check, AlertTriangle, ExternalLink } from 'lucide-react';

/**
 * Correcting a wrong entity match.
 *
 * Entity matching is a heuristic, and when it is wrong the failure compounds:
 * evidence about a different company attaches to a competitor, and every claim
 * resting on it inherits the error. The user is the only reliable arbiter of
 * "that Lilian is the design agency, not the AI company".
 *
 * Marking a span as a mismatch does not delete it. The excerpt was genuinely
 * retrieved and the record of having looked is worth keeping — what changes is
 * that it stops supporting claims and stops reaching the digest. The panel says
 * how many claims a correction downgraded, so the action visibly does
 * something rather than appearing to be a no-op.
 */

export interface EntityCorrectionPanelProps {
  projectId: string;
}

interface SpanRow {
  id: string;
  excerpt: string;
  entity_match: 'confirmed' | 'probable' | 'unverified' | 'mismatch';
  extraction_type: string;
  source_url: string;
  entity_label: string | null;
  created_at: string;
}

const MATCH_STYLE: Record<SpanRow['entity_match'], string> = {
  confirmed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  probable: 'bg-amber-50 text-amber-700 border-amber-200',
  unverified: 'bg-muted text-muted-foreground border-border',
  mismatch: 'bg-red-50 text-red-600 border-red-200',
};

export function EntityCorrectionPanel({ projectId }: EntityCorrectionPanelProps) {
  const [spans, setSpans] = useState<SpanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/entities`);
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? 'Could not load evidence for review');
        return;
      }
      setSpans(body.data.spans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load evidence for review');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const correct = async (spanId: string, entityMatch: SpanRow['entity_match']) => {
    setBusyId(spanId);
    setNotice(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/entities`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spanId, entityMatch }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? 'The correction did not save');
        return;
      }

      setSpans((prev) =>
        prev.map((s) => (s.id === spanId ? { ...s, entity_match: entityMatch } : s)),
      );

      const downgraded = body.data.downgradedClaims ?? 0;
      setNotice(
        downgraded > 0
          ? `Marked as a mismatch. ${downgraded} claim(s) that relied on it were downgraded to interpretation.`
          : 'Correction saved.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The correction did not save');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-3">
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse-line" />
        <div className="h-16 bg-muted rounded animate-pulse-line" />
      </div>
    );
  }

  const needsReview = spans.filter(
    (s) => s.entity_match === 'unverified' || s.entity_match === 'probable',
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
        <ShieldQuestion size={12} /> Is this evidence about the right company?
      </div>

      <p className="text-xs text-muted-foreground">
        Entity matching is a heuristic. When it is wrong, every claim resting on that
        excerpt inherits the error — so a correction here is worth more than it looks.
        {needsReview.length > 0
          ? ` ${needsReview.length} excerpt(s) have not been confirmed.`
          : ' Every excerpt has been confirmed.'}
      </p>

      {error ? (
        <div className="text-xs text-amber-700 inline-flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </div>
      ) : null}
      {notice ? <div className="text-xs text-accent">{notice}</div> : null}

      {spans.length === 0 ? (
        <div className="veracity-card p-5">
          <p className="text-sm text-foreground">No evidence collected yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Excerpts appear here once a collection run has stored some.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {spans.slice(0, 25).map((span) => (
            <li key={span.id} className="veracity-card p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${MATCH_STYLE[span.entity_match]}`}
                >
                  {span.entity_match}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {span.entity_label ?? 'unattributed'} · {span.extraction_type}
                </span>
              </div>

              <blockquote className="text-xs text-foreground italic border-l-2 border-border pl-3">
                “{span.excerpt.slice(0, 240)}{span.excerpt.length > 240 ? '…' : ''}”
              </blockquote>

              <a
                href={span.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-accent hover:underline inline-flex items-center gap-1 break-all self-start"
              >
                {span.source_url} <ExternalLink size={10} className="shrink-0" />
              </a>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={busyId === span.id || span.entity_match === 'confirmed'}
                  onClick={() => void correct(span.id, 'confirmed')}
                  className="text-[10px] font-mono px-2 py-1 rounded border bg-emerald-50 text-emerald-600 border-emerald-200 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <Check size={10} /> Right company
                </button>
                <button
                  type="button"
                  disabled={busyId === span.id || span.entity_match === 'mismatch'}
                  onClick={() => void correct(span.id, 'mismatch')}
                  className="text-[10px] font-mono px-2 py-1 rounded border bg-red-50 text-red-600 border-red-200 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <AlertTriangle size={10} /> Wrong company
                </button>
                {/* Stated explicitly, because "wrong company" sounds destructive
                    and a user should know the record survives. */}
                <span className="text-[10px] font-mono text-muted-foreground">
                  Marking it wrong keeps the excerpt but stops it supporting claims.
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
