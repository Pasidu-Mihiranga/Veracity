import type {
  DistributionBucket,
  ForecastOutput,
  SwarmScenarioOutput,
} from '@/lib/agents/types';

export function normalizeScenarioDistribution(
  buckets: DistributionBucket[] | undefined,
  panelSize: number,
): DistributionBucket[] {
  if (!Array.isArray(buckets) || panelSize <= 0) return [];
  const normalized = buckets
    .map((bucket) => ({
      label: String(bucket.label ?? '').trim(),
      count: Math.max(0, Math.trunc(Number(bucket.count))),
    }))
    .filter((bucket) => bucket.label && Number.isFinite(bucket.count));
  const total = normalized.reduce((sum, bucket) => sum + bucket.count, 0);
  return total === panelSize ? normalized : [];
}

/** Render old persisted forecast records without preserving false precision. */
export function legacyForecastToScenario(output: ForecastOutput): SwarmScenarioOutput {
  const distribution = normalizeScenarioDistribution(output.distribution, output.swarmSize);
  return {
    agentId: output.agentId,
    domain: output.domain,
    confidence: output.confidence,
    confidenceScore: output.confidenceScore,
    interpretation: output.interpretation ?? [],
    sources: output.sources ?? [],
    generatedAt: output.generatedAt,
    artifactType: 'scenario-distribution',
    dataClass: 'synthetic',
    facts: [],
    question: output.question,
    swarmSize: output.swarmSize,
    timeHorizon: output.timeHorizon,
    distribution,
    perspectives: output.contributingSignals ?? [],
    scenarioObservations: [...(output.facts ?? []), ...(output.interpretation ?? [])],
    personaResponses: [],
    rationale: output.rationale,
    methodology: 'Legacy MiroFish persona-panel synthesis. Statistical point estimates and confidence intervals are intentionally not displayed.',
    limitations: [
      'Synthetic personas are not a representative sample of real customers.',
      'This legacy result was generated with the former forecast schema.',
      ...(distribution.length === 0 && output.swarmSize > 0
        ? ['The saved category counts did not reconcile to panel size, so the distribution chart is hidden.']
        : []),
    ],
  };
}
