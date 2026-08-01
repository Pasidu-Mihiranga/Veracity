import type {
  AgentOutput,
  AgentRun,
  EvidenceCoverageAxis,
} from '@/lib/agents/types';
import {
  buildEntityTerms,
  sourceMatchesEntities,
} from '@/lib/tools/source-relevance';

type AxisId = EvidenceCoverageAxis['id'];

const AXIS_DEFS: {
  id: AxisId;
  label: string;
  agentIds: string[];
}[] = [
  { id: 'market', label: 'Market', agentIds: ['market-trends'] },
  { id: 'competition', label: 'Competition', agentIds: ['competitive', 'adjacent'] },
  { id: 'customers', label: 'Customers', agentIds: ['win-loss'] },
  { id: 'technology', label: 'Technology', agentIds: ['positioning'] },
  { id: 'pricing', label: 'Pricing', agentIds: ['pricing'] },
];

/**
 * Build Evidence Coverage Radar scores from research agent outputs.
 * Failed / missing / deselected agents contribute 0 on their axes.
 */
export function computeEvidenceCoverage(
  outputs: AgentOutput[],
  agentRuns: AgentRun[],
  product: string,
  competitor?: string,
): EvidenceCoverageAxis[] {
  const terms = buildEntityTerms(product, competitor);
  const byId = new Map(outputs.map((o) => [o.agentId, o]));
  const runById = new Map(agentRuns.map((r) => [r.agentId, r]));

  return AXIS_DEFS.map((axis) => {
    let sourceCount = 0;
    let confSum = 0;
    let confN = 0;
    let matchSum = 0;
    let matchN = 0;
    let anyCompleted = false;

    for (const agentId of axis.agentIds) {
      const run = runById.get(agentId);
      const output = byId.get(agentId);
      if (run?.status === 'failed' || (!output && run?.status !== 'completed')) {
        continue;
      }
      if (!output) continue;
      anyCompleted = true;
      sourceCount += output.sources.length;
      confSum += output.confidenceScore;
      confN += 1;
      const matched = output.sources.filter((s) => sourceMatchesEntities(s, terms)).length;
      matchSum += output.sources.length > 0 ? matched / output.sources.length : 0;
      matchN += 1;
    }

    if (!anyCompleted) {
      return {
        id: axis.id,
        label: axis.label,
        score: 0,
        sourceCount: 0,
        agentIds: axis.agentIds,
      };
    }

    const sourceNorm = Math.min(sourceCount / 8, 1);
    const confAvg = confN > 0 ? confSum / confN : 0;
    const matchAvg = matchN > 0 ? matchSum / matchN : 0;
    const score = Math.max(
      0,
      Math.min(1, sourceNorm * 0.4 + confAvg * 0.35 + matchAvg * 0.25),
    );

    return {
      id: axis.id,
      label: axis.label,
      score: Number(score.toFixed(3)),
      sourceCount,
      agentIds: axis.agentIds,
    };
  });
}

/** Human-readable evidence gaps for answer narration and decision appendices. */
export function describeEvidenceCoverageGaps(
  coverage: EvidenceCoverageAxis[],
): string[] {
  return coverage.flatMap((axis) => {
    if (axis.sourceCount === 0 || axis.score === 0) {
      return [`${axis.label} evidence is missing (0 sources).`];
    }
    if (axis.score < 0.35) {
      return [
        `${axis.label} evidence is thin (${axis.sourceCount} source${axis.sourceCount === 1 ? '' : 's'}, ${Math.round(axis.score * 100)}% coverage).`,
      ];
    }
    return [];
  });
}
