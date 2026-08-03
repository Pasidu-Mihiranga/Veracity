'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, Info, Sparkles, FileText } from 'lucide-react';

interface FormattedResearchContentProps {
  content: string;
}

export function FormattedResearchContent({ content }: FormattedResearchContentProps) {
  if (!content) return null;

  // Split content by paragraphs or double newlines
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Identify primary summary vs gap/limitation warnings vs point items
  const primaryFinding = paragraphs[0] || content;
  const secondaryParagraphs = paragraphs.slice(1);

  // Separate evidence gaps / warning items from general points
  const gapItems: string[] = [];
  const pointItems: string[] = [];

  secondaryParagraphs.forEach((para) => {
    // Split bullet points if text contains markdown bullets or numbers
    const lines = para.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((line) => {
      const cleaned = line.replace(/^[-*•\d+.]\s*/, '');
      if (
        line.toLowerCase().includes('evidence gap') ||
        line.toLowerCase().includes('missing') ||
        line.toLowerCase().includes('incomplete') ||
        line.toLowerCase().includes('caution') ||
        line.toLowerCase().includes('no bound source')
      ) {
        gapItems.push(cleaned);
      } else {
        pointItems.push(cleaned);
      }
    });
  });

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Primary Executive Summary Highlight Box */}
      <div className="rounded-2xl p-5 bg-accent/5 border border-accent/30 flex items-start gap-3 shadow-xs">
        <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-accent block mb-1">
            Executive Summary & Position
          </span>
          <p className="text-[15.5px] font-semibold text-foreground leading-relaxed">
            {primaryFinding}
          </p>
        </div>
      </div>

      {/* Point-wise Separation Grid */}
      {pointItems.length > 0 && (
        <div className="flex flex-col gap-3 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText size={14} className="text-accent" /> Key Analytical Points
          </span>
          <div className="grid grid-cols-1 gap-2.5">
            {pointItems.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl p-3.5 bg-card border border-border flex items-start gap-3 shadow-2xs hover:border-accent/40 transition-colors"
              >
                <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" />
                <p className="text-sm sm:text-[14.5px] text-foreground font-medium leading-relaxed">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence & Market Gaps Highlight Box */}
      {gapItems.length > 0 && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={17} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500 block mb-1">
              Evidence Gaps & Data Coverage
            </span>
            <div className="flex flex-col gap-1.5">
              {gapItems.map((gap, i) => (
                <p key={i} className="text-xs sm:text-sm text-foreground/90 font-medium leading-normal">
                  • {gap}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
