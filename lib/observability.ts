/**
 * Observability barrel — logger, Gemini usage totals, tool timing, exceptions.
 */
export {
  captureException,
  getCorrelationId,
  getLogContext,
  logger,
  withCorrelation,
  withToolLatency,
} from '@/lib/logger';

export {
  estimateGeminiCostUsd,
  getGeminiUsageTotals,
  parseGeminiUsage,
  recordGeminiUsage,
  resetGeminiUsageTotals,
  type GeminiUsage,
  type GeminiUsageTotals,
} from '@/lib/gemini-usage';

import { getGeminiUsageTotals } from '@/lib/gemini-usage';

/** Safe snapshot for response headers / metrics (never throws). */
export function getGeminiUsageSafe() {
  try {
    return getGeminiUsageTotals();
  } catch {
    return null;
  }
}
