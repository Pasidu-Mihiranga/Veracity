import { describe, expect, it } from 'vitest';
import {
  buildBoardPack,
  buildDecisionFrame,
  buildExecutiveContent,
  rankRecommendations,
  recommendationPattern,
} from '@/lib/agents/decision-support';
import { markStealStrategyUngrounded } from '@/lib/steal-strategy-grounding';
import type { AgentOutput, Recommendation } from '@/lib/agents/types';

function recommendation(
  title: string,
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    title,
    rationale: `${title} because retrieved evidence supports evaluating it.`,
    evidence: ['Retrieved evidence supports this action.'],
    confidence: 'medium',
    priority: 'short-term',
    evidenceStatus: 'weakly-supported',
    sourceUrls: ['https://example.com/evidence'],
    ...overrides,
  };
}

describe('Phase 4 recommendation ranking', () => {
  it('adds every enterprise recommendation field and deterministic ranks', () => {
    const ranked = rankRecommendations({
      recommendations: [
        recommendation('Validate customer retention'),
        recommendation('Build a new platform', { effort: 'high' }),
      ],
      fallbackFalsifiers: ['A controlled test contradicts the recommendation.'],
    });
    expect(ranked.map((item) => item.rank)).toEqual([1, 2]);
    for (const item of ranked) {
      expect(item.rationale).toBeTruthy();
      expect(item.impact).toMatch(/high|medium|low/);
      expect(item.effort).toMatch(/high|medium|low/);
      expect(item.timing).toBeTruthy();
      expect(item.ownerSuggestion).toBeTruthy();
      expect(item.dependencies).toBeInstanceOf(Array);
      expect(item.riskOfInaction).toBeTruthy();
      expect(item.falsifier).toBeTruthy();
      expect(item.decisionScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('downranks rejected patterns and boosts accepted patterns', () => {
    const candidates = [
      recommendation('Raise pricing tiers', {
        priority: 'immediate',
        confidence: 'high',
        evidenceStatus: 'supported',
        impact: 'high',
        effort: 'low',
      }),
      recommendation('Validate customer retention'),
    ];
    const baseline = rankRecommendations({ recommendations: candidates });
    const learned = rankRecommendations({
      recommendations: candidates,
      learningContext: [
        'Cross-session recommendation learning:',
        '- Action rejected: Raise pricing tiers',
        '- Action accepted: Validate customer retention',
      ].join('\n'),
    });
    expect(baseline[0].title).toBe('Raise pricing tiers');
    expect(learned[0].title).toBe('Validate customer retention');
    expect(learned.find((item) => item.title === 'Raise pricing tiers')?.learningAdjustment?.delta)
      .toBeLessThan(0);
    expect(learned.find((item) => item.title === 'Validate customer retention')?.learningAdjustment?.delta)
      .toBeGreaterThan(0);
    expect(buildDecisionFrame({
      answer: 'Choose an option.',
      recommendations: learned,
      unknowns: [],
      evidenceLimitations: [],
      falsifiers: ['A controlled test fails.'],
      parsed: { recommendation: 'Raise pricing tiers' },
    }).recommendation).toBe('Validate customer retention');
  });

  it('fails closed with a ranked evidence-gap action when synthesis returns none', () => {
    const ranked = rankRecommendations({ recommendations: [] });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].evidenceStatus).toBe('unsupported');
    expect(ranked[0].falsifier).toBeTruthy();
  });

  it('assigns stable recommendation patterns', () => {
    expect(recommendationPattern('Repackage pricing tiers')).toBe('pricing');
    expect(recommendationPattern('Audit customer churn')).toBe('customer');
    expect(recommendationPattern('Build an API integration')).toBe('product');
  });
});

describe('Phase 4 decision and board contracts', () => {
  const ranked = rankRecommendations({
    recommendations: [recommendation('Validate customer retention')],
    fallbackFalsifiers: ['Retention data contradicts the thesis.'],
  });
  const frame = buildDecisionFrame({
    answer: 'Evidence is incomplete, so validate retention before proceeding.',
    recommendations: ranked,
    unknowns: ['Net revenue retention is unknown.'],
    evidenceLimitations: ['No audited cohort data was retrieved.'],
    falsifiers: ['Retention data contradicts the thesis.'],
  });

  it('builds the full situation-to-falsifier decision frame', () => {
    expect(frame.situation).toBeTruthy();
    expect(frame.options.length).toBeGreaterThan(0);
    expect(frame.criteria.length).toBeGreaterThan(0);
    expect(frame.recommendation).toBe(ranked[0].title);
    expect(frame.risks).toContain('Net revenue retention is unknown.');
    expect(frame.falsifiers).toContain('Retention data contradicts the thesis.');
  });

  it('does not promote model-authored unsupported risks into the decision frame', () => {
    const guarded = buildDecisionFrame({
      answer: 'The comparison is partial.',
      recommendations: ranked,
      unknowns: ['Switching costs are unknown.'],
      evidenceLimitations: ['No migration evidence was retrieved.'],
      falsifiers: ['A migration test changes the conclusion.'],
      parsed: {
        situation: 'Unsupported market dominance claim.',
        risks: ['Switching costs are definitely high.'],
        options: [{
          label: 'Invented option',
          tradeoff: 'Invented tradeoff',
          evidenceStatus: 'supported',
        }],
      },
    });
    expect(guarded.situation).toBe('The comparison is partial.');
    expect(guarded.risks).not.toContain('Switching costs are definitely high.');
    expect(guarded.risks).toContain('Switching costs are unknown.');
    expect(guarded.options.some((option) => option.label === 'Invented option')).toBe(false);
  });

  it('builds board sections, evidence timeline, and decision memory', () => {
    const outputs: AgentOutput[] = [{
      agentId: 'competitive',
      domain: 'competitive',
      confidence: 'medium',
      confidenceScore: 0.6,
      facts: ['TargetCo serves enterprise buyers.'],
      interpretation: [],
      sources: [{
        title: 'TargetCo product update',
        url: 'https://example.com/update',
        timestamp: '2026-07-20T00:00:00.000Z',
        tool: 'serpapi',
      }],
      generatedAt: '2026-07-29T00:00:00.000Z',
      artifactType: 'competitive-matrix',
    }];
    const pack = buildBoardPack({
      product: 'TargetCo',
      answer: 'Validate retention before proceeding.',
      decisionFrame: frame,
      recommendations: ranked,
      outputs,
      learningContext: [
        'Competitive event timeline:',
        '- EVENT|2026-07-25|TargetCo|RivalCo|pricing|TargetCo changed packaging|Enterprise tier moved to annual contracts.|https://example.com/pricing',
        '- EVENT|2026-07-26|OtherCo|AnotherCo|funding|Unrelated funding|Should not enter this pack.|https://other.example/funding',
        'Prior decisions:',
        '- ACCEPTED: Validate customer retention because evidence was thin',
      ].join('\n'),
      generatedAt: '2026-07-29T00:00:00.000Z',
    });
    expect(pack.sections.map((section) => section.id)).toEqual([
      'situation',
      'options',
      'criteria',
      'recommendation',
      'risks',
      'falsifiers',
      'evidence',
    ]);
    expect(pack.timeline.some((item) => item.sourceUrl === 'https://example.com/pricing')).toBe(true);
    expect(pack.timeline.some((item) => item.sourceUrl === 'https://other.example/funding')).toBe(false);
    expect(pack.decisionMemory[0]).toMatch(/ACCEPTED/);
  });

  it('keeps all uncertainty fields in the executive appendix', () => {
    const content = buildExecutiveContent({
      answer: 'Validate retention.',
      recommendations: ranked,
      assumptions: ['Available sources are representative.'],
      unknowns: ['Retention is unknown.'],
      evidenceLimitations: ['No cohort data.'],
      whatWouldChangeThis: ['Audited data.'],
      alternativeHypotheses: ['Retention may be stronger.'],
      confidenceDrivers: { supports: ['One primary source.'], weakens: ['No customer data.'] },
    });
    expect(content.rankedRecommendationTitles[0]).toMatch(/^#1/);
    expect(content.decisionAppendix.unknowns).toEqual(['Retention is unknown.']);
    expect(content.decisionAppendix.whatWouldChangeThis).toEqual(['Audited data.']);
  });
});

describe('Phase 4 Steal Strategy trust boundary', () => {
  it('labels ungrounded output educational and excludes it from enterprise packs', () => {
    const result = markStealStrategyUngrounded({
      summary: 'A commonly cited strategy analogy.',
      historicalCompetitiveMoves: [],
      modernEntrantPlaybook: [],
      guardrails: 'Verify independently.',
    });
    expect(result.grounding.status).toBe('ungrounded-educational');
    expect(result.grounding.enterpriseEligible).toBe(false);
    expect(result.grounding.sources).toEqual([]);
    expect(result.grounding.limitations.join(' ')).toMatch(/No live retrieval/i);
  });
});

