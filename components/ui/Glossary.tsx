'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { GLOSSARY } from '@/lib/ux/vocabulary';

/**
 * What every term on screen actually means.
 *
 * Roughly one in six analytics platforms ships a glossary, despite a measurable
 * effect on user confidence. It costs almost nothing and answers the question a
 * user would otherwise guess at, ask a colleague, or quietly get wrong.
 *
 * Collapsed by default. Someone who understands the product should not have to
 * scroll past an explanation of it every visit — but someone who does not
 * should never have to go looking.
 */
export function Glossary() {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs font-mono text-muted-foreground hover:text-foreground uppercase tracking-wider inline-flex items-center gap-1.5 self-start"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <BookOpen size={12} /> What do these words mean?
      </button>

      {open ? (
        <div className="veracity-card p-5 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Everything here is written to be read once. If a term on screen is not in this
            list, it should not be on screen.
          </p>

          <dl className="flex flex-col gap-3 m-0">
            {GLOSSARY.map((entry) => (
              <div key={entry.term} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold text-foreground">{entry.term}</dt>
                <dd className="text-xs text-muted-foreground m-0">{entry.plain}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
