import { describe, expect, it } from 'vitest';
import { getArtifactDataClass } from '@/lib/artifact-truth';

describe('artifact truth classification', () => {
  it('defaults research artifacts to derived instead of observed', () => {
    expect(getArtifactDataClass({ artifactType: 'trend-chart' })).toBe('derived');
  });

  it('honors an explicit observed classification', () => {
    expect(getArtifactDataClass({ artifactType: 'pricing-table', dataClass: 'observed' })).toBe('observed');
  });

  it('never lets scenario artifacts present as observed', () => {
    expect(getArtifactDataClass({ artifactType: 'scenario-distribution', dataClass: 'observed' })).toBe('synthetic');
    expect(getArtifactDataClass({ artifactType: 'forecast-chart' })).toBe('synthetic');
  });
});
