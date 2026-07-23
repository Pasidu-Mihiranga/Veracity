import { describe, expect, it } from 'vitest';
import { bindEvidenceToSources } from '@/lib/agents/bind-evidence';
import { computeEvidenceCoverage } from '@/lib/agents/evidence-coverage';
import { assessOutputQuality } from '@/lib/agents/output-quality';
import { getSourceTrustTier } from '@/lib/tools/source-validator';
import type { AgentOutput, AgentRun, AgentSource, Recommendation } from '@/lib/agents/types';

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
