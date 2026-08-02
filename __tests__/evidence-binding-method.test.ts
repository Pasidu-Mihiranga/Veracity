/**
 * A lexical match and a real excerpt are different things, and the product must
 * not present them as the same thing. These tests lock that distinction.
 */

import { describe, it, expect } from 'vitest';
import { bindEvidenceToSources, bindProseToSources } from '@/lib/agents/bind-evidence';
import type { AgentSource, Recommendation } from '@/lib/agents/types';

const sources: AgentSource[] = [
  {
    url: 'https://lilian.example/pricing',
    title: 'Lilian pricing plans for teams',
    timestamp: '2026-08-01T00:00:00.000Z',
    tool: 'firecrawl',
  },
];

const CLAIM = 'Lilian pricing plans for teams changed';

function recommendation(evidence: string[]): Recommendation {
  return {
    title: 'Respond to the pricing move',
    rationale: 'Competitor repriced the entry tier',
    evidence,
    confidence: 'high',
    priority: 'immediate',
  } as Recommendation;
}

describe('binding method', () => {
  it('marks a lexical overlap as lexical, not as proof', () => {
    const [rec] = bindEvidenceToSources(
      [recommendation([CLAIM])],
      sources,
      'Vector Agents',
      'Lilian',
    );
    const binding = rec.evidenceBindings![0];
    expect(binding.bindingMethod).toBe('lexical');
    expect(binding.evidenceSpanIds).toBeUndefined();
    // Overlapping words are a hint that a source is topically related. They do
    // not establish that the page says what the claim says.
    expect(binding.matchScore).toBeLessThan(1);
  });

  it('prefers a real span when one exists', () => {
    const [rec] = bindEvidenceToSources(
      [recommendation([CLAIM])],
      sources,
      'Vector Agents',
      'Lilian',
      3,
      {
        spanIndex: {
          byClaim: new Map([
            [CLAIM, { spanIds: ['span-1', 'span-2'], sourceUrls: ['https://lilian.example/pricing'] }],
          ]),
        },
      },
    );
    const binding = rec.evidenceBindings![0];
    expect(binding.bindingMethod).toBe('span');
    expect(binding.evidenceSpanIds).toEqual(['span-1', 'span-2']);
    expect(binding.support).toBe('supported');
    expect(binding.matchScore).toBe(1);
  });

  it('falls back to lexical for claims with no span', () => {
    const [rec] = bindEvidenceToSources(
      [recommendation([CLAIM, 'Some other unproven statement about pricing plans'])],
      sources,
      'Vector Agents',
      'Lilian',
      3,
      {
        spanIndex: {
          byClaim: new Map([[CLAIM, { spanIds: ['span-1'], sourceUrls: [sources[0].url] }]]),
        },
      },
    );
    const [first, second] = rec.evidenceBindings!;
    expect(first.bindingMethod).toBe('span');
    expect(second.bindingMethod).toBe('lexical');
  });

  it('ignores an empty span list rather than claiming support', () => {
    const [rec] = bindEvidenceToSources(
      [recommendation([CLAIM])],
      sources,
      'Vector Agents',
      'Lilian',
      3,
      { spanIndex: { byClaim: new Map([[CLAIM, { spanIds: [], sourceUrls: [] }]]) } },
    );
    expect(rec.evidenceBindings![0].bindingMethod).toBe('lexical');
  });

  it('labels prose bindings too', () => {
    const bindings = bindProseToSources(
      'Lilian pricing plans for teams changed this quarter.',
      sources,
      'Vector Agents',
      'Lilian',
    );
    expect(bindings.every((b) => b.bindingMethod === 'lexical')).toBe(true);
  });
});
