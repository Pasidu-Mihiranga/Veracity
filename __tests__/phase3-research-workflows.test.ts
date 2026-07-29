import { describe, expect, it } from 'vitest';
import { normalizeDomains } from '@/lib/agents/classify';
import { planMission } from '@/lib/agents/mission-planner';
import {
  domainsForMission,
  inferResearchIntent,
  resolveComparedEntities,
} from '@/lib/agents/research-intents';
import {
  buildComparisonContract,
  buildComparisonExecutiveAnswer,
  buildDiligenceExecutiveAnswer,
  buildDueDiligencePack,
  buildInvestigationPlan,
  collectPriorOpenQuestions,
  domainsFromInvestigationQuery,
  planAdaptiveReplan,
  sanitizeDiligenceRecommendations,
} from '@/lib/agents/research-workflows';
import { selectReportTemplate } from '@/lib/agents/report-templates';
import { resolveAgentSet } from '@/lib/agents/adaptive-selection';
import type {
  AgentOutput,
  AgentSource,
  EvidenceCoverageAxis,
  IntelligenceDomain,
} from '@/lib/agents/types';

const source = (title: string, url: string): AgentSource => ({
  title,
  url,
  timestamp: new Date().toISOString(),
  tool: 'serpapi',
});

function output(
  domain: IntelligenceDomain,
  facts: string[],
  sources: AgentSource[],
  confidenceScore = 0.7,
): AgentOutput {
  return {
    agentId: domain,
    domain,
    confidence: confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.45 ? 'medium' : 'low',
    confidenceScore,
    facts,
    interpretation: [],
    sources,
    generatedAt: new Date().toISOString(),
    artifactType: domain === 'pricing' ? 'pricing-table' : 'competitive-matrix',
  };
}

describe('Phase 3 intent classification', () => {
  it.each([
    ['Compare Notion vs Confluence', 'compare'],
    ['Assess acquiring a vendor and produce due diligence', 'dd_acquisition'],
    ['What security and integration risks exist?', 'tech_assessment'],
    ['Monitor pricing changes since last week', 'monitoring'],
    ['What downside and churn risks matter?', 'risk'],
    ['What should we build next?', 'executive_strategy'],
    ['Is this market accelerating?', 'market'],
  ] as const)('maps "%s" to %s', (query, expected) => {
    expect(inferResearchIntent(query)).toBe(expected);
  });

  it('does not pad a narrow classifier result to three domains', () => {
    expect(normalizeDomains(['pricing'])).toEqual(['pricing']);
    expect(
      domainsForMission({
        intent: 'market',
        classifiedDomains: ['pricing'],
        tier: 1,
      }),
    ).toEqual(['pricing']);
    expect(resolveAgentSet({
      uiSelected: [],
      classifierDomains: ['pricing'],
      minAgents: 1,
    }).researchIds).toEqual(['pricing']);
  });

  it('expands acquisition diligence to the full staged evidence set', () => {
    expect(
      domainsForMission({
        intent: 'dd_acquisition',
        classifiedDomains: ['competitive'],
        tier: 3,
      }),
    ).toEqual(expect.arrayContaining([
      'market-trends',
      'competitive',
      'win-loss',
      'pricing',
      'positioning',
      'adjacent',
    ]));
  });

  it('creates intent-specific mission steps', () => {
    const steps = planMission(['competitive', 'pricing', 'win-loss'], 'dd_acquisition');
    expect(steps.map((step) => step.label).join(' ')).toMatch(/business model/i);
    expect(steps.every((step) => step.objective.toLowerCase().includes('diligence'))).toBe(true);
    expect(steps.find((step) => step.agentId === 'win-loss')?.dependsOn).toContain('step-competitive');
  });

  it('selects the diligence report layout for acquisition missions', () => {
    expect(selectReportTemplate('Assess this target', 'dd_acquisition').id).toBe('due_diligence');
  });

  it('extracts more than two entities for a shared comparison contract', () => {
    expect(resolveComparedEntities({
      query: 'Compare Notion, Confluence and Slite for enterprise buyers',
      product: 'Notion',
      competitor: 'Confluence',
    })).toEqual(expect.arrayContaining(['Notion', 'Confluence', 'Slite']));
  });

  it('rejects category phrases returned as comparison entities', () => {
    expect(resolveComparedEntities({
      query: 'Compare Notion and Confluence for enterprise knowledge management buyers',
      product: 'Notion',
      competitor: 'Confluence',
      modelEntities: ['Notion', 'Confluence', 'enterprise knowledge management'],
    })).toEqual(['Notion', 'Confluence']);
  });
});

describe('Phase 3 adaptive investigation', () => {
  it('adds a complementary collector when selected evidence is thin', () => {
    const replan = planAdaptiveReplan({
      outputs: [output('pricing', ['Directional price'], [], 0.3)],
      selectedDomains: ['pricing'],
      availableDomains: ['pricing', 'competitive', 'market-trends'],
      openQuestions: ['Is annual pricing public?'],
      intent: 'compare',
      maxAddedDomains: 2,
    });
    expect(replan.triggered).toBe(true);
    expect(replan.addedDomains).toEqual(expect.arrayContaining(['competitive']));
    expect(replan.deepenDomains).toContain('pricing');
  });

  it('keeps Tier-1-style replans probe-only when collector budget is zero', () => {
    const replan = planAdaptiveReplan({
      outputs: [output('pricing', [], [], 0.2)],
      selectedDomains: ['pricing'],
      availableDomains: ['pricing', 'competitive'],
      openQuestions: [],
      intent: 'market',
      maxAddedDomains: 0,
    });
    expect(replan.triggered).toBe(true);
    expect(replan.addedDomains).toEqual([]);
    expect(replan.deepenDomains).toEqual(['pricing']);
  });

  it('turns prior open questions and coverage gaps into targeted probes', () => {
    const coverage: EvidenceCoverageAxis[] = [
      { id: 'customers', label: 'Customers', score: 0, sourceCount: 0, agentIds: ['win-loss'] },
      { id: 'pricing', label: 'Pricing', score: 0.6, sourceCount: 3, agentIds: ['pricing'] },
    ];
    const plan = buildInvestigationPlan({
      intent: 'dd_acquisition',
      product: 'TargetCo',
      openQuestions: ['What is TargetCo retention?'],
      coverage,
      outputs: [],
      replan: { triggered: true, reasons: [], addedDomains: [], deepenDomains: ['win-loss'] },
    });
    expect(plan.openQuestions).toContain('What is TargetCo retention?');
    expect(plan.proposedNextProbes.some((probe) => probe.question.includes('retention'))).toBe(true);
    expect(plan.targetedFollowUpPlan.some((step) => step.includes('win loss'))).toBe(true);
  });

  it('routes targeted investigation chips back to their named domain', () => {
    expect(domainsFromInvestigationQuery(
      'Run win loss: What is TargetCo retention?',
    )).toEqual(['win-loss']);
  });

  it('restores prior open questions from slim chat history state', () => {
    expect(collectPriorOpenQuestions([{
      role: 'assistant',
      content: 'Initial findings',
      timestamp: new Date().toISOString(),
      investigationOpenQuestions: ['What is audited ARR?'],
    }])).toEqual(['What is audited ARR?']);
  });

  it('fails closed when diligence recommendations invent financial metrics', () => {
    const recommendations = sanitizeDiligenceRecommendations([{
      title: 'Acquire now',
      rationale: 'ARR is $40 million and margins are 35%.',
      evidence: ['ARR reached $40 million'],
      confidence: 'high',
      priority: 'immediate',
    }]);
    expect(JSON.stringify(recommendations)).not.toMatch(/\$40|35%/);
    expect(recommendations.every((recommendation) => recommendation.confidence === 'low')).toBe(true);
  });
});

describe('Phase 3 structured research packs', () => {
  it('builds a six-section diligence pack and leaves financials open', () => {
    const pack = buildDueDiligencePack(
      'TargetCo',
      [output(
        'competitive',
        ['TargetCo sells API management software.'],
        [source('TargetCo product', 'https://target.example/product')],
      )],
      ['What is audited ARR?'],
    );
    expect(pack.sections.map((section) => section.id)).toEqual([
      'identity',
      'business_model',
      'financials_news',
      'people',
      'risk',
      'open_items',
    ]);
    expect(pack.sections.find((section) => section.id === 'financials_news')?.status).not.toBe('verified');
    expect(JSON.stringify(pack)).not.toMatch(/\$\d+[mkb]\b/i);
    expect(buildDiligenceExecutiveAnswer(pack)).toMatch(/Do not make an acquisition decision/i);
  });

  it('uses identical dimensions and entity-specific evidence in comparisons', () => {
    const contract = buildComparisonContract(
      ['Notion', 'Confluence'],
      [
        output(
          'pricing',
          ['Notion offers a published team plan.', 'Confluence offers a published free tier.'],
          [
            source('Notion pricing', 'https://notion.so/pricing'),
            source('Confluence pricing', 'https://atlassian.com/software/confluence/pricing'),
          ],
        ),
      ],
    );
    expect(contract.dimensions).toHaveLength(5);
    expect(contract.dimensions.every((dimension) => dimension.cells.length === 2)).toBe(true);
    const pricing = contract.dimensions.find((dimension) => dimension.id === 'pricing')!;
    expect(pricing.cells.find((cell) => cell.entity === 'Notion')?.evidenceUrls)
      .toContain('https://notion.so/pricing');
    expect(pricing.cells.find((cell) => cell.entity === 'Confluence')?.evidenceUrls)
      .toContain('https://atlassian.com/software/confluence/pricing');
    expect(
      contract.dimensions
        .find((dimension) => dimension.id === 'market')
        ?.cells.every((cell) => cell.confidence === 'unsupported' && cell.evidenceUrls.length === 0),
    ).toBe(true);
    expect(buildComparisonExecutiveAnswer(contract)).toMatch(/partial Notion vs Confluence/i);
    expect(buildComparisonExecutiveAnswer(contract)).toMatch(/pricing|buyer evidence/i);
    expect(buildComparisonExecutiveAnswer(contract)).toMatch(/comparable product peers/i);
    expect(buildComparisonExecutiveAnswer(contract)).toMatch(/official product URLs.*buyer intent/i);
  });
});

