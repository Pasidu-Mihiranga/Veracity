import { describe, expect, it } from 'vitest';
import type { OrchestratorOutput } from '@/lib/agents/types';
import { assessAsyncSweepReadiness } from '@/lib/async-sweep-readiness';
import {
  continuousScopeKey,
  normalizeOfficialDomain,
  stableContentHash,
} from '@/lib/continuous-intelligence/entity-utils';
import {
  buildCompetitorProfileState,
  diffCompetitorProfileOutputs,
} from '@/lib/continuous-intelligence/profile-utils';
import { assembleContinuousBoardPack } from '@/lib/continuous-intelligence/board-utils';
import { diffSweepOutputs } from '@/lib/monitoring/diff-sweep';
import { detectProviderFailure } from '@/lib/tools/provider-health';
import { classifyToolOutcome } from '@/lib/logger';

describe('canonical entity registry primitives', () => {
  it('normalizes official domains and stable scope keys', () => {
    expect(normalizeOfficialDomain('https://www.Example.com/pricing')).toBe('example.com');
    expect(normalizeOfficialDomain('not a domain')).toBeNull();
    expect(continuousScopeKey({ userId: 'user-1', workspaceId: 'workspace-1' }))
      .toBe('workspace-1');
    expect(continuousScopeKey({ userId: 'user-1' })).toBe('user:user-1');
  });

  it('hashes equivalent objects deterministically', () => {
    expect(stableContentHash({ b: 2, a: 1 })).toBe(stableContentHash({ a: 1, b: 2 }));
  });
});

describe('profile snapshot monitoring sink', () => {
  it('establishes a baseline and emits a later material profile diff', () => {
    const previous = outputWithFact('Enterprise pricing is $20 per user per month.');
    const next = outputWithFact('Enterprise pricing increased to $35 per user per month.');
    const baseline = diffCompetitorProfileOutputs(null, previous);
    expect(baseline.material).toBe(false);
    expect(baseline.materialEvents).toHaveLength(0);

    const changed = diffCompetitorProfileOutputs(previous, next);
    expect(changed.material).toBe(true);
    expect(changed.changedFields).toContain('pricing');
    expect(changed.materialEvents[0]?.category).toBe('pricing');

    const monitoringDiff = diffSweepOutputs(previous, next);
    expect(monitoringDiff.materialityBasis).toBe('profile-diff');
    expect(monitoringDiff.profileChangedFields).toContain('pricing');
  });

  it('stores structured category fields instead of a narrative blob', () => {
    const profile = buildCompetitorProfileState(
      outputWithFact('Acme appointed Jane Doe as Chief Revenue Officer.'),
    );
    expect(profile.categories.leadership).toHaveLength(1);
    expect(profile.categories.leadership[0]).toHaveProperty('sourceUrls');
    expect(profile).not.toHaveProperty('narrative');
  });
});

describe('timeline-driven board pack', () => {
  it('builds a decision pack from events and decision memory without a chat result', () => {
    const pack = assembleContinuousBoardPack(
      [{
        event_date: '2026-07-28',
        competitor: 'Acme',
        title: 'Enterprise price increased',
        summary: 'Official pricing moved from $20 to $35.',
        category: 'pricing',
        severity: 'high',
        materiality_score: 0.95,
        source_urls: ['https://acme.example/pricing'],
      }],
      [{
        title: 'Validate packaging',
        decision: 'accepted',
        outcome: 'pending',
        reason: 'Pricing move is material',
        confidence: 0.8,
        created_at: '2026-07-28T00:00:00.000Z',
      }],
      30,
      new Date('2026-07-29T00:00:00.000Z'),
    );
    expect(pack.source).toBe('continuous-intelligence');
    expect(pack.operatingMetrics.eventCount).toBe(1);
    expect(pack.operatingMetrics.decisionCount).toBe(1);
    expect(pack.timeline[0]?.sourceUrl).toBe('https://acme.example/pricing');
    expect(pack.decisionMemory[0]).toMatch(/ACCEPTED/);
  });

  it('does not claim market inactivity when the timeline is empty', () => {
    const pack = assembleContinuousBoardPack([], [], 30);
    expect(pack.executiveBrief).toMatch(/not proof that the market was inactive/i);
  });
});

describe('async sweep release gate', () => {
  it('falls back to sync when no explicit transport is configured', () => {
    expect(assessAsyncSweepReadiness({
      featureEnabled: true,
      production: false,
    })).toEqual({
      ready: false,
      mode: 'sync-fallback',
      reasons: ['transport-not-configured'],
    });
  });

  it('requires a signing key in production and accepts explicit local dev mode', () => {
    expect(assessAsyncSweepReadiness({
      featureEnabled: true,
      eventKey: 'event',
      production: true,
    }).reasons).toContain('missing-signing-key');
    expect(assessAsyncSweepReadiness({
      featureEnabled: true,
      inngestDev: true,
    }).mode).toBe('dev');
    expect(assessAsyncSweepReadiness({
      featureEnabled: true,
      eventKey: 'event',
      signingKey: 'signing',
      production: true,
    }).ready).toBe(true);
  });
});

describe('provider-level failure normalization', () => {
  it('treats HTTP-200 quota and nested subscription failures as failed', () => {
    expect(detectProviderFailure({
      success: true,
      data: { status: 'failed', error: 'Subscription upgrade required' },
    })).toMatchObject({ failed: true, message: 'Subscription upgrade required' });
    expect(detectProviderFailure({
      success: false,
      error: 'Quota exhausted',
    }).failed).toBe(true);
    expect(detectProviderFailure({
      success: true,
      data: { status: 'completed' },
    }).failed).toBe(false);
    expect(classifyToolOutcome({
      status: 'failed',
      providerError: 'Free-plan subscription blocks this actor',
    })).toEqual({
      status: 'failed',
      providerError: 'Free-plan subscription blocks this actor',
    });
  });
});

function outputWithFact(fact: string): OrchestratorOutput {
  return {
    query: 'What changed?',
    product: 'Vector',
    competitor: 'Acme',
    agentRuns: [],
    outputs: [{
      agentId: 'competitive',
      domain: 'competitive',
      confidence: 'high',
      confidenceScore: 0.9,
      facts: [fact],
      interpretation: [],
      sources: [{
        title: 'Official Acme update',
        url: 'https://acme.example/update',
        timestamp: '2026-07-29T00:00:00.000Z',
        tool: 'firecrawl',
      }],
      generatedAt: '2026-07-29T00:00:00.000Z',
      artifactType: 'competitive-matrix',
    }],
    synthesizedAnswer: fact,
    topRecommendations: [],
    suggestedFollowUps: [],
    totalConfidence: 'high',
    generatedAt: '2026-07-29T00:00:00.000Z',
  };
}

