// @ts-nocheck
import { describe, expect, it } from 'vitest';
import type { AgentOutput, CampaignVariant } from '@/lib/agents/types';
import { enforceExecutionGrounding } from '@/lib/agents/execution/grounding';

const researchOutputs: AgentOutput[] = [
  {
    agentId: 'competitive',
    domain: 'competitive',
    confidence: 'high',
    confidenceScore: 0.8,
    facts: ['Competitor launched a pricing calculator for enterprise prospects'],
    interpretation: ['Messaging now emphasizes measurable ROI over feature parity'],
    sources: [],
    generatedAt: new Date().toISOString(),
    artifactType: 'competitive-matrix',
  },
];

describe('execution grounding contract', () => {
  it('rejects incomplete variants instead of inventing campaign claims and metrics', () => {
    const variants: CampaignVariant[] = [
      {
        id: '',
        angle: '',
        hypothesis: '',
        successMetric: '',
        variable: '',
        channels: {},
        groundedSignals: [],
      },
    ];

    const safe = enforceExecutionGrounding(variants, researchOutputs, 'Vector Agents');

    expect(safe).toEqual([]);
  });

  it('does not fabricate a fallback variant when generation returns none', () => {
    const safe = enforceExecutionGrounding([], researchOutputs, 'Vector Agents');

    expect(safe).toEqual([]);
  });

  it('adds real research grounding to an otherwise complete generated variant', () => {
    const safe = enforceExecutionGrounding([{
      id: 'V1',
      angle: 'Measured ROI',
      hypothesis: 'A quantified proof point increases qualified replies.',
      successMetric: 'Qualified reply rate',
      variable: 'opening proof point',
      channels: {},
      groundedSignals: [],
    }], researchOutputs, 'Vector Agents');

    expect(safe).toHaveLength(1);
    expect(safe[0].groundedSignals[0]).toContain('[competitive]');
  });
});
