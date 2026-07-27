/**
 * Format shared scratchpad facts for injection into later agents' priorContext.
 * Domain agents already append `priorContext` into their Gemini prompts.
 */
export function formatPriorWaveFindings(scratchpad: {
  productFacts: string[];
  competitorFacts: string[];
  openQuestions: string[];
}): string | undefined {
  const lines: string[] = [];
  if (scratchpad.productFacts.length > 0) {
    lines.push('Prior research findings (product):');
    for (const f of scratchpad.productFacts.slice(0, 12)) {
      lines.push(`- ${f}`);
    }
  }
  if (scratchpad.competitorFacts.length > 0) {
    lines.push('Prior research findings (competitor):');
    for (const f of scratchpad.competitorFacts.slice(0, 12)) {
      lines.push(`- ${f}`);
    }
  }
  if (scratchpad.openQuestions.length > 0) {
    lines.push('Open questions from earlier agents:');
    for (const q of scratchpad.openQuestions.slice(0, 6)) {
      lines.push(`- ${q}`);
    }
  }
  if (lines.length === 0) return undefined;
  return lines.join('\n');
}

export function mergePriorContext(
  base: string | undefined,
  waveFindings: string | undefined,
): string | undefined {
  const parts = [base, waveFindings].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
