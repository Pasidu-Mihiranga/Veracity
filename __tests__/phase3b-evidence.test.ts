import { describe, expect, it } from 'vitest';
import { bindEvidenceToSources } from '@/lib/agents/bind-evidence';
import {
  computeEvidenceCoverage,
  describeEvidenceCoverageGaps,
} from '@/lib/agents/evidence-coverage';
import {
  applyEntitySourceFilterToOutputs,
  assessOutputQuality,
} from '@/lib/agents/output-quality';
import {
  filterAndRankSources,
  getSourceTrustTier,
} from '@/lib/tools/source-validator';
import type { AgentOutput, AgentRun, AgentSource, Recommendation } from '@/lib/agents/types';
import { isUsableScrapePage } from '@/lib/agents/entity-url';
import type { ScrapedPage, ToolResult } from '@/lib/tools/types';

const src = (title: string, url: string): AgentSource => ({
  title,
  url,
  timestamp: new Date().toISOString(),
  tool: 'serpapi',
});

describe('bindEvidenceToSources', () => {
  it('attaches matching sourceUrls to recommendations', () => {
    const sources = [
      src('Lilian AI SDR platform overview', 'https://example.com/lilian'),
      src('Clay Sequencer launch', 'https://www.clay.com/blog/sequencer'),
      src('Unrelated CSS library', 'https://news.ycombinator.com/item?id=1'),
    ];
    const recs: Recommendation[] = [
      {
        title: 'Compete on sequencer workflows',
        rationale: 'Clay Sequencer launch shows packaging pressure.',
        evidence: ['Clay Sequencer launch'],
        confidence: 'high',
        priority: 'immediate',
      },
    ];
    const bound = bindEvidenceToSources(recs, sources, 'Lilian', 'Clay');
    expect(bound[0].sourceUrls?.length).toBeGreaterThan(0);
    expect(bound[0].sourceUrls?.[0]).toContain('clay.com');
    expect(bound[0].evidenceStatus).toBe('supported');
    expect(bound[0].evidenceBindings?.[0]?.support).toBe('supported');
  });

  it('leaves unsupported claims unbound instead of attaching fallback URLs', () => {
    const sources = [
      src('Unrelated CSS library', 'https://news.ycombinator.com/item?id=1'),
      src('Generic startup article', 'https://example.com/startups'),
    ];
    const recs: Recommendation[] = [{
      title: 'Raise enterprise prices',
      rationale: 'Pricing power is strong.',
      evidence: ['Buyers accept a 40% annual price increase'],
      confidence: 'high',
      priority: 'immediate',
    }];
    const [bound] = bindEvidenceToSources(recs, sources, 'Lilian', 'Clay');
    expect(bound.sourceUrls).toEqual([]);
    expect(bound.evidenceStatus).toBe('unsupported');
    expect(bound.evidenceBindings?.[0]).toMatchObject({
      support: 'unsupported',
      sourceUrls: [],
    });
    expect(bound.confidence).toBe('low');
    expect(bound.priority).toBe('short-term');
  });

  it('allows only weak entity support from an explicitly known official domain', () => {
    const recs: Recommendation[] = [{
      title: 'Evaluate Acme',
      rationale: 'Acme may fit.',
      evidence: [
        'Acme sells enterprise workflow software',
        'Hacker News engagement shows high interest in Acme',
      ],
      confidence: 'high',
      priority: 'immediate',
    }];
    const [bound] = bindEvidenceToSources(
      recs,
      [src('Acme homepage', 'https://acme.example')],
      'Acme',
      undefined,
      3,
      { productUrl: 'https://acme.example' },
    );
    expect(bound.evidenceStatus).toBe('weakly-supported');
    expect(bound.sourceUrls).toEqual(['https://acme.example']);
    expect(bound.confidence).toBe('medium');
    expect(bound.evidenceBindings?.[1]).toMatchObject({
      support: 'unsupported',
      sourceUrls: [],
    });
  });
});

describe('computeEvidenceCoverage', () => {
  it('scores five axes and zeros missing agents', () => {
    const outputs: AgentOutput[] = [
      {
        agentId: 'market-trends',
        domain: 'market-trends',
        confidence: 'high',
        confidenceScore: 0.8,
        facts: [],
        interpretation: [],
        sources: [src('Market growing', 'https://techcrunch.com/ai-market')],
        generatedAt: new Date().toISOString(),
        artifactType: 'trend-chart',
      },
      {
        agentId: 'pricing',
        domain: 'pricing',
        confidence: 'medium',
        confidenceScore: 0.55,
        facts: [],
        interpretation: [],
        sources: [
          src('Lilian pricing', 'https://lilian.ai/pricing'),
          src('Clay pricing', 'https://www.clay.com/pricing'),
        ],
        generatedAt: new Date().toISOString(),
        artifactType: 'pricing-table',
      },
    ];
    const runs: AgentRun[] = [
      { agentId: 'market-trends', name: 'Market', status: 'completed' },
      { agentId: 'pricing', name: 'Pricing', status: 'completed' },
      { agentId: 'competitive', name: 'Competitive', status: 'failed' },
    ];
    const coverage = computeEvidenceCoverage(outputs, runs, 'Lilian', 'Clay');
    expect(coverage).toHaveLength(5);
    expect(coverage.map((c) => c.id)).toEqual([
      'market',
      'competition',
      'customers',
      'technology',
      'pricing',
    ]);
    expect(coverage.find((c) => c.id === 'market')!.score).toBeGreaterThan(0);
    expect(coverage.find((c) => c.id === 'competition')!.score).toBe(0);
    expect(coverage.find((c) => c.id === 'pricing')!.sourceCount).toBe(2);
    expect(describeEvidenceCoverageGaps(coverage)).toEqual(
      expect.arrayContaining([
        'Competition evidence is missing (0 sources).',
        'Customers evidence is missing (0 sources).',
      ]),
    );
  });
});

describe('getSourceTrustTier', () => {
  it('classifies T1 / T2 / T3', () => {
    expect(getSourceTrustTier('https://techcrunch.com/foo')).toBe('T1');
    expect(getSourceTrustTier('https://news.ycombinator.com/item?id=1')).toBe('T2');
    expect(getSourceTrustTier('https://random-blog.example/post')).toBe('T3');
    expect(
      getSourceTrustTier('https://lilian.ai/pricing', {
        productDomains: ['lilian.ai'],
      }),
    ).toBe('T2');
  });

  it('ranks known official domains above trusted and community noise', () => {
    const ranked = filterAndRankSources(
      [
        src('Reddit discussion about Acme', 'https://reddit.com/r/saas/comments/1'),
        src('Acme official documentation', 'https://docs.acme.example/security'),
        src('Acme funding story', 'https://techcrunch.com/acme'),
      ],
      10,
      { productUrl: 'https://acme.example' },
    );
    expect(ranked[0].url).toContain('acme.example');
  });
});

describe('entity source filtering', () => {
  it('rejects personal profiles and keeps a known official domain', () => {
    const output: AgentOutput = {
      agentId: 'competitive',
      domain: 'competitive',
      confidence: 'medium',
      confidenceScore: 0.6,
      facts: [],
      interpretation: [],
      sources: [
        src('Acme founder MBA profile', 'https://linkedin.com/in/acme-founder'),
        src('Developer documentation', 'https://docs.acme.example/product'),
      ],
      generatedAt: new Date().toISOString(),
      artifactType: 'competitive-matrix',
    };
    const filtered = applyEntitySourceFilterToOutputs([output], 'Acme', undefined, {
      productUrl: 'https://acme.example',
    });
    expect(filtered.outputs[0].sources.map((source) => source.url)).toEqual([
      'https://docs.acme.example/product',
    ]);
  });
});

describe('scraped source validation', () => {
  it('rejects long 404 pages instead of citing guessed pricing URLs', () => {
    const page: ToolResult<ScrapedPage> = {
      data: {
        url: 'https://acme.example/pricing',
        title: 'Page not found',
        markdown: '# 404\nThe page you are looking for could not be found. Return to our homepage.',
        excerpt: '404 — page not found',
      },
      source: 'firecrawl',
      timestamp: new Date().toISOString(),
      confidence: 0.8,
      cached: false,
      status: 'ok',
    };
    expect(isUsableScrapePage({ status: 'fulfilled', value: page })).toBe(false);
  });
});

describe('quality breakdown fields', () => {
  it('exposes meter components', () => {
    const report = assessOutputQuality({
      product: 'Lilian',
      competitor: 'Clay',
      sources: [
        src('Lilian AI SDR', 'https://techcrunch.com/lilian'),
        src('Clay vs Lilian', 'https://www.g2.com/compare'),
        src('Lilian pricing', 'https://lilian.ai/pricing'),
      ],
      answer: 'Compete on workflows.',
      recommendations: [
        {
          title: 'Ship MVP',
          rationale: 'Demand signal',
          evidence: ['Lilian AI SDR'],
          confidence: 'high',
          priority: 'immediate',
        },
      ],
      agentConfidenceAvg: 0.7,
    });
    expect(report.toolHealth).toBeGreaterThan(0);
    expect(report.entityMatch).toBeGreaterThan(0);
    expect(report.agentAvg).toBeCloseTo(0.7);
    expect(report.qualityGate).toBeGreaterThan(0);
  });
});
