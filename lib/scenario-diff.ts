import type { ChatMessage } from '@/types/chat-ui';
import type { OrchestratorOutput } from '@/lib/agents/types';

export type ScenarioDiffItem = {
  id: string;
  label: string;
  direction: 'up' | 'down' | 'changed' | 'same';
  detail: string;
};

function avgCoverage(out?: OrchestratorOutput): number {
  const axes = out?.evidenceCoverage ?? [];
  if (!axes.length) return 0;
  return axes.reduce((s, a) => s + a.score, 0) / axes.length;
}

function sourceCount(msg: ChatMessage): number {
  return msg.sources?.length
    ?? msg.orchestratorOutput?.outputs?.flatMap((o) => o.sources).length
    ?? 0;
}

/**
 * Deterministic side-by-side scenario diffs for What-If / compare UI.
 */
export function computeScenarioDiff(
  a: ChatMessage,
  b: ChatMessage,
): ScenarioDiffItem[] {
  const outA = a.orchestratorOutput;
  const outB = b.orchestratorOutput;
  const items: ScenarioDiffItem[] = [];

  const titlesA = new Set((a.recommendations ?? outA?.topRecommendations ?? []).map((r: { title?: string }) => r.title ?? ''));
  const titlesB = new Set((b.recommendations ?? outB?.topRecommendations ?? []).map((r: { title?: string }) => r.title ?? ''));
  const recChanged = [...titlesA].some((t) => t && !titlesB.has(t)) || [...titlesB].some((t) => t && !titlesA.has(t));
  items.push({
    id: 'recs',
    label: 'Recommendations',
    direction: recChanged ? 'changed' : 'same',
    detail: recChanged ? 'Recommendation set changed' : 'Same recommendation titles',
  });

  const confRank = { low: 0, medium: 1, high: 2 } as const;
  const cA = confRank[(outA?.totalConfidence ?? 'medium') as keyof typeof confRank] ?? 1;
  const cB = confRank[(outB?.totalConfidence ?? 'medium') as keyof typeof confRank] ?? 1;
  items.push({
    id: 'confidence',
    label: 'Confidence',
    direction: cB > cA ? 'up' : cB < cA ? 'down' : 'same',
    detail:
      cB > cA
        ? 'Confidence increased'
        : cB < cA
          ? 'Confidence decreased'
          : `Confidence unchanged (${outB?.totalConfidence ?? 'medium'})`,
  });

  const eA = sourceCount(a);
  const eB = sourceCount(b);
  const covA = avgCoverage(outA);
  const covB = avgCoverage(outB);
  const evidenceUp = eB > eA || covB > covA + 0.05;
  const evidenceDown = eB < eA || covB < covA - 0.05;
  items.push({
    id: 'evidence',
    label: 'Evidence',
    direction: evidenceUp ? 'up' : evidenceDown ? 'down' : 'same',
    detail: evidenceUp
      ? `Evidence increased (${eA} → ${eB} sources)`
      : evidenceDown
        ? `Evidence decreased (${eA} → ${eB} sources)`
        : `Evidence similar (${eB} sources)`,
  });

  const costA = outA?.metrics?.estimatedCostUsd ?? 0;
  const costB = outB?.metrics?.estimatedCostUsd ?? 0;
  items.push({
    id: 'cost',
    label: 'Cost',
    direction: costB < costA - 0.0001 ? 'down' : costB > costA + 0.0001 ? 'up' : 'same',
    detail:
      costB < costA
        ? `Cost decreased ($${costA.toFixed(4)} → $${costB.toFixed(4)})`
        : costB > costA
          ? `Cost increased ($${costA.toFixed(4)} → $${costB.toFixed(4)})`
          : `Cost unchanged (~$${costB.toFixed(4)})`,
  });

  const latA = outA?.metrics?.totalLatencyMs ?? 0;
  const latB = outB?.metrics?.totalLatencyMs ?? 0;
  if (latA || latB) {
    items.push({
      id: 'latency',
      label: 'Latency',
      direction: latB < latA ? 'down' : latB > latA ? 'up' : 'same',
      detail: `${(latA / 1000).toFixed(1)}s → ${(latB / 1000).toFixed(1)}s`,
    });
  }

  return items;
}
