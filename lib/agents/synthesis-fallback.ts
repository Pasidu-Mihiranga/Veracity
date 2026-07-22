/**
 * Shared handling when Gemini JSON synthesis fails for a domain agent.
 * Surfaces the real exception so the UI / final answer is not a vague
 * "temporarily unavailable" message with no root cause.
 */

export const SYNTHESIS_ERROR_PREFIX = 'SYNTHESIS_ERROR:';

export function formatSynthesisError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const trimmed = message.trim() || 'Unknown synthesis failure';
  return `${SYNTHESIS_ERROR_PREFIX} ${trimmed}`;
}

export function synthesisFailureInterpretation(err: unknown): string[] {
  return [
    formatSynthesisError(err),
    'AI analysis failed for this domain. Facts below are raw search snippets only — not a verified answer to the user query.',
  ];
}

export function isSynthesisFailureInterpretation(lines: string[] | undefined): boolean {
  return Boolean(lines?.some((line) => line.startsWith(SYNTHESIS_ERROR_PREFIX)));
}

/** Confidence when synthesis failed (tools may still have returned snippets). */
export const SYNTHESIS_FAILURE_CONFIDENCE = 0.2;

export function factsFromRawSignals(rawContent: string[], limit = 4): string[] {
  return rawContent
    .slice(0, limit)
    .map((s) => s.replace(/^\[[^\]]+\]\s*/, ''))
    .filter((s) => s.length > 15);
}
