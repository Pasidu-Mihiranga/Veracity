import { describe, expect, it } from 'vitest';
import {
  categorizeEventText,
  severityForSignal,
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
import {
  computeHealthStatus,
  nextMondaySweepUtc,
  nextScheduledSweepUtc,
} from '@/lib/monitoring/health';
import { featureFlags } from '@/lib/feature-flags';
import { diffSweepOutputs } from '@/lib/monitoring/diff-sweep';
import type { OrchestratorOutput, PricingOutput } from '@/lib/agents/types';
import {
  applyWeeklyAlertBudget,
  extractChangedMonitoringSignals,
} from '@/lib/monitoring/signal-collectors';
import { sendEmailAlert, sendSlackAlert } from '@/lib/monitoring/egress';
import type { AlertEventRow } from '@/lib/alerts';

describe('deterministic severity', () => {
  it('maps categories to severity matrix', () => {
    expect(severityFromCategory('pricing')).toBe('high');
    expect(severityFromCategory('launch')).toBe('high');
    expect(severityFromCategory('funding')).toBe('high');
    expect(severityFromCategory('acquisition')).toBe('high');
    expect(severityFromCategory('security')).toBe('high');
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
    expect(categorizeEventText('Acme acquired RivalCo')).toBe('acquisition');
    expect(categorizeEventText('Jane Doe appointed CEO')).toBe('leadership');
    expect(categorizeEventText('Critical CVE-2026-1234 disclosed')).toBe('security');
    expect(severityForSignal('sentiment', 0.4, 'one thread')).toBe('low');
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
    expect(nextScheduledSweepUtc('daily', new Date('2026-03-16T10:00:00Z')).toISOString())
      .toBe('2026-03-17T09:00:00.000Z');
    expect(nextScheduledSweepUtc('twice_weekly', new Date('2026-03-16T10:00:00Z')).getUTCDay())
      .toBe(4);
    expect(nextScheduledSweepUtc('monthly', new Date('2026-03-16T10:00:00Z')).getUTCDate())
      .toBe(1);
  });
});

describe('structured monitoring diff', () => {
  it('establishes the first sweep as a baseline without emitting alerts', () => {
    const diff = diffSweepOutputs(null, monitoringOutput('Pricing increased from $20 to $25.'));
    expect(diff.material).toBe(false);
    expect(diff.events).toHaveLength(0);
    expect(diff.materialityBasis).toBe('baseline');
  });

  it('does not treat recommendation-title changes as material events', () => {
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
    expect(diff.material).toBe(false);
    expect(diff.changedRecTitles).toContain('Raise pricing');
    expect(diff.materialityBasis).toBe('none');
  });

  it('emits a grounded pricing event while suppressing a copy-only tweak', () => {
    const previous = monitoringOutput('Enterprise pricing is $20 per user per month.');
    const next = monitoringOutput('Enterprise pricing increased from $20 to $25 per user per month.');
    const pricingDiff = diffSweepOutputs(previous, next);
    expect(pricingDiff.material).toBe(true);
    expect(pricingDiff.category).toBe('pricing');
    expect(pricingDiff.events[0].sourceUrls).toEqual(['https://example.com/update']);

    const copyOnly = monitoringOutput('Updated documentation wording on the homepage.');
    const copyDiff = diffSweepOutputs(previous, copyOnly);
    expect(copyDiff.material).toBe(false);
    expect(copyDiff.suppressedSignals.some((signal) => signal.category === 'docs')).toBe(true);
  });

  it('classifies at least 70% of price, funding, and leadership fixtures', () => {
    const fixtures = [
      ['Pricing increased from $20 to $25 per user', 'pricing'],
      ['Introduced a new enterprise tier at $99 per month', 'pricing'],
      ['The free tier was removed from current packaging', 'pricing'],
      ['Raised a $40 million Series B financing round', 'funding'],
      ['Closed a €12m seed round led by Alpha Ventures', 'funding'],
      ['Announced Series C funding for international expansion', 'funding'],
      ['Jane Doe was appointed CEO', 'leadership'],
      ['The CTO resigned and steps down immediately', 'leadership'],
      ['Alex Smith joins as Chief Revenue Officer', 'leadership'],
      ['Founder moved into an executive chair role', 'leadership'],
    ] as const;
    const correct = fixtures.filter(([fact, expected]) => {
      const changed = extractChangedMonitoringSignals(null, monitoringOutput(fact));
      return changed.material.some((event) => event.category === expected);
    });
    expect(correct.length / fixtures.length).toBeGreaterThanOrEqual(0.7);
  });

  it('separates acquisitions from funding and detects security events', () => {
    expect(extractChangedMonitoringSignals(
      null,
      monitoringOutput('Acme acquired RivalCo in an all-cash acquisition.'),
    ).material[0]?.category).toBe('acquisition');
    expect(extractChangedMonitoringSignals(
      null,
      monitoringOutput('A critical CVE-2026-1234 security vulnerability was disclosed.'),
    ).material[0]?.category).toBe('security');
  });

  it('suppresses wording tweaks, isolated sentiment, and ungrounded facts', () => {
    const docs = extractChangedMonitoringSignals(
      null,
      monitoringOutput('Updated documentation wording on the homepage.'),
    );
    expect(docs.material).toHaveLength(0);
    expect(docs.suppressed.length).toBeGreaterThan(0);
    const sentiment = extractChangedMonitoringSignals(
      null,
      monitoringOutput('A new Reddit thread mentioned the product.'),
    );
    expect(sentiment.material).toHaveLength(0);
    const ungrounded = extractChangedMonitoringSignals(
      null,
      monitoringOutput('Pricing increased from $20 to $30.', false),
    );
    expect(ungrounded.material).toHaveLength(0);
  });

  it('does not re-alert when pricing wording changes but values do not', () => {
    const previous = monitoringOutput('Enterprise pricing is $25 per user per month.');
    const next = monitoringOutput('The enterprise plan costs $25 per user each month.');
    expect(extractChangedMonitoringSignals(previous, next).material).toHaveLength(0);
  });

  it('collects price changes from typed pricing artifacts even without facts', () => {
    const previous = pricingArtifactOutput('$20 / month');
    const next = pricingArtifactOutput('$30 / month');
    const changed = extractChangedMonitoringSignals(previous, next);
    expect(changed.material.some((event) =>
      event.category === 'pricing' && event.origin === 'structured',
    )).toBe(true);
  });

  it('enforces the agreed weekly alert budget in a soak fixture', () => {
    const signals = Array.from({ length: 100 }, (_, index) =>
      extractChangedMonitoringSignals(
        null,
        monitoringOutput(`Pricing increased from $${index + 10} to $${index + 11}.`),
      ).material[0],
    ).filter(Boolean);
    const budgeted = applyWeeklyAlertBudget(signals, 3, 12);
    expect(budgeted.deliver).toHaveLength(9);
    expect(budgeted.suppressedByBudget).toHaveLength(91);
  });
});

describe('alert egress connectors', () => {
  const alert = {
    id: 'alert-1',
    user_id: 'user-1',
    watchlist_id: null,
    job_id: null,
    product: 'Vector',
    competitor: 'Clay',
    title: 'Clay pricing changed',
    summary: 'Enterprise pricing increased.',
    severity: 'high',
    diff: {},
    dedupe_key: 'key',
    read_at: null,
    created_at: new Date().toISOString(),
  } satisfies AlertEventRow;

  it('sends configured Slack and email payloads', async () => {
    const previousSlack = process.env.SLACK_ALERT_WEBHOOK_URL;
    const previousResend = process.env.RESEND_API_KEY;
    const previousFrom = process.env.ALERT_FROM_EMAIL;
    process.env.SLACK_ALERT_WEBHOOK_URL = 'https://hooks.slack.test/alert';
    process.env.RESEND_API_KEY = 'resend-test';
    process.env.ALERT_FROM_EMAIL = 'alerts@example.com';
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      expect((await sendSlackAlert(alert, fetchImpl)).status).toBe('sent');
      expect((await sendEmailAlert(alert, 'owner@example.com', fetchImpl)).status).toBe('sent');
      expect(calls).toEqual([
        'https://hooks.slack.test/alert',
        'https://api.resend.com/emails',
      ]);
    } finally {
      restoreEnv('SLACK_ALERT_WEBHOOK_URL', previousSlack);
      restoreEnv('RESEND_API_KEY', previousResend);
      restoreEnv('ALERT_FROM_EMAIL', previousFrom);
    }
  });
});

describe('phase 5 flags default configuration', () => {
  it('checks active and default platform flags', () => {
    expect(featureFlags.auditLogs).toBe(false);
    expect(featureFlags.watchlists).toBe(true);
    expect(featureFlags.alerts).toBe(true);
    expect(featureFlags.decisionMemory).toBe(true);
    expect(featureFlags.competitiveTimeline).toBe(true);
    expect(featureFlags.feedbackLearning).toBe(true);
  });
});

function monitoringOutput(fact: string, grounded = true): OrchestratorOutput {
  const source = grounded
    ? [{
        title: 'Official company update',
        url: 'https://example.com/update',
        timestamp: '2026-07-29T00:00:00.000Z',
        tool: 'firecrawl' as const,
      }]
    : [];
  return {
    query: 'What changed?',
    product: 'Vector',
    competitor: 'Clay',
    agentRuns: [],
    outputs: [{
      agentId: 'competitive',
      domain: 'competitive',
      confidence: 'high',
      confidenceScore: 0.9,
      facts: [fact],
      interpretation: [],
      sources: source,
      generatedAt: '2026-07-29T00:00:00.000Z',
      artifactType: 'competitive-matrix',
    }],
    synthesizedAnswer: fact,
    topRecommendations: [],
    suggestedFollowUps: [],
    totalConfidence: grounded ? 'high' : 'low',
    generatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function pricingArtifactOutput(price: string): OrchestratorOutput {
  const output = monitoringOutput('');
  output.outputs = [{
    agentId: 'pricing',
    domain: 'pricing',
    confidence: 'high',
    confidenceScore: 0.9,
    facts: [],
    interpretation: [],
    sources: [{
      title: 'Official pricing',
      url: 'https://example.com/pricing',
      timestamp: '2026-07-29T00:00:00.000Z',
      tool: 'firecrawl',
    }],
    generatedAt: '2026-07-29T00:00:00.000Z',
    artifactType: 'pricing-table',
    competitorPricing: [{
      tierName: 'Enterprise',
      price,
      features: [],
      targetSegment: 'Enterprise',
    }],
    willingnessToPay: 'premium',
    pricingSignals: [],
    recommendation: '',
  } as PricingOutput];
  return output;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
