import { describe, expect, it } from 'vitest';
import {
  buildEntityTerms,
  filterSourcesByEntityRelevance,
  sourceMatchesEntities,
} from '@/lib/tools/source-relevance';
import {
  applyOutputQualityGate,
  assessOutputQuality,
} from '@/lib/agents/output-quality';
import type { AgentSource, Recommendation } from '@/lib/agents/types';

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
