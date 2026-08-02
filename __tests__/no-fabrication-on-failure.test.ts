/**
 * Forced-failure contract for the six research agents.
 *
 * Every provider is made to fail, then each agent is run and its output is
 * checked for invented content. This is the MVP's core trust claim: a failed
 * run must look failed. It must not produce a fact, a source URL, a numeric
 * value, or an analyst judgment that no tool ever returned.
 *
 * This suite exists because `market-trends` was the one agent the earlier truth
 * reset missed. On synthesis failure it asserted the fact "Market growth
 * signals collected across web, news, and technical channels.", claimed
 * "Synthesis synthesized from live search and market signals.", reported an
 * 'emerging' category outlook and 0.5 confidence — all with zero data behind
 * them. Parameterising the suite over every agent means the next one that
 * regresses is caught here rather than in front of a user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Force every provider to fail ────────────────────────────────────────────
// Tools reject rather than returning empty results, which is the harsher case:
// the agent must cope with having nothing at all.

// `vi.mock` factories are hoisted above every top-level binding, so each one
// is written out inline — a shared helper is not yet in scope when they run,
// and `importOriginal` would drag in the real module's config/database chain.
//
// Every exported tool function rejects. Rejection is the harsher case than an
// empty result: the agent must cope with having nothing at all.

vi.mock('@/lib/tools/serpapi', () => ({
  searchWeb: () => Promise.reject(new Error('provider unavailable')),
  searchNews: () => Promise.reject(new Error('provider unavailable')),
  searchTrends: () => Promise.reject(new Error('provider unavailable')),
  searchAdsTransparency: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/hn-algolia', () => ({
  searchHN: () => Promise.reject(new Error('provider unavailable')),
  searchHNComments: () => Promise.reject(new Error('provider unavailable')),
  getTechSentiment: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/reddit', () => ({
  searchReddit: () => Promise.reject(new Error('provider unavailable')),
  searchProductReviews: () => Promise.reject(new Error('provider unavailable')),
  searchSubreddits: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/firecrawl', () => ({
  scrapePage: () => Promise.reject(new Error('provider unavailable')),
  scrapeCompetitorPricing: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/apify-twitter', () => ({
  scrapeTwitterX: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/meta-ads', () => ({
  searchMetaAds: () => Promise.reject(new Error('provider unavailable')),
  getAdMessaging: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/linkedin-ads', () => ({
  scrapeLinkedInAds: () => Promise.reject(new Error('provider unavailable')),
  scrapeCompetitorLinkedInAds: () => Promise.reject(new Error('provider unavailable')),
}));
vi.mock('@/lib/tools/patents', () => ({
  searchPatents: () => Promise.reject(new Error('provider unavailable')),
  companyPatents: () => Promise.reject(new Error('provider unavailable')),
}));

vi.mock('@/lib/tools/query-planner', () => ({
  planQueries: () => ({ primary: [], targeted: [], hypothesis: [] }),
}));

// Synthesis fails too — this is the path that used to fabricate. The pure
// helpers stay real because agents call them while building the failure output.
vi.mock('@/lib/agents/gemini', () => ({
  GEMINI_FREE_MODEL_FALLBACKS: [],
  geminiApiKeyCandidates: () => [],
  geminiGenerateContentUrl: (m: string) => `https://example.invalid/${m}`,
  geminiEmbedContentUrl: (m: string) => `https://example.invalid/${m}`,
  geminiAuthHeaders: () => ({}),
  generateHuggingFaceJson: () => Promise.reject(new Error('model unavailable')),
  generateHuggingFaceText: () => Promise.reject(new Error('model unavailable')),
  embedTextWithHuggingFace: () => Promise.resolve(null),
}));
import { marketTrendsAgent } from '@/lib/agents/market-trends';
import { competitiveAgent } from '@/lib/agents/competitive';
import { winLossAgent } from '@/lib/agents/win-loss';
import { pricingAgent } from '@/lib/agents/pricing';
import { positioningAgent } from '@/lib/agents/positioning';
import { adjacentAgent } from '@/lib/agents/adjacent';
import { isSynthesisFailureInterpretation } from '@/lib/agents/synthesis-fallback';
import type { AgentConfig, AgentContext, AgentOutput } from '@/lib/agents/types';

const ctx: AgentContext = {
  query: 'Is Lilian competitive in the AI SDR market right now?',
  product: 'Vector Agents',
  competitor: 'Lilian',
  productUrl: 'https://vectoragents.ai',
  competitorUrl: 'https://lilian.example',
};

const AGENTS: AgentConfig[] = [
  marketTrendsAgent,
  competitiveAgent,
  winLossAgent,
  pricingAgent,
  positioningAgent,
  adjacentAgent,
];

/** Judgment fields that must be absent when nothing was assessed. */
const JUDGMENT_FIELDS = [
  'categoryOutlook',
  'timeHorizon',
  'buyerSentiment',
  'willingnessToPay',
  'overallRisk',
  'timeToImpact',
] as const;

describe.each(AGENTS.map((a) => [a.id, a] as const))(
  '%s: total provider failure',
  (_id, agent) => {
    let output: AgentOutput;

    beforeEach(async () => {
      output = await agent.run(ctx);
    });

    it('returns an output instead of crashing the run', () => {
      // Graceful degradation: one dead agent must not take down the sweep.
      expect(output).toBeTruthy();
      expect(output.agentId).toBe(agent.id);
    });

    it('states that synthesis failed', () => {
      expect(isSynthesisFailureInterpretation(output.interpretation)).toBe(true);
    });

    it('reports low confidence', () => {
      expect(output.confidenceScore).toBeLessThanOrEqual(0.3);
      expect(output.confidence).toBe('low');
    });

    it('invents no facts when no tool returned anything', () => {
      // Facts may only be raw snippets that tools actually returned. Every tool
      // rejected here, so there is nothing legitimate to report.
      expect(output.facts).toEqual([]);
    });

    it('cites no sources', () => {
      expect(output.sources).toEqual([]);
    });

    it('asserts no analyst judgment', () => {
      const record = output as unknown as Record<string, unknown>;
      for (const field of JUDGMENT_FIELDS) {
        if (field in record) {
          expect(record[field], `${agent.id}.${field} must be undefined`).toBeUndefined();
        }
      }
    });

    it('produces no numeric claims', () => {
      // A percentage, count, or currency figure in a failed run has no possible
      // provenance. The only numbers allowed are inside the error text.
      const claimText = output.facts.join(' ');
      expect(claimText).not.toMatch(/\d+(\.\d+)?\s*%/);
      expect(claimText).not.toMatch(/[$€£]\s*\d/);
    });

    it('leaves structured artifact collections empty', () => {
      const record = output as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (Array.isArray(value) && key !== 'interpretation') {
          expect(value, `${agent.id}.${key} must be empty`).toEqual([]);
        }
      }
    });
  },
);
