import { describe, expect, it } from 'vitest';
import { compareSourceCoverage, extractProjectSnapshot } from '@/lib/project-snapshot-data';

describe('project research snapshots', () => {
  it('extracts deduplicated sources and average evidence coverage', () => {
    const snapshot = extractProjectSnapshot({
      orchestratorOutput: {
        product: 'Acme', competitor: 'Rival', synthesizedAnswer: 'Summary', generatedAt: '2026-08-01T00:00:00.000Z',
        outputs: [
          { sources: [{ url: 'https://a.example' }, { url: 'https://a.example' }] },
          { sources: [{ url: 'https://b.example' }] },
        ],
        evidenceCoverage: [{ score: 0.5 }, { score: 0.9 }],
      },
    }, 'fallback');
    expect(snapshot?.sourceUrls).toEqual(['https://a.example', 'https://b.example']);
    expect(snapshot?.evidenceScore).toBeCloseTo(0.7);
  });

  it('reports coverage additions and removals without calling them market changes', () => {
    expect(compareSourceCoverage(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
  });
});
