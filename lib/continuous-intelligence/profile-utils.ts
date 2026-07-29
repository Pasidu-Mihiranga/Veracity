import type { OrchestratorOutput } from '@/lib/agents/types';
import {
  collectMonitoringSignals,
  extractChangedMonitoringSignals,
  type MonitoringSignal,
} from '@/lib/monitoring/signal-collectors';
import { stableContentHash } from '@/lib/continuous-intelligence/entity-utils';

export type CompetitorProfileState = {
  competitor: string;
  product: string;
  categories: Record<string, Array<{
    id: string;
    summary: string;
    materialityScore: number;
    sourceUrls: string[];
  }>>;
  sourceUrls: string[];
  capturedAt: string;
};

export type ProfileSnapshotDiff = {
  changedFields: string[];
  materialEvents: MonitoringSignal[];
  suppressedSignals: MonitoringSignal[];
  material: boolean;
  profileHash: string;
};

export type CompetitorProfileSnapshotRow = {
  id: string;
  entity_id: string;
  user_id: string;
  workspace_id: string | null;
  job_id: string | null;
  profile_hash: string;
  profile: CompetitorProfileState;
  diff: ProfileSnapshotDiff;
  material_event_count: number;
  source_snapshot_ids: string[];
  observed_at: string;
  created_at: string;
};

export function buildCompetitorProfileState(
  output: OrchestratorOutput,
): CompetitorProfileState {
  const signals = collectMonitoringSignals(output)
    .filter((signal) => signal.origin !== 'recommendation');
  const categories: CompetitorProfileState['categories'] = {};
  for (const signal of signals) {
    const list = categories[signal.category] ?? [];
    list.push({
      id: signal.id,
      summary: signal.summary,
      materialityScore: signal.materialityScore,
      sourceUrls: signal.sourceUrls,
    });
    categories[signal.category] = list
      .sort((left, right) => left.id.localeCompare(right.id));
  }
  return {
    competitor: output.competitor ?? 'Competitor',
    product: output.product,
    categories,
    sourceUrls: [...new Set(
      (output.outputs ?? [])
        .flatMap((agentOutput) => agentOutput.sources ?? [])
        .map((source) => source.url)
        .filter(Boolean),
    )].sort(),
    capturedAt: output.generatedAt,
  };
}

export function diffCompetitorProfileOutputs(
  previous: OrchestratorOutput | null | undefined,
  next: OrchestratorOutput,
): ProfileSnapshotDiff {
  const extracted = extractChangedMonitoringSignals(previous, next);
  const state = buildCompetitorProfileState(next);
  return {
    changedFields: [...new Set(extracted.allNew.map((signal) => signal.category))].sort(),
    materialEvents: previous ? extracted.material : [],
    suppressedSignals: previous ? extracted.suppressed : extracted.allNew,
    material: Boolean(previous && extracted.material.length > 0),
    profileHash: stableContentHash({
      competitor: state.competitor,
      product: state.product,
      categories: state.categories,
      sourceUrls: state.sourceUrls,
    }),
  };
}
