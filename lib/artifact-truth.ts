import type { AgentOutput } from './agents/types';

export type ArtifactDataClass = NonNullable<AgentOutput['dataClass']>;

/**
 * Conservative public classification. Existing research artifacts are model-
 * derived unless a producer explicitly proves that the artifact is observed.
 * Legacy forecast records are always synthetic.
 */
export function getArtifactDataClass(output: Pick<AgentOutput, 'artifactType' | 'dataClass'>): ArtifactDataClass {
  if (output.artifactType === 'scenario-distribution' || output.artifactType === 'forecast-chart') {
    return 'synthetic';
  }
  return output.dataClass ?? 'derived';
}

export const ARTIFACT_DATA_CLASS_COPY: Record<ArtifactDataClass, { label: string; detail: string }> = {
  observed: {
    label: 'Observed data',
    detail: 'Values come directly from stored source observations.',
  },
  derived: {
    label: 'Derived analysis',
    detail: 'Model-generated analysis; inspect the cited sources before acting.',
  },
  synthetic: {
    label: 'Synthetic scenario',
    detail: 'Simulated stakeholder responses; not survey data or a calibrated forecast.',
  },
};
