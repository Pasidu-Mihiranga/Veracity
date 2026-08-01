'use client';

import type { ForecastOutput } from '@/lib/agents/types';
import { legacyForecastToScenario } from '@/lib/swarm-scenario';
import { SwarmScenarioChart } from './SwarmScenarioChart';

/**
 * Compatibility renderer for forecast artifacts saved by older releases.
 * It intentionally discards the legacy point estimate and confidence interval
 * and presents the saved panel as a synthetic scenario.
 */
export function ForecastChart({ output, product }: { output: ForecastOutput; product: string }) {
  return <SwarmScenarioChart output={legacyForecastToScenario(output)} product={product} />;
}
