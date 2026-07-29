'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';
import type { EvidenceClaimBinding } from '@/lib/agents/types';

type SourceLink = { title: string; url: string };

type Props = {
  evidence?: string[];
  sourceUrls?: string[];
  sources?: SourceLink[];
  evidenceBindings?: EvidenceClaimBinding[];
};

/**
 * Expandable claim ↔ URL trail for a recommendation.
 */
export function EvidenceTrail({
  evidence = [],
  sourceUrls = [],
  sources = [],
  evidenceBindings = [],
}: Props) {
  const [open, setOpen] = useState(false);

  if (!featureFlags.evidenceTrail) {
    if (evidence.length === 0) return null;
    return (
      <ul className="flex flex-col gap-1 mt-1">
        {evidence.map((e, ei) => (
          <li key={ei} className="text-[12px] flex items-start gap-1.5 text-muted-foreground">
            <span className="font-mono mt-0.5 shrink-0 text-accent">›</span>
            {e}
          </li>
        ))}
      </ul>
    );
  }

  const byUrl = new Map(sources.map((s) => [s.url, s.title]));
  const links = sourceUrls
    .filter(Boolean)
    .map((url) => ({ url, title: byUrl.get(url) || url.replace(/^https?:\/\//, '').slice(0, 48) }));

  if (evidence.length === 0 && links.length === 0 && evidenceBindings.length === 0) return null;

  const supportClasses = {
    supported: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'weakly-supported': 'bg-amber-50 text-amber-700 border-amber-200',
    unsupported: 'bg-red-50 text-red-600 border-red-200',
  } as const;

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-accent self-start"
      >
        Evidence trail
        <ChevronDown
          size={12}
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms ease' }}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 pl-1 border-l border-accent/20">
          {evidenceBindings.length > 0 ? (
            evidenceBindings.map((binding, index) => (
              <div key={`${binding.claim}-${index}`} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] text-muted-foreground">{binding.claim}</p>
                  <span className={`shrink-0 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${supportClasses[binding.support]}`}>
                    {binding.support.replace('-', ' ')}
                  </span>
                </div>
                {binding.sourceUrls.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {binding.sourceUrls.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-accent inline-flex items-center gap-1 hover:underline"
                        >
                          {byUrl.get(url) || url.replace(/^https?:\/\//, '').slice(0, 48)}
                          <ExternalLink size={10} />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No source met the binding threshold.</p>
                )}
              </div>
            ))
          ) : (
            evidence.map((item, index) => (
              <p key={`e-${index}`} className="text-[12px] text-muted-foreground">
                {item}
              </p>
            ))
          )}
          {evidenceBindings.length === 0 && links.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-accent inline-flex items-center gap-1 hover:underline"
                  >
                    {l.title}
                    <ExternalLink size={10} />
                  </a>
                </li>
              ))}
            </ul>
          ) : evidenceBindings.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No bound source URLs for this claim.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
