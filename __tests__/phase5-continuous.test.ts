import { describe, expect, it } from 'vitest';
import {
  categorizeEventText,
  severityFromCategory,
} from '@/lib/monitoring/severity';
import { buildAlertDedupeKey, isoWeekKey } from '@/lib/monitoring/dedupe';
import { buildClusterKey, clusterCompetitiveEvents } from '@/lib/monitoring/cluster-events';
import {
  buildTrendSummaries,
  trendHeadlineFromHistogram,
} from '@/lib/monitoring/trend-summary';
import {
  applyOutcomeConfidence,
  confidenceFromRecLevel,
} from '@/lib/decision-policy';
import { computeHealthStatus, nextMondaySweepUtc } from '@/lib/monitoring/health';
import { featureFlags } from '@/lib/feature-flags';
import { diffSweepOutputs } from '@/lib/monitoring/diff-sweep';
import type { OrchestratorOutput } from '@/lib/agents/types';

describe('deterministic severity', () => {
  it('maps categories to severity matrix', () => {
    expect(severityFromCategory('pricing')).toBe('high');
    expect(severityFromCategory('launch')).toBe('high');
    expect(severityFromCategory('funding')).toBe('high');
    expect(severityFromCategory('feature')).toBe('medium');
    expect(severityFromCategory('hiring')).toBe('medium');
    expect(severityFromCategory('docs')).toBe('low');
    expect(severityFromCategory('sentiment')).toBe('low');
  });

  it('categorizes free text', () => {
    expect(categorizeEventText('Major pricing change')).toBe('pricing');
    expect(categorizeEventText('Official product launch')).toBe('launch');
    expect(categorizeEventText('New Reddit thread')).toBe('sentiment');
    expect(categorizeEventText('Minor documentation update')).toBe('docs');
  });
});

describe('alert dedupe', () => {
  it('is stable for same competitor/product/title/week', () => {
    const a = buildAlertDedupeKey({
      competitor: 'Clay',
      product: 'Vector',
      title: 'Pricing shift',
      week: '2026-W12',
    });
    const b = buildAlertDedupeKey({
      competitor: 'Clay',
      product: 'Vector',
      title: 'Pricing  shift',
      week: '2026-W12',
    });
    expect(a).toBe(b);
    expect(isoWeekKey(new Date('2026-03-16T12:00:00Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('timeline clustering', () => {
  it('groups related events by week/competitor/family', () => {
    const key = buildClusterKey({
      competitor: 'Clay',
      category: 'feature',
      date: '2026-03-16',
    });
    const clusters = clusterCompetitiveEvents([
      {
        id: '1',
        competitor: 'Clay',
        title: 'AI feature',
        summary: '',
        category: 'feature',
        event_date: '2026-03-16',
        cluster_key: key,
      },
      {
        id: '2',
        competitor: 'Clay',
        title: 'Launch',
        summary: '',
        category: 'launch',
        event_date: '2026-03-17',
        cluster_key: key,
      },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].events).toHaveLength(2);
  });
});

describe('trend summary', () => {
  it('builds executive headline from histogram', () => {
    expect(trendHeadlineFromHistogram({ launch: 2, feature: 1, pricing: 1 })).toBe('Aggressive expansion');
    expect(trendHeadlineFromHistogram({ pricing: 2 })).toBe('Monetization push');
    const summaries = buildTrendSummaries([
      { competitor: 'A', category: 'pricing', title: 'p1' },
      { competitor: 'A', category: 'feature', title: 'f1' },
      { competitor: 'A', category: 'launch', title: 'l1' },
    ]);
    expect(summaries[0].overallTrend).toBe('Aggressive expansion');
    expect(summaries[0].bullets.length).toBeGreaterThan(0);
  });
});

describe('decision confidence', () => {
  it('maps rec confidence and evolves with outcomes', () => {
    expect(confidenceFromRecLevel('high')).toBe(0.85);
    expect(applyOutcomeConfidence(0.65, 'validated')).toBeGreaterThan(0.65);
    expect(applyOutcomeConfidence(0.65, 'invalidated')).toBeLessThan(0.65);
  });
});

describe('monitoring health', () => {
  it('computes status rules', () => {
    expect(computeHealthStatus({ enabled: false, lastSweepAt: null })).toBe('paused');
    expect(computeHealthStatus({ enabled: true, lastSweepAt: null })).toBe('stale');
    expect(computeHealthStatus({
      enabled: true,
      lastSweepAt: new Date().toISOString(),
      lastSucceeded: false,
    })).toBe('degraded');
    expect(computeHealthStatus({
      enabled: true,
      lastSweepAt: new Date().toISOString(),
      lastSucceeded: true,
    })).toBe('healthy');
    expect(nextMondaySweepUtc(new Date('2026-03-16T10:00:00Z')).getUTCDay()).toBe(1);
  });
});

describe('diff sweep', () => {
  it('detects new recommendation titles', () => {
    const prev = {
      query: 'q',
      product: 'P',
      competitor: 'C',
      agentRuns: [],
      outputs: [],
      synthesizedAnswer: 'old',
      topRecommendations: [{ title: 'Keep', rationale: '', evidence: [], confidence: 'medium', priority: 'short-term' }],
      suggestedFollowUps: [],
      totalConfidence: 'medium',
      generatedAt: new Date().toISOString(),
    } as OrchestratorOutput;
    const next = {
      ...prev,
      synthesizedAnswer: 'new answer',
      topRecommendations: [
        { title: 'Keep', rationale: '', evidence: [], confidence: 'medium', priority: 'short-term' },
        { title: 'Raise pricing', rationale: '', evidence: [], confidence: 'high', priority: 'immediate' },
      ],
    } as OrchestratorOutput;
    const diff = diffSweepOutputs(prev, next);
    expect(diff.material).toBe(true);
    expect(diff.changedRecTitles).toContain('Raise pricing');
    expect(diff.severity).toBe(severityFromCategory(diff.category));
  });
});

describe('phase 5 flags default configuration', () => {
  it('checks active and default platform flags', () => {
    expect(featureFlags.auditLogs).toBe(false);
    expect(featureFlags.watchlists).toBe(false);
    expect(featureFlags.alerts).toBe(false);
    expect(featureFlags.decisionMemory).toBe(true);
    expect(featureFlags.competitiveTimeline).toBe(false);
    expect(featureFlags.feedbackLearning).toBe(true);
  });
});
