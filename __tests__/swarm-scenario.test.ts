import { describe, expect, it } from 'vitest';
import { legacyForecastToScenario, normalizeScenarioDistribution } from '@/lib/swarm-scenario';
import type { ForecastOutput } from '@/lib/agents/types';

describe('swarm scenario truth contract', () => {
  it('accepts a distribution only when counts reconcile to panel size', () => {
    expect(normalizeScenarioDistribution([
      { label: 'prefer A', count: 3 },
      { label: 'prefer B', count: 2 },
    ], 5)).toHaveLength(2);
    expect(normalizeScenarioDistribution([{ label: 'prefer A', count: 3 }], 5)).toEqual([]);
  });

  it('converts legacy forecasts without carrying point estimates into the scenario UI contract', () => {
    const legacy = {
      agentId: 'mirofish', domain: 'mirofish', artifactType: 'forecast-chart',
      confidence: 'medium', confidenceScore: 0.5, facts: ['Panel preferred A'],
      interpretation: ['Procurement objected'], sources: [], generatedAt: new Date().toISOString(),
      question: 'A or B?', pointEstimate: 0.8, unit: 'probability', confidenceLow: 0.6,
      confidenceHigh: 0.9, direction: 'up', swarmSize: 5, timeHorizon: '6 months',
      distribution: [{ label: 'A', count: 5 }], contributingSignals: [], rationale: 'Legacy.',
    } as ForecastOutput;
    const scenario = legacyForecastToScenario(legacy);
    expect(scenario.artifactType).toBe('scenario-distribution');
    expect(scenario.dataClass).toBe('synthetic');
    expect(scenario.facts).toEqual([]);
    expect(scenario.scenarioObservations).toContain('Panel preferred A');
    expect('pointEstimate' in scenario).toBe(false);
  });
});
