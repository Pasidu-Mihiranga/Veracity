/**
 * Gemini token + dollar cost tracking from response usageMetadata.
 */

export type GeminiUsage = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thoughtsTokenCount?: number;
};

export type GeminiUsageTotals = {
  calls: number;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

/** Flash-class list prices ($ / 1M tokens) — update when Google changes pricing. */
const PRICE_INPUT_PER_M = 0.10;
const PRICE_OUTPUT_PER_M = 0.40;

const processTotals: GeminiUsageTotals = {
  calls: 0,
  promptTokens: 0,
  candidatesTokens: 0,
  thoughtsTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
};

export function estimateGeminiCostUsd(usage: GeminiUsage): number {
  const input = usage.promptTokenCount || 0;
  const output = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
  return (input * PRICE_INPUT_PER_M + output * PRICE_OUTPUT_PER_M) / 1_000_000;
}

export function parseGeminiUsage(payload: unknown): GeminiUsage | null {
  if (!payload || typeof payload !== 'object') return null;
  const meta = (payload as { usageMetadata?: Record<string, unknown> }).usageMetadata;
  if (!meta || typeof meta !== 'object') return null;

  const promptTokenCount = Number(meta.promptTokenCount ?? 0);
  const candidatesTokenCount = Number(meta.candidatesTokenCount ?? 0);
  const totalTokenCount = Number(meta.totalTokenCount ?? promptTokenCount + candidatesTokenCount);
  const thoughtsTokenCount = meta.thoughtsTokenCount != null
    ? Number(meta.thoughtsTokenCount)
    : undefined;

  if (![promptTokenCount, candidatesTokenCount, totalTokenCount].every(Number.isFinite)) {
    return null;
  }

  return {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount,
    thoughtsTokenCount: Number.isFinite(thoughtsTokenCount) ? thoughtsTokenCount : undefined,
  };
}

/** Record usage from a Gemini API JSON body; returns the parsed usage (if any). */
export function recordGeminiUsage(payload: unknown): GeminiUsage | null {
  const usage = parseGeminiUsage(payload);
  if (!usage) return null;

  const cost = estimateGeminiCostUsd(usage);
  processTotals.calls += 1;
  processTotals.promptTokens += usage.promptTokenCount;
  processTotals.candidatesTokens += usage.candidatesTokenCount;
  processTotals.thoughtsTokens += usage.thoughtsTokenCount ?? 0;
  processTotals.totalTokens += usage.totalTokenCount;
  processTotals.estimatedCostUsd = Number(
    (processTotals.estimatedCostUsd + cost).toFixed(6),
  );

  return usage;
}

export function getGeminiUsageTotals(): GeminiUsageTotals {
  return { ...processTotals };
}

/** Test helper — reset process counters. */
export function resetGeminiUsageTotals(): void {
  processTotals.calls = 0;
  processTotals.promptTokens = 0;
  processTotals.candidatesTokens = 0;
  processTotals.thoughtsTokens = 0;
  processTotals.totalTokens = 0;
  processTotals.estimatedCostUsd = 0;
}
