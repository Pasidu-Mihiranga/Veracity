import { describe, expect, it } from 'vitest';
import { normalizeMindMapTree } from '@/lib/agents/mind-map-normalize';

describe('normalizeMindMapTree', () => {
  it('caps branches and shortens labels', () => {
    const result = normalizeMindMapTree({
      centralTopic: 'Capture emerging demand for Vector Agents platform',
      summary: 'Specialize and prove ROI.',
      query: 'What should Vector Agents build?',
      product: 'Vector Agents',
      branches: Array.from({ length: 7 }).map((_, i) => ({
        id: `b${i}`,
        label: `Pillar ${i} specialized enterprise workflow focus area`,
        detail: 'detail',
        children: [
          {
            id: `c${i}`,
            label: 'Ship specialized HR digital worker workflow for enterprises now',
            detail: 'child detail',
          },
        ],
      })),
    });

    expect(result.branches).toHaveLength(5);
    expect(result.branches[0].label.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(result.branches[0].children?.[0].label.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it('renames hub when it collides with a branch title', () => {
    const result = normalizeMindMapTree({
      centralTopic: 'Market Trend Alignment',
      query: 'What should Vector Agents build to capture emerging demand?',
      product: 'Vector Agents',
      branches: [
        {
          id: 'b1',
          label: 'Market Trend Alignment',
          detail: 'dup',
          children: [{ id: 'c1', label: 'Focus on ROI', detail: 'x' }],
        },
        {
          id: 'b2',
          label: 'Outcome Pricing',
          detail: 'dup',
          children: [{ id: 'c2', label: 'Price per work unit', detail: 'x' }],
        },
      ],
    });

    expect(result.centralTopic.toLowerCase()).not.toBe('market trend alignment');
    expect(result.branches.some((b) => b.label.toLowerCase() === 'market trend alignment')).toBe(true);
  });
});
