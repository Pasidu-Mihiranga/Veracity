'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, Sparkles, ListChecks } from 'lucide-react';

interface FormattedResearchContentProps {
  content: string;
}

export function FormattedResearchContent({ content }: FormattedResearchContentProps) {
  if (!content || !content.trim()) return null;

  // Split raw text into distinct sentences / points
  const rawLines = content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const allSentences: string[] = [];
  rawLines.forEach((line) => {
    // Remove leading bullet symbols
    const cleanLine = line.replace(/^[-*•\d+.]\s*/, '');
    // Split sentences inside a block if it's a long continuous text block
    const sents = cleanLine
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter(Boolean);

    allSentences.push(...sents);
  });

  if (allSentences.length === 0) return null;

  // Executive Overview = First 1 or 2 core sentences
  const primaryOverview = allSentences.slice(0, 2).join(' ');

  // Remaining sentences become point-wise takeaways or evidence gaps
  const remainingSentences = allSentences.length > 2 ? allSentences.slice(2) : [];

  const keyPoints: { label?: string; text: string }[] = [];
  const gapItems: string[] = [];

  remainingSentences.forEach((sentence) => {
    const lower = sentence.toLowerCase();
    if (
      lower.includes('evidence gap') ||
      lower.includes('missing') ||
      lower.includes('incomplete') ||
      lower.includes('caution') ||
      lower.includes('no bound source') ||
      lower.includes('provide both official') ||
      lower.includes('clarify the buyer intent') ||
      lower.includes('procurement criteria')
    ) {
      gapItems.push(sentence);
    } else {
      let label: string | undefined;
      let body = sentence;

      if (sentence.includes('—')) {
        const parts = sentence.split('—');
        label = parts[0].trim();
        body = parts.slice(1).join('—').trim();
      } else if (sentence.includes(':') && !sentence.startsWith('http')) {
        const idx = sentence.indexOf(':');
        if (idx > 0 && idx < 35) {
          label = sentence.substring(0, idx).trim();
          body = sentence.substring(idx + 1).trim();
        }
      }

      keyPoints.push({ label, text: body });
    }
  });

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* 1. Executive Summary & Position (High-Level Overview Paragraph) */}
      <div className="rounded-2xl p-5 bg-accent/5 border border-accent/30 flex items-start gap-3.5 shadow-xs">
        <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-accent block mb-1.5">
            Executive Overview
          </span>
          <p className="text-sm sm:text-[15px] font-semibold text-foreground leading-relaxed">
            {primaryOverview}
          </p>
        </div>
      </div>

      {/* 2. Key Analytical Takeaways (Point-Wise Section) */}
      {keyPoints.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ListChecks size={15} className="text-accent" /> Key Analytical Takeaways
          </span>
          <div className="grid grid-cols-1 gap-2.5">
            {keyPoints.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl p-4 bg-card border border-border flex items-start gap-3 shadow-2xs hover:border-accent/40 transition-all"
              >
                <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {item.label && (
                    <span className="font-bold text-accent mr-1.5 uppercase tracking-wide text-[11px] bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                      {item.label}
                    </span>
                  )}
                  <span className="font-medium">{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Evidence Gaps & Data Coverage (Amber Point-Wise Callout Box) */}
      {gapItems.length > 0 && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={17} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500 block mb-2">
              Evidence Gaps & Data Coverage
            </span>
            <div className="flex flex-col gap-2">
              {gapItems.map((gap, i) => (
                <div key={i} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90 font-medium leading-normal">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{gap}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
