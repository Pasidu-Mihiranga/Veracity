'use client';

import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, AlertTriangle, Check, HelpCircle } from 'lucide-react';

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

const ENTITY_MATCH_STYLE: Record<
  EvidenceSpanView['entityMatch'],
  { label: string; className: string; Icon: typeof Check }
> = {
  confirmed: {
    label: 'Entity confirmed',
    className: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    Icon: Check,
  },
  probable: {
    label: 'Entity probable',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: HelpCircle,
  },
  unverified: {
    label: 'Entity unverified',
    className: 'bg-muted text-muted-foreground border-border',
    Icon: HelpCircle,
  },
  mismatch: {
    label: 'Entity mismatch',
    className: 'bg-red-50 text-red-600 border-red-200',
    Icon: AlertTriangle,
  },
};

const DATA_CLASS_NOTE: Record<NonNullable<EvidenceDrawerProps['dataClass']>, string> = {
  measured: 'Read directly from the cited sources.',
  derived: 'Computed from stored records. See the formula below — this is not an outside measurement.',
  synthetic: 'Model-generated scenario output. Not observed evidence and not survey data.',
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
  const match = ENTITY_MATCH_STYLE[span.entityMatch];
  const { Icon } = match;

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
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border inline-flex items-center gap-1 ${match.className}`}
        >
          <Icon size={10} /> {match.label}
        </span>
        {span.extractionType ? (
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {span.extractionType}
          </span>
        ) : null}
        <span className="text-[10px] font-mono text-muted-foreground">
          Retrieved {formatTimestamp(span.retrievedAt)}
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
          snapshot {span.contentHash.slice(0, 12)}
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
                {dataClass}
              </span>
              <p className="text-xs text-muted-foreground">{DATA_CLASS_NOTE[dataClass]}</p>
            </div>
          ) : null}

          {hasNothing ? (
            // An explicit "nothing backs this" is more useful than an empty
            // panel that looks like a loading state.
            <div className="veracity-card p-5 flex flex-col gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700">
                No stored evidence
              </span>
              <p className="text-sm text-muted-foreground">
                No excerpt was captured for this claim. It has not been verified against a
                source and should not be treated as established.
              </p>
            </div>
          ) : null}

          {supporting.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Supporting — {supporting.length}
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
                <AlertTriangle size={12} /> Contradicting — {contradicting.length}
              </div>
              <p className="text-xs text-muted-foreground">
                These sources disagree with the claim. Certainty is reduced rather than one
                side being chosen.
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
                Methodology
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{methodology}</p>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
