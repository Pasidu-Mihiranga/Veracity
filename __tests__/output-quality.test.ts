import { describe, expect, it } from 'vitest';
import {
  buildEntityTerms,
  filterSourcesByEntityRelevance,
  sourceMatchesEntities,
} from '@/lib/tools/source-relevance';
import {
  applyAbstainToArtifacts,
  applyOutputQualityGate,
  assessOutputQuality,
  sanitizeCategorySignal,
} from '@/lib/agents/output-quality';
import type {
  AgentSource,
  CompetitiveOutput,
  MindMapOutput,
  Recommendation,
} from '@/lib/agents/types';

const src = (title: string, url: string): AgentSource => ({
  title,
  url,
  timestamp: new Date().toISOString(),
  tool: 'serpapi',
});

describe('source-relevance', () => {
  it('builds terms from product and competitor', () => {
    const terms = buildEntityTerms('Lilian', 'Clay');
    expect(terms).toContain('lilian');
    expect(terms).toContain('clay');
  });

  it('ignores placeholder competitor labels', () => {
    const terms = buildEntityTerms('Notion', 'relevant competitors');
    expect(terms).toContain('notion');
    expect(terms).not.toContain('relevant competitors');
  });

  it('matches entity in title and drops unrelated sources', () => {
    const sources = [
      src('Lilian AI SDR platform overview', 'https://example.com/lilian'),
      src('Show HN: A minimal neumorphic CSS library', 'https://news.ycombinator.com/item?id=1'),
      src('Clay Product Roundup 2026', 'https://www.clay.com/blog/roundup'),
    ];
    const terms = buildEntityTerms('Lilian', 'Clay');
    const { kept, dropped, matchRatio } = filterSourcesByEntityRelevance(sources, terms);
    expect(kept.map((s) => s.title)).toEqual([
      'Lilian AI SDR platform overview',
      'Clay Product Roundup 2026',
    ]);
    expect(dropped).toBe(1);
    expect(matchRatio).toBeCloseTo(2 / 3);
  });

  it('detects LinkedIn person pages as matching name tokens', () => {
    expect(
      sourceMatchesEntities(
        src('Lillian Clay - Kelley School of Business', 'https://www.linkedin.com/in/lillian-clay'),
        buildEntityTerms('Lilian'),
      ),
    ).toBe(true);
  });
});

describe('output-quality gate', () => {
  const noisySources: AgentSource[] = [
    src('Lillian Clay - Kelley School of Business', 'https://www.linkedin.com/in/lillian-clay'),
    src('Lilian Clay - Senior Consultation Officer', 'https://www.linkedin.com/in/lilian-clay-2'),
    src('Show HN: neumorphic CSS', 'https://news.ycombinator.com/item?id=2'),
    src('How I learned Python for AI', 'https://medium.com/python'),
  ];

  const recs: Recommendation[] = [
    {
      title: 'Rebrand as Industrial Agent',
      rationale: 'Pivot into aerospace and missile manufacturing.',
      evidence: ['29.9% growth'],
      confidence: 'high',
      priority: 'immediate',
    },
  ];

  it('flags thin / person-homonym evidence and abstains', () => {
    const report = assessOutputQuality({
      product: 'Lilian',
      competitor: 'Clay',
      sources: noisySources,
      answer:
        'Rebrand as an Autonomous Industrial Agent for aerospace while also unifying property acquisition.',
      recommendations: recs,
      agentConfidenceAvg: 0.8,
    });
    expect(report.shouldAbstainFromStrongClaims).toBe(true);
    expect(report.flags).toEqual(
      expect.arrayContaining(['thin_entity_evidence', 'contradictory_strategy_framing']),
    );
    // Person profiles dominate when most "Lilian" hits are LinkedIn /in/ bios
    expect(report.flags).toContain('person_homonym_noise');
  });

  it('softens answer and recommendations when abstaining', () => {
    const guarded = applyOutputQualityGate({
      product: 'Lilian',
      competitor: 'Clay',
      sources: noisySources,
      answer: 'Immediate rebrand to industrial aerospace agent.',
      recommendations: recs,
      followUps: ['What next?'],
      agentConfidenceAvg: 0.85,
    });
    expect(guarded.answer).toMatch(/Heads up:/i);
    expect(guarded.totalConfidence).toBe('low');
    expect(guarded.recommendations[0].confidence).toBe('medium');
    expect(guarded.recommendations[0].priority).toBe('short-term');
    expect(guarded.followUps[0]).toMatch(/official website/i);
  });

  it('keeps strong claims when sources are entity-matched', () => {
    const goodSources = [
      src('Lilian AI SDR raises seed for GTM agents', 'https://techcrunch.com/lilian-ai'),
      src('Clay vs Lilian feature comparison', 'https://www.g2.com/compare/lilian-vs-clay'),
      src('Lilian pricing and seats', 'https://lilian.ai/pricing'),
      src('Clay Sequencer launch', 'https://www.clay.com/blog/sequencer'),
    ];
    const report = assessOutputQuality({
      product: 'Lilian',
      competitor: 'Clay',
      sources: goodSources,
      answer: 'Compete with Clay on intent workflows for B2B SDR teams.',
      recommendations: [
        {
          title: 'Ship intent workflow MVP',
          rationale: 'Clay is commoditizing enrichment.',
          evidence: ['Clay Sequencer launch'],
          confidence: 'high',
          priority: 'immediate',
        },
      ],
      agentConfidenceAvg: 0.75,
    });
    expect(report.shouldAbstainFromStrongClaims).toBe(false);
    expect(report.matchedSourceCount).toBeGreaterThanOrEqual(3);
  });

  it('abstains on entity category mismatch even when the name matches sources', () => {
    const realEstateSources = [
      src('Lilian Real Estate Virginia', 'https://lilianrealty.com'),
      src('Lilian property listings', 'https://lilianrealty.com/listings'),
      src('Contact Lilian Realty', 'https://lilianrealty.com/contact'),
      src('Clay AI SDR overview', 'https://www.clay.com'),
    ];
    const answer =
      "Lilian is not a competitive AI SDR product. Our research shows that the name 'Lilian' is currently associated with a local real estate business in Virginia, not a software company. There is no evidence of an AI SDR platform under this name.";
    const report = assessOutputQuality({
      product: 'Lilian',
      competitor: 'Clay',
      sources: realEstateSources,
      answer,
      recommendations: [
        {
          title: 'Verify the company website',
          rationale: 'Mismatch between the product name and the actual business entity.',
          evidence: ['real estate site'],
          confidence: 'high',
          priority: 'immediate',
        },
      ],
      agentConfidenceAvg: 0.85,
    });
    expect(report.flags).toContain('entity_category_mismatch');
    expect(report.shouldAbstainFromStrongClaims).toBe(true);

    const guarded = applyOutputQualityGate({
      product: 'Lilian',
      competitor: 'Clay',
      sources: realEstateSources,
      answer,
      recommendations: [
        {
          title: 'Verify the company website',
          rationale: 'Mismatch between the product name and the actual business entity.',
          evidence: ['real estate site'],
          confidence: 'high',
          priority: 'immediate',
        },
      ],
      followUps: ['What next?'],
      agentConfidenceAvg: 0.85,
    });
    expect(guarded.totalConfidence).toBe('low');
    expect(guarded.recommendations[0].priority).toBe('short-term');
    expect(guarded.recommendations[0].confidence).toBe('medium');
    expect(guarded.recommendations[0].title).toMatch(/official product URL/i);
    expect(guarded.answer).toMatch(/wrong kind of business/i);
    expect(guarded.followUps[0]).toMatch(/official website/i);
  });

  it('softens high recommendation confidence when agent avg is low', () => {
    const goodSources = [
      src('ChatGPT overview', 'https://openai.com/chatgpt'),
      src('Claude overview', 'https://claude.ai'),
      src('ChatGPT vs Claude comparison', 'https://www.g2.com/compare/chatgpt-vs-claude'),
      src('Claude team pricing', 'https://claude.ai/pricing'),
    ];
    const guarded = applyOutputQualityGate({
      product: 'ChatGPT',
      competitor: 'Claude',
      sources: goodSources,
      answer: 'ChatGPT leads community mindshare; Claude leads enterprise cowork.',
      recommendations: [
        {
          title: 'Use ChatGPT for developer reach',
          rationale: 'HN mindshare is strong.',
          evidence: ['HN'],
          confidence: 'high',
          priority: 'strategic',
        },
      ],
      followUps: ['What next?'],
      agentConfidenceAvg: 0.55,
    });
    expect(guarded.quality.shouldAbstainFromStrongClaims).toBe(false);
    expect(guarded.recommendations[0].confidence).toBe('medium');
    expect(guarded.followUps[0]).toMatch(/buyer|positioning your own product/i);
  });

  it('does not false-flag Notion when LinkedIn company/discussion sources dominate', () => {
    const notionSources = Array.from({ length: 20 }, (_, i) =>
      src(
        `Notion vs Linear discussion ${i}`,
        i % 3 === 0
          ? `https://www.linkedin.com/company/notion-hq/posts/${i}`
          : `https://www.g2.com/products/notion-so/reviews?page=${i}`,
      ),
    );
    // A couple of personal profiles should not dominate
    notionSources.push(
      src('Jane Notion fan', 'https://www.linkedin.com/in/jane-notion-fan'),
      src('Bob Notion user', 'https://www.linkedin.com/in/bob-notion'),
    );
    const report = assessOutputQuality({
      product: 'Notion',
      competitor: 'Linear',
      sources: notionSources,
      answer: 'Notion should get faster for engineering teams.',
      recommendations: [
        {
          title: 'Fix performance first',
          rationale: 'Users complain Notion feels slow.',
          evidence: ['G2 reviews'],
          confidence: 'high',
          priority: 'immediate',
        },
      ],
      agentConfidenceAvg: 0.8,
    });
    expect(report.flags).not.toContain('person_homonym_noise');
    expect(report.shouldAbstainFromStrongClaims).toBe(false);
  });
});

describe('applyAbstainToArtifacts', () => {
  const abstainQuality = {
    evidenceScore: 0.3,
    sourceMatchRatio: 0.2,
    matchedSourceCount: 1,
    totalSourceCount: 4,
    flags: ['thin_entity_evidence', 'person_homonym_noise'],
    shouldAbstainFromStrongClaims: true,
    toolHealth: 0.2,
    entityMatch: 0.2,
    agentAvg: 0.8,
    qualityGate: 0.3,
  };

  it('soft-labels Stage-1 cards and identity-rewrites mind map when abstaining', () => {
    const outputs = applyAbstainToArtifacts(
      [
        {
          agentId: 'market-trends',
          domain: 'market-trends',
          confidence: 'high',
          confidenceScore: 0.9,
          facts: ['AI SDR spend rising'],
          interpretation: ['Market is hot for Lilian'],
          sources: [],
          generatedAt: new Date().toISOString(),
          artifactType: 'trend-chart',
        },
        {
          agentId: 'competitive',
          domain: 'competitive',
          confidence: 'high',
          confidenceScore: 0.88,
          facts: ['Feature gap'],
          interpretation: ['Lilian vs Clay'],
          sources: [],
          generatedAt: new Date().toISOString(),
          artifactType: 'competitive-matrix',
          competitor: 'Clay',
          matrix: [
            {
              feature: 'Enrichment',
              yourProduct: 'strong',
              competitor: 'strong',
              gapDirection: 'advantage',
            },
          ],
          competitorSummary: 'Lilian competes with Clay on enrichment.',
          hiringSignals: ['Lilian hiring AI SDRs in SF'],
          recentMoves: ['Lilian launched sequencer'],
        } as CompetitiveOutput,
        {
          agentId: 'mind-map-synthesis',
          domain: 'market-trends',
          confidence: 'high',
          confidenceScore: 0.85,
          facts: [],
          interpretation: [],
          sources: [],
          generatedAt: new Date().toISOString(),
          artifactType: 'mind-map',
          centralTopic: 'What to build',
          summary: 'Specialize ICP',
          branches: [
            {
              id: 'b1',
              label: 'Specialize ICP',
              detail: 'Ship ICP workflow',
              children: [],
            },
          ],
        } as MindMapOutput,
      ],
      { product: 'Lilian', competitor: 'Clay', quality: abstainQuality },
    );

    const trends = outputs[0];
    expect(trends.contextOnly).toBe(true);
    expect(trends.contextOnlyLabel).toMatch(/category context/i);
    expect(trends.confidence).toBe('low');
    expect(trends.interpretation[0]).toMatch(/^Category context only:/);

    const competitive = outputs[1] as CompetitiveOutput;
    expect(competitive.contextOnly).toBe(true);
    expect(competitive.matrix[0].yourProduct).toBe('none');
    expect(competitive.matrix[0].gapDirection).toBe('parity');
    expect(competitive.hiringSignals[0]).toMatch(/category signal/i);
    expect(competitive.hiringSignals[0]).not.toMatch(/\bLilian\b/i);
    expect(competitive.recentMoves[0]).not.toMatch(/\bLilian\b/i);

    const mind = outputs[2] as MindMapOutput;
    expect(mind.contextOnly).toBe(true);
    expect(mind.centralTopic).toMatch(/identity/i);
    expect(mind.branches.map((b) => b.label).join(' ')).toMatch(/Confirm official URL/i);
    expect(mind.branches.map((b) => b.label).join(' ')).not.toMatch(/Specialize/i);
  });

  it('hides competitive scorecard noise on entity_category_mismatch', () => {
    const quality = {
      ...abstainQuality,
      flags: ['entity_category_mismatch'],
    };
    const outputs = applyAbstainToArtifacts(
      [
        {
          agentId: 'competitive',
          domain: 'competitive',
          confidence: 'high',
          confidenceScore: 0.9,
          facts: ['x'],
          interpretation: ['Lilian vs Apollo'],
          sources: [],
          generatedAt: new Date().toISOString(),
          artifactType: 'competitive-matrix',
          competitor: 'Apollo',
          matrix: [
            {
              feature: 'AI SDR',
              yourProduct: 'strong',
              competitor: 'strong',
              gapDirection: 'advantage',
            },
          ],
          competitorSummary: 'Apollo PE vs Lilian realty',
          hiringSignals: ['Lilian hiring'],
          recentMoves: ['Apollo invested'],
        } as CompetitiveOutput,
        {
          agentId: 'pricing',
          domain: 'pricing',
          confidence: 'high',
          confidenceScore: 0.9,
          facts: ['$99 AI SDR seats'],
          interpretation: ['Premium AI pricing for Lilian'],
          sources: [],
          generatedAt: new Date().toISOString(),
          artifactType: 'pricing-table',
        },
      ],
      { product: 'Lilian', competitor: 'Apollo', quality },
    );
    const competitive = outputs[0] as CompetitiveOutput;
    expect(competitive.matrix).toEqual([]);
    expect(competitive.hiringSignals).toEqual([]);
    expect(competitive.recentMoves).toEqual([]);
    expect(competitive.competitorSummary).toMatch(/Skip competitive scoring/i);

    const pricing = outputs[1];
    expect(pricing.contextOnly).toBe(true);
    expect(pricing.facts[0]).toMatch(/unresolved/i);
    expect(pricing.interpretation[0]).not.toMatch(/Premium AI pricing/i);
  });

  it('leaves artifacts unchanged when not abstaining', () => {
    const passQuality = { ...abstainQuality, shouldAbstainFromStrongClaims: false };
    const input = [
      {
        agentId: 'pricing',
        domain: 'pricing' as const,
        confidence: 'high' as const,
        confidenceScore: 0.9,
        facts: ['$99'],
        interpretation: ['Premium'],
        sources: [],
        generatedAt: new Date().toISOString(),
        artifactType: 'pricing-table' as const,
      },
    ];
    const out = applyAbstainToArtifacts(input, {
      product: 'Notion',
      quality: passQuality,
    });
    expect(out[0].contextOnly).toBeUndefined();
    expect(out[0].confidence).toBe('high');
  });

  it('sanitizeCategorySignal strips entity names', () => {
    expect(sanitizeCategorySignal('Lilian hiring AI SDRs', 'Lilian', 'Clay')).toMatch(
      /Category signal.*this category hiring/i,
    );
  });
});
