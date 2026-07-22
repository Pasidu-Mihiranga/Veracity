import { describe, expect, it } from 'vitest';
import { buildExecutiveReport, reportFilename } from '@/lib/export/build-report-data';
import type { ChatMessage } from '@/types/chat-ui';
import type { CompetitiveOutput, MindMapOutput, OrchestratorOutput } from '@/lib/agents/types';

function baseMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  const competitive: CompetitiveOutput = {
    agentId: 'competitive',
    domain: 'competitive',
    confidence: 'high',
    confidenceScore: 0.9,
    facts: ['Fact A'],
    interpretation: ['Competitor gaining on onboarding'],
    sources: [
      {
        url: 'https://example.com/comp',
        title: 'Competitor site',
        timestamp: '2026-07-01',
        tool: 'serpapi',
      },
    ],
    generatedAt: '2026-07-21T12:00:00.000Z',
    artifactType: 'competitive-matrix',
    competitor: 'Acme',
    matrix: [
      {
        feature: 'SSO',
        yourProduct: 'strong',
        competitor: 'medium',
        gapDirection: 'advantage',
      },
    ],
    competitorSummary: 'Acme is strong on SMB.',
    hiringSignals: [],
    recentMoves: [],
  };

  const mindMap: MindMapOutput = {
    agentId: 'orchestrator',
    domain: 'market-trends',
    confidence: 'medium',
    confidenceScore: 0.6,
    facts: [],
    interpretation: [],
    sources: [],
    generatedAt: '2026-07-21T12:00:00.000Z',
    artifactType: 'mind-map',
    centralTopic: 'Growth',
    summary: 'Focus on enterprise wedge',
    branches: [
      {
        id: '1',
        label: 'Positioning',
        children: [{ id: '1a', label: 'ICP clarity' }],
      },
    ],
  };

  const orchestratorOutput: OrchestratorOutput = {
    query: 'How do we beat Acme?',
    product: 'Veracity',
    competitor: 'Acme',
    agentRuns: [],
    outputs: [competitive, mindMap],
    synthesizedAnswer: 'Lean into SSO and ICP clarity.',
    topRecommendations: [
      {
        title: 'Ship SSO proof',
        rationale: 'Buyers cite SSO as a switching trigger.',
        evidence: [],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    suggestedFollowUps: [],
    totalConfidence: 'high',
    generatedAt: '2026-07-21T12:00:00.000Z',
  };

  return {
    id: 1,
    role: 'assistant',
    content: 'Lean into SSO and ICP clarity.',
    sources: [{ title: 'HN thread', url: 'https://news.ycombinator.com/item?id=1' }],
    recommendations: orchestratorOutput.topRecommendations,
    orchestratorOutput,
    ...overrides,
  };
}

describe('buildExecutiveReport', () => {
  it('maps summary, matrix, mind map, and clickable sources', () => {
    const report = buildExecutiveReport(baseMessage());
    expect(report.product).toBe('Veracity');
    expect(report.summary).toContain('SSO');
    expect(report.matrix).toHaveLength(1);
    expect(report.matrix[0].feature).toBe('SSO');
    expect(report.mindMap?.centralTopic).toBe('Growth');
    expect(report.mindMap?.branches[0].children[0]).toContain('ICP');
    expect(report.sources.some((s) => s.url.includes('example.com'))).toBe(true);
    expect(report.sources.some((s) => s.url.includes('ycombinator'))).toBe(true);
    expect(report.recommendations[0].title).toBe('Ship SSO proof');
  });

  it('builds a stable pdf filename', () => {
    const report = buildExecutiveReport(baseMessage());
    expect(reportFilename(report)).toBe('veracity-executive-report-2026-07-21.pdf');
  });
});
