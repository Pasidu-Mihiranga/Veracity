'use client';

import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, AlertTriangle, Check, HelpCircle } from 'lucide-react';
import { ENTITY_MATCH, DATA_CLASS, TONE_CLASS } from '@/lib/ux/vocabulary';

/**
 * The "prove it" surface.
 *
 * A source list tells a user where we looked. This tells them what the page
 * actually said, when we read it, and whether the excerpt was even about the
 * right company. Those are different claims, and only the second one is
 * evidence.
 *
 * Contradicting spans are shown alongside supporting ones rather than hidden.
 * When sources disagree the honest answer is to show the disagreement and let
 * the user judge, not to present the majority as settled.
 */

export interface EvidenceSpanView {
  id: string;
  excerpt: string;
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt: string;
  contentHash: string;
  entityMatch: 'confirmed' | 'probable' | 'unverified' | 'mismatch';
  extractionType?: string;
}

export interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  /** What the user asked to see the evidence for. */
  claim: string;
  supporting: EvidenceSpanView[];
  contradicting?: EvidenceSpanView[];
  /** Shown when a value is derived or synthetic rather than read from a source. */
  methodology?: string;
  dataClass?: 'measured' | 'derived' | 'synthetic';
}

// "Definitely them" / "Probably them" rather than `entity_match: probable`.
// The icon carries the same meaning for anyone who reads shape before text.
const MATCH_ICON: Record<EvidenceSpanView['entityMatch'], typeof Check> = {
  confirmed: Check,
  probable: HelpCircle,
  unverified: HelpCircle,
  mismatch: AlertTriangle,
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SpanCard({ span, tone }: { span: EvidenceSpanView; tone: 'support' | 'contradict' }) {
  const match = ENTITY_MATCH[span.entityMatch];
  const Icon = MATCH_ICON[span.entityMatch];

  return (
    <li
      className={`veracity-card p-4 flex flex-col gap-3 border-l-2 ${
        tone === 'contradict' ? 'border-l-amber-400' : 'border-l-accent'
      }`}
    >
      {/* The excerpt is the point of the drawer, so it leads. */}
      <blockquote className="text-sm text-foreground leading-relaxed border-l-2 border-border pl-3 italic">
        “{span.excerpt}”
      </blockquote>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${TONE_CLASS[match.tone]}`}
          title={match.meaning}
        >
          <Icon size={10} /> {match.label}
        </span>
        {span.extractionType ? (
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {span.extractionType}
          </span>
        ) : null}
        <span className="text-[10px] font-mono text-muted-foreground">
          We read this {formatTimestamp(span.retrievedAt)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <a
          href={span.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline inline-flex items-center gap-1 break-all"
        >
          {span.sourceTitle || span.sourceUrl}
          <ExternalLink size={11} className="shrink-0" />
        </a>
        {/* The hash lets a reviewer confirm the excerpt came from the exact
            snapshot we stored, not from a page that has since changed. */}
        <span className="text-[10px] font-mono text-muted-foreground break-all">
          page version {span.contentHash.slice(0, 8)}
        </span>
      </div>
    </li>
  );
}

export function EvidenceDrawer({
  open,
  onClose,
  claim,
  supporting,
  contradicting = [],
  methodology,
  dataClass,
}: EvidenceDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus lands somewhere useful on open — a drawer that
  // traps a keyboard user is worse than no drawer.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasNothing = supporting.length === 0 && contradicting.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close evidence"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Evidence"
        className="relative w-full max-w-lg h-full bg-card border-l border-border shadow-xl flex flex-col"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Evidence
            </span>
            <p className="text-sm text-foreground font-medium break-words">{claim}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {dataClass ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {DATA_CLASS[dataClass].label}
              </span>
              <p className="text-xs text-muted-foreground">{DATA_CLASS[dataClass].meaning}</p>
            </div>
          ) : null}

          {hasNothing ? (
            // An explicit "nothing backs this" is more useful than an empty
            // panel that looks like a loading state.
            <div className="veracity-card p-5 flex flex-col gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700">
                We have no quote for this
              </span>
              <p className="text-sm text-muted-foreground">
                We did not save any wording that backs this up, so treat it as our reading rather
                than something a source stated.
              </p>
            </div>
          ) : null}

          {supporting.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                What backs this up — {supporting.length} quote{supporting.length === 1 ? '' : 's'}
              </div>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {supporting.map((span) => (
                  <SpanCard key={span.id} span={span} tone="support" />
                ))}
              </ul>
            </section>
          ) : null}

          {contradicting.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={12} /> What disagrees — {contradicting.length}
              </div>
              <p className="text-xs text-muted-foreground">
                These sources say something different. We show both rather than picking a winner.
              </p>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {contradicting.map((span) => (
                  <SpanCard key={span.id} span={span} tone="contradict" />
                ))}
              </ul>
            </section>
          ) : null}

          {methodology ? (
            <section className="flex flex-col gap-2">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                How we worked this out
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{methodology}</p>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
