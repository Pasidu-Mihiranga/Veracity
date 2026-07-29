import type { OrchestratorOutput } from '@/lib/agents/types';
import {
  severityFromCategory,
  type EventCategory,
} from '@/lib/monitoring/severity';
import { buildAlertDedupeKey } from '@/lib/monitoring/dedupe';
import { buildClusterKey } from '@/lib/monitoring/cluster-events';
import {
  type MonitoringSignal,
} from '@/lib/monitoring/signal-collectors';
import { diffCompetitorProfileOutputs } from '@/lib/continuous-intelligence/profile-utils';

export type DiffResult = {
  material: boolean;
  title: string;
  summary: string;
  category: EventCategory;
  severity: ReturnType<typeof severityFromCategory>;
  changedRecTitles: string[];
  events: MonitoringSignal[];
  suppressedSignals: MonitoringSignal[];
  materialityBasis: 'profile-diff' | 'baseline' | 'none';
  profileChangedFields: string[];
  limitations: string[];
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

  const profileDiff = diffCompetitorProfileOutputs(prev, next);
  const events = profileDiff.materialEvents;
  const primary = events[0];
  const material = events.length > 0;
  const category = primary?.category ?? 'other';
  const severity = primary?.severity ?? 'low';
  const competitor = next.competitor ?? 'Competitor';
  const title = primary
    ? `${competitor}: ${primary.title}`
    : `${competitor}: no material change`;

  return {
    material,
    title,
    summary: primary?.summary
      ?? (!prev
        ? 'Baseline established; no change alert emitted on the first sweep.'
        : `${profileDiff.suppressedSignals.length} non-material or ungrounded signal(s) suppressed.`),
    category,
    severity,
    changedRecTitles,
    events,
    suppressedSignals: profileDiff.suppressedSignals,
    materialityBasis: primary ? 'profile-diff' : !prev ? 'baseline' : 'none',
    profileChangedFields: profileDiff.changedFields,
    limitations: [
      ...(next.evidenceLimitations ?? []),
      ...profileDiff.suppressedSignals
        .filter((signal) => signal.sourceUrls.length === 0)
        .map((signal) => signal.materialityReason),
      ...(next.agentRuns ?? [])
        .filter((run) => run.status === 'failed')
        .map((run) => `${run.name} failed during this monitoring sweep.`),
    ].filter((value, index, all) => value && all.indexOf(value) === index).slice(0, 6),
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
  const artifacts = diff.events.map((event) => ({
    event,
    dedupeKey: buildAlertDedupeKey({
      competitor: input.competitor,
      product: input.product,
      title: event.title,
    }),
    clusterKey: buildClusterKey({
      competitor: input.competitor,
      category: event.category,
      date: event.eventDate,
    }),
  }));
  return { diff, artifacts };
}
