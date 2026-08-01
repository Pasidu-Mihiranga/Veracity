import type { EvidenceCoverageAxis, OrchestratorOutput } from '@/lib/agents/types';

export type ProjectSnapshotData = {
  product: string;
  competitor: string | null;
  summary: string;
  sourceUrls: string[];
  sourceCount: number;
  evidenceScore: number | null;
  generatedAt: string;
};

export function extractProjectSnapshot(metadata: unknown, fallbackContent: string): ProjectSnapshotData | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const output = (metadata as { orchestratorOutput?: OrchestratorOutput }).orchestratorOutput;
  if (!output?.product || !Array.isArray(output.outputs)) return null;
  const sourceUrls = Array.from(new Set(
    output.outputs.flatMap((agent) => agent.sources ?? []).map((source) => source.url).filter(Boolean),
  )).sort();
  const coverage = (output.evidenceCoverage ?? []) as EvidenceCoverageAxis[];
  const evidenceScore = coverage.length
    ? coverage.reduce((sum, axis) => sum + axis.score, 0) / coverage.length
    : null;
  return {
    product: output.product,
    competitor: output.competitor ?? null,
    summary: (output.synthesizedAnswer || fallbackContent).slice(0, 4000),
    sourceUrls,
    sourceCount: sourceUrls.length,
    evidenceScore,
    generatedAt: output.generatedAt || new Date().toISOString(),
  };
}

export function compareSourceCoverage(previous: string[], current: string[]) {
  const before = new Set(previous);
  const after = new Set(current);
  return {
    added: current.filter((url) => !before.has(url)),
    removed: previous.filter((url) => !after.has(url)),
  };
}
