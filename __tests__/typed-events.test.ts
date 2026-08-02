/**
 * Typed market events.
 *
 * Metric diffing produced one undifferentiated "pricing changed" and was blind
 * to every change involving no number — a tier renamed, a plan sunset, a
 * feature moved behind Enterprise. These tests hold the distinctions that
 * inference could not make.
 */

import { describe, it, expect } from 'vitest';
import {
  pricingEvents,
  releaseEvents,
  changelogEvents,
  type TypedEventInput,
} from '@/lib/intelligence/typed-events';
import type { ExtractedPrice } from '@/lib/intelligence/connectors/pricing-extractor';
import type { GitHubRelease } from '@/lib/intelligence/connectors/github-releases';
import type { FeedEntry } from '@/lib/intelligence/connectors/changelog-rss';

const input: TypedEventInput = {
  entityId: 'ent-1',
  entityLabel: 'Lilian',
  sourceTrust: 'official',
  isTracked: true,
  decisionFocus: 'pricing',
};

function price(over: Partial<ExtractedPrice> = {}): ExtractedPrice {
  return {
    planName: 'Pro',
    amount: 49,
    currency: 'USD',
    interval: 'month',
    excerpt: 'Pro is $49 per month.',
    offset: 0,
    ...over,
  };
}

describe('pricing events', () => {
  it('emits nothing on a first reading', () => {
    // No "before" to have moved from. Treating a baseline as a change fires a
    // burst of false events the day a project is created.
    expect(pricingEvents(null, [price()], input)).toEqual([]);
  });

  it('emits nothing when nothing moved', () => {
    expect(pricingEvents([price()], [price()], input)).toEqual([]);
  });

  it('reports a price move with its magnitude', () => {
    const events = pricingEvents([price({ amount: 49 })], [price({ amount: 59 })], input);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('pricing_changed');
    expect(events[0].beforeValue).toContain('49');
    expect(events[0].afterValue).toContain('59');
    // ~20% on a tracked competitor's pricing, with pricing as the decision
    // focus, should clear the alert threshold.
    expect(events[0].materiality).toBeGreaterThanOrEqual(0.5);
  });

  it('reports a new tier as packaging, not a price move', () => {
    // A new plan changes the shape of the offer, which is often a bigger signal
    // than a number moving.
    const events = pricingEvents(
      [price({ planName: 'Pro' })],
      [price({ planName: 'Pro' }), price({ planName: 'Team', amount: 99 })],
      input,
    );
    expect(events).toHaveLength(1);
    expect(events[0].beforeValue).toBeNull();
    expect(events[0].afterValue).toContain('Team');
  });

  it('reports a plan that disappeared — which metric diffing could never see', () => {
    // Sunsetting a tier involves no number changing at all.
    const events = pricingEvents(
      [price({ planName: 'Pro' }), price({ planName: 'Legacy', amount: 19 })],
      [price({ planName: 'Pro' })],
      input,
    );
    expect(events).toHaveLength(1);
    expect(events[0].beforeValue).toContain('Legacy');
    expect(events[0].afterValue).toBe('no longer listed');
  });

  it('treats a currency change as a repricing even at the same number', () => {
    const events = pricingEvents(
      [price({ currency: 'USD' })],
      [price({ currency: 'EUR' })],
      input,
    );
    expect(events).toHaveLength(1);
    expect(events[0].beforeValue).toContain('USD');
    expect(events[0].afterValue).toContain('EUR');
    // Not compared as a numeric move, because across currencies that is
    // meaningless.
    expect(events[0].materialityReason).not.toContain('%');
  });

  it('keeps a plan renamed at the same price distinct from a price move', () => {
    const events = pricingEvents(
      [price({ planName: 'Starter' })],
      [price({ planName: 'Basic' })],
      input,
    );
    // One disappeared, one appeared — two events, correctly, rather than one
    // silent "no change" because the amount is identical.
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.afterValue === 'no longer listed')).toBe(true);
    expect(events.some((e) => e.afterValue?.includes('Basic'))).toBe(true);
  });

  it('does not divide by a zero baseline', () => {
    const events = pricingEvents([price({ amount: 0 })], [price({ amount: 29 })], input);
    expect(events).toHaveLength(1);
    expect(Number.isFinite(events[0].materiality)).toBe(true);
  });

  it('gives the same change the same dedupe key across runs', () => {
    const a = pricingEvents([price({ amount: 49 })], [price({ amount: 59 })], input);
    const b = pricingEvents([price({ amount: 49 })], [price({ amount: 59 })], input);
    expect(a[0].dedupeKey).toBe(b[0].dedupeKey);
  });
});

describe('release events', () => {
  const release = (tag: string, publishedAt: string): GitHubRelease => ({
    tag, name: `Version ${tag}`, publishedAt, url: 'https://example.com', isPrerelease: false,
  });

  it('emits only releases not seen before', () => {
    const events = releaseEvents(
      new Set(['v1.0']),
      [release('v1.0', '2026-01-01T00:00:00.000Z'), release('v1.1', '2026-03-01T00:00:00.000Z')],
      input,
    );
    expect(events).toHaveLength(1);
    expect(events[0].afterValue).toContain('v1.1');
    expect(events[0].eventType).toBe('feature_launched');
  });

  it('dates the event when it shipped, not when we noticed', () => {
    // A competitor who shipped three weeks ago shipped three weeks ago.
    const events = releaseEvents(new Set(), [release('v2.0', '2026-03-01T00:00:00.000Z')], input);
    expect(events[0].effectiveAt).toBe('2026-03-01T00:00:00.000Z');
    expect(events[0].observedAt).not.toBe(events[0].effectiveAt);
  });

  it('emits nothing when every release is already known', () => {
    expect(releaseEvents(new Set(['v1.0']), [release('v1.0', '2026-01-01T00:00:00.000Z')], input))
      .toEqual([]);
  });
});

describe('changelog events', () => {
  const entry = (title: string, publishedAt: string | null): FeedEntry => ({
    title, link: 'https://example.com', publishedAt, summary: '',
  });

  it('emits only entries not seen before', () => {
    const events = changelogEvents(
      new Set(['Old post']),
      [entry('Old post', '2026-01-01T00:00:00.000Z'), entry('New post', '2026-03-01T00:00:00.000Z')],
      input,
    );
    expect(events).toHaveLength(1);
    expect(events[0].afterValue).toBe('New post');
  });

  it('skips an undated entry rather than dating it to now', () => {
    // Dating it to today would place an old announcement at the top of the
    // timeline and read as a fresh launch.
    expect(changelogEvents(new Set(), [entry('Undated', null)], input)).toEqual([]);
  });

  it('carries the publication date as the effective date', () => {
    const events = changelogEvents(new Set(), [entry('Shipped', '2026-02-14T00:00:00.000Z')], input);
    expect(events[0].effectiveAt).toBe('2026-02-14T00:00:00.000Z');
  });
});
