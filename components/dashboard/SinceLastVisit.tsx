'use client';

import React, { useState } from 'react';
import {
  ArrowRight, ChevronDown, ChevronRight, Clock, AlertTriangle, Check,
} from 'lucide-react';
import type { Digest, DigestCandidate } from '@/lib/intelligence/digest';
import { importanceOf, TONE_CLASS } from '@/lib/ux/vocabulary';
import { summariseChange } from '@/lib/intelligence/plain-language';

/**
 * The surface a returning user lands on.
 *
 * The research is blunt about this: lead with change, not a blank prompt. A
 * chat box asks the user to remember what they were tracking and re-type it. A
 * change list tells them what happened while they were away, which is the only
 * thing that makes a *second* visit worth more than the first.
 *
 * Three deliberate choices:
 *  - "Nothing changed" is stated confidently, not hidden. It is a real answer,
 *    and a product that only speaks when it has news trains users to assume
 *    silence means broken.
 *  - Every item shows why it was judged material, so a user can disagree with
 *    the threshold rather than having to trust it.
 *  - Suppressed changes are disclosed and expandable. "Why am I not seeing
 *    more?" needs an answer, or the user assumes nothing is being watched.
 */

export interface SinceLastVisitProps {
  digest: Digest;
  projectName: string;
  /** Sources that could not be retrieved this run. */
  staleSources?: Array<{ url: string; detail?: string }>;
  /** Share of sources that were unchanged — the cost story, shown as freshness. */
  unchangedCount?: number;
  sourcesChecked?: number;
  onOpenEvidence?: (spanId: string) => void;
  onAskAbout?: (item: DigestCandidate) => void;
}

const EVENT_TONE: Record<string, string> = {
  pricing_changed: 'bg-accent/5 text-accent border-accent/20',
  feature_launched: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  feature_removed: 'bg-amber-50 text-amber-700 border-amber-200',
  positioning_changed: 'bg-accent/5 text-accent border-accent/20',
  funding_or_filing: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

function toneFor(eventType: string): string {
  return EVENT_TONE[eventType] ?? 'bg-muted text-muted-foreground border-border';
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
}

function ChangeRow({
  item,
  onOpenEvidence,
  onAskAbout,
}: {
  item: DigestCandidate;
  onOpenEvidence?: (spanId: string) => void;
  onAskAbout?: (item: DigestCandidate) => void;
}) {
  // A full sentence, not a label plus a raw diff. "Lilian changed their pricing:
  // $49/month → $59/month — spotted today" needs no decoding.
  const plain = summariseChange({
    entityLabel: item.entityLabel,
    eventType: item.eventType,
    beforeValue: item.beforeValue,
    afterValue: item.afterValue,
    materiality: item.materiality,
    observedAt: item.observedAt,
  });
  const importance = importanceOf(item.materiality);

  return (
    <li className="veracity-card p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${TONE_CLASS[importance.tone]}`}
          title={importance.meaning}
        >
          {importance.label}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1">
          <Clock size={10} /> {relativeTime(item.observedAt)}
        </span>
      </div>

      <div className="text-sm text-foreground break-words">{plain.sentence}</div>

      {/* Why it matters, phrased for the reader rather than as a score. */}
      <p className="text-xs text-muted-foreground leading-relaxed">{plain.importance}</p>

      {plain.suggestion ? (
        // A question, not an instruction. We do not know enough about their
        // situation to tell them what to do.
        <p className="text-xs text-accent">{plain.suggestion}</p>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        {item.evidenceSpanId && onOpenEvidence ? (
          <button
            type="button"
            onClick={() => onOpenEvidence(item.evidenceSpanId!)}
            className="text-[10px] font-mono text-accent hover:underline"
          >
            See the quote
          </button>
        ) : null}
        {onAskAbout ? (
          <button
            type="button"
            onClick={() => onAskAbout(item)}
            className="text-[10px] font-mono text-accent hover:underline inline-flex items-center gap-1"
          >
            Ask about this <ArrowRight size={10} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function SinceLastVisit({
  digest,
  projectName,
  staleSources = [],
  unchangedCount,
  sourcesChecked,
  onOpenEvidence,
  onAskAbout,
}: SinceLastVisitProps) {
  const [showSuppressed, setShowSuppressed] = useState(false);
  const nothingChanged = digest.itemCount === 0;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            What changed while you were away
          </span>
          <h2 className="text-lg font-serif text-foreground">{digest.headline}</h2>
          <span className="text-[10px] font-mono text-muted-foreground">
            {projectName} · {digest.periodStart.slice(0, 10)} to {digest.periodEnd.slice(0, 10)}
          </span>
        </div>

        {typeof sourcesChecked === 'number' ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-muted-foreground">
              We checked {sourcesChecked} source{sourcesChecked === 1 ? '' : 's'}
            </span>
            {typeof unchangedCount === 'number' && unchangedCount > 0 ? (
              // Framed as freshness rather than as a cost metric: the user cares
              // that we looked, not that we saved a model call.
              <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1">
                <Check size={10} className="text-emerald-500" />
                {unchangedCount} unchanged since last time
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {nothingChanged ? (
        // Said plainly. A product that only speaks when it has news teaches
        // users that silence means broken.
        <div className="veracity-card p-5 flex flex-col gap-2">
          <div className="text-sm text-foreground">
            Nothing worth your attention changed.
          </div>
          <p className="text-xs text-muted-foreground">
            We checked every source and compared it against last time. Prices, packaging,
            releases and positioning are all where you left them.
          </p>
        </div>
      ) : (
        digest.sections.map((section) => (
          <div key={section.entityLabel} className="flex flex-col gap-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {section.entityLabel}
            </div>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {section.items.map((item) => (
                <ChangeRow
                  key={item.id}
                  item={item}
                  onOpenEvidence={onOpenEvidence}
                  onAskAbout={onAskAbout}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      {staleSources.length > 0 ? (
        // Coverage gaps are surfaced rather than hidden: "no change" and "we
        // could not look" mean opposite things.
        <div className="veracity-card p-4 flex flex-col gap-2 border-l-2 border-l-amber-400">
          <div className="text-xs font-mono uppercase tracking-wider text-amber-700 inline-flex items-center gap-1.5">
            <AlertTriangle size={12} /> {staleSources.length} source
            {staleSources.length === 1 ? '' : 's'} we could not reach
          </div>
          <ul className="flex flex-col gap-1 list-none p-0 m-0">
            {staleSources.map((source) => (
              <li key={source.url} className="text-xs text-muted-foreground break-all">
                {source.url}
                {source.detail ? ` — ${source.detail}` : ''}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            We could not open these, so if something changed there we would not have seen it.
          </p>
        </div>
      ) : null}

      {digest.suppressed.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowSuppressed((v) => !v)}
            aria-expanded={showSuppressed}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start"
          >
            {showSuppressed ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {digest.suppressed.length} smaller change{digest.suppressed.length === 1 ? '' : 's'} we did not interrupt you for
          </button>

          {showSuppressed ? (
            <ul className="flex flex-col gap-1 list-none p-0 m-0 pl-4">
              {digest.suppressed.map((s) => (
                <li key={s.id} className="text-xs text-muted-foreground">
                  {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
