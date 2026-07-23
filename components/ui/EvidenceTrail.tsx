'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';

type SourceLink = { title: string; url: string };

type Props = {
  evidence?: string[];
  sourceUrls?: string[];
  sources?: SourceLink[];
};

/**
 * Expandable claim ↔ URL trail for a recommendation.
 */
export function EvidenceTrail({ evidence = [], sourceUrls = [], sources = [] }: Props) {
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

  if (evidence.length === 0 && links.length === 0) return null;

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
          {evidence.map((e, ei) => (
            <p key={`e-${ei}`} className="text-[12px] text-muted-foreground">
              {e}
            </p>
          ))}
          {links.length > 0 ? (
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
          ) : (
            <p className="text-[11px] text-muted-foreground">No bound source URLs for this claim.</p>
          )}
        </div>
      )}
    </div>
  );
}
