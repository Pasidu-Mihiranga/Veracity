import type { AgentOutput, CampaignVariant } from '../types';

function buildFallbackGroundingSignals(researchOutputs: AgentOutput[]): string[] {
  return researchOutputs
    .flatMap(output => output.facts.slice(0, 2).map(fact => `[${output.domain}] ${fact}`))
    .filter(Boolean)
    .slice(0, 3);
}

export function enforceExecutionGrounding(
  variants: CampaignVariant[],
  researchOutputs: AgentOutput[],
  _product: string,
): CampaignVariant[] {
  const fallbackSignals = buildFallbackGroundingSignals(researchOutputs);
  return variants.map((variant, index) => {
    const groundedSignals = (variant.groundedSignals ?? []).filter(Boolean);
    const safeSignals = groundedSignals.length > 0 ? groundedSignals : fallbackSignals;

    return {
      ...variant,
      id: variant.id?.trim() || `V${index + 1}-SIGNAL`,
      angle: variant.angle?.trim(),
      hypothesis: variant.hypothesis?.trim(),
      successMetric: variant.successMetric?.trim(),
      variable: variant.variable?.trim(),
      groundedSignals: safeSignals.slice(0, 4),
    };
  }).filter((variant) =>
    Boolean(
      variant.angle
      && variant.hypothesis
      && variant.successMetric
      && variant.variable
      && variant.groundedSignals.length > 0,
    ),
  );
}
