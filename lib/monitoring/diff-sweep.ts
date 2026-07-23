import type { OrchestratorOutput } from '@/lib/agents/types';
import {
  categorizeEventText,
  severityFromCategory,
  type EventCategory,
} from '@/lib/monitoring/severity';
import { buildAlertDedupeKey } from '@/lib/monitoring/dedupe';
import { buildClusterKey } from '@/lib/monitoring/cluster-events';

export type DiffResult = {
  material: boolean;
  title: string;
  summary: string;
  category: EventCategory;
  severity: ReturnType<typeof severityFromCategory>;
  changedRecTitles: string[];
};

/** Compare two sweep outputs for monitoring deltas. */
export function diffSweepOutputs(
  prev: OrchestratorOutput | null | undefined,
  next: OrchestratorOutput,
): DiffResult {
  const prevTitles = new Set(
    (prev?.topRecommendations ?? []).map((r) => r.title.trim().toLowerCase()),
  );
  const nextRecs = next.topRecommendations ?? [];
  const changedRecTitles = nextRecs
    .map((r) => r.title)
    .filter((t) => t && !prevTitles.has(t.trim().toLowerCase()));

  const confChanged = Boolean(prev && prev.totalConfidence !== next.totalConfidence);
  const material = changedRecTitles.length > 0 || confChanged || !prev;

  const seedText = [
    changedRecTitles[0] ?? next.synthesizedAnswer.slice(0, 160),
    next.product,
    next.competitor ?? '',
  ].join(' ');
  const category = categorizeEventText(seedText);
  const severity = severityFromCategory(category);
  const competitor = next.competitor ?? 'Competitor';
  const title = changedRecTitles[0]
    ? `${competitor}: ${changedRecTitles[0]}`
    : confChanged
      ? `${competitor}: confidence ${prev?.totalConfidence} → ${next.totalConfidence}`
      : `${competitor}: monitoring update`;

  return {
    material,
    title,
    summary: next.synthesizedAnswer.slice(0, 280),
    category,
    severity,
    changedRecTitles,
  };
}

export function buildMonitoringArtifacts(input: {
  userId: string;
  product: string;
  competitor: string;
  output: OrchestratorOutput;
  prev?: OrchestratorOutput | null;
  jobId?: string;
  watchlistId?: string;
}) {
  const diff = diffSweepOutputs(input.prev, input.output);
  const dedupeKey = buildAlertDedupeKey({
    competitor: input.competitor,
    product: input.product,
    title: diff.title,
  });
  const clusterKey = buildClusterKey({
    competitor: input.competitor,
    category: diff.category,
  });
  return { diff, dedupeKey, clusterKey };
}
