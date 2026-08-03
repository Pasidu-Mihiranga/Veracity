/**
 * Change detection, deduplication, and materiality.
 *
 * The targets from the research: under 2% duplicate events across adjacent
 * runs, and a digest whose items a user still opens in week five. Both come
 * down to the behaviour tested here.
 */

import { describe, it, expect } from 'vitest';
import {
  detectMetricChange,
  buildDedupeKey,
  scoreMateriality,
  isMaterial,
  materialityToConfidence,
} from '@/lib/intelligence/change-detector';

describe('metric change detection', () => {
  it('detects a real move and quantifies it', () => {
    const change = detectMetricChange({
      metricKey: 'plan_price',
      before: { value: 49, unit: 'USD/month' },
      after: { value: 59, unit: 'USD/month' },
    });
    expect(change).not.toBeNull();
    expect(change!.eventType).toBe('pricing_changed');
    expect(change!.magnitude).toBeCloseTo(10 / 49, 5);
  });

  it('reports no change when the value is the same', () => {
    expect(
      detectMetricChange({
        metricKey: 'plan_price',
        before: { value: 49, unit: 'USD/month' },
        after: { value: 49.0, unit: 'USD/month' },
      }),
    ).toBeNull();
  });

  it('does not treat the first observation as a change', () => {
    // Otherwise creating a project fires a burst of events on day one.
    expect(
      detectMetricChange({
        metricKey: 'plan_price',
        before: null,
        after: { value: 49, unit: 'USD/month' },
      }),
    ).toBeNull();
  });

  it('refuses to compare across units', () => {
    // "$49 -> €49" is not a price change, and calling it one is wrong in both
    // directions.
    expect(
      detectMetricChange({
        metricKey: 'plan_price',
        before: { value: 49, unit: 'USD/month' },
        after: { value: 49, unit: 'EUR/month' },
      }),
    ).toBeNull();
  });

  it('handles a zero baseline without dividing by it', () => {
    const change = detectMetricChange({
      metricKey: 'release_count',
      before: { value: 0, unit: 'releases' },
      after: { value: 3, unit: 'releases' },
    });
    expect(change).not.toBeNull();
    expect(change!.magnitude).toBeNull();
  });

  it('routes metric keys to sensible event types', () => {
    const type = (key: string) =>
      detectMetricChange({
        metricKey: key,
        before: { value: 1, unit: 'u' },
        after: { value: 2, unit: 'u' },
      })!.eventType;

    expect(type('plan_price')).toBe('pricing_changed');
    expect(type('release_count')).toBe('feature_launched');
    expect(type('open_jobs')).toBe('hiring_signal');
    expect(type('Revenues')).toBe('funding_or_filing');
  });
});

describe('deduplication', () => {
  const key = (over = {}) =>
    buildDedupeKey({
      entityId: 'ent-1',
      eventType: 'pricing_changed',
      beforeValue: '$49/month',
      afterValue: '$59/month',
      ...over,
    });

  it('gives the same change the same key across runs', () => {
    // The key must describe the change, not the run. Including a timestamp or
    // snapshot id here is what makes a weekly digest re-report old news.
    expect(key()).toBe(key());
  });

  it('ignores whitespace and casing differences', () => {
    expect(key({ beforeValue: '  $49/MONTH ' })).toBe(key());
  });

  it('distinguishes a different change on the same entity', () => {
    expect(key({ afterValue: '$69/month' })).not.toBe(key());
  });

  it('distinguishes the same change on a different entity', () => {
    expect(key({ entityId: 'ent-2' })).not.toBe(key());
  });

  it('distinguishes a different event type', () => {
    expect(key({ eventType: 'feature_launched' })).not.toBe(key());
  });
});

describe('materiality scoring', () => {
  it('ranks a pricing change above a documentation edit', () => {
    const pricing = scoreMateriality({ eventType: 'pricing_changed', sourceTrust: 'official' });
    const docs = scoreMateriality({ eventType: 'documentation_changed', sourceTrust: 'official' });
    expect(pricing.score).toBeGreaterThan(docs.score);
  });

  it('discounts a change close to rounding error', () => {
    const tiny = scoreMateriality({
      eventType: 'pricing_changed', magnitude: 0.005, sourceTrust: 'official',
    });
    const large = scoreMateriality({
      eventType: 'pricing_changed', magnitude: 0.3, sourceTrust: 'official',
    });
    expect(tiny.score).toBeLessThan(large.score);
    expect(tiny.reason).toContain('close to noise');
  });

  it('discounts community sources relative to official ones', () => {
    const official = scoreMateriality({ eventType: 'pricing_changed', sourceTrust: 'official' });
    const community = scoreMateriality({ eventType: 'pricing_changed', sourceTrust: 'community' });
    expect(community.score).toBeLessThan(official.score);
  });

  it('raises a change that bears on the project decision', () => {
    const relevant = scoreMateriality({
      eventType: 'pricing_changed', sourceTrust: 'official', decisionFocus: 'pricing',
    });
    const unrelated = scoreMateriality({
      eventType: 'pricing_changed', sourceTrust: 'official', decisionFocus: 'roadmap',
    });
    expect(relevant.score).toBeGreaterThan(unrelated.score);
    expect(relevant.reason).toContain('pricing decision');
  });

  it('halves the weight of an untracked entity', () => {
    const tracked = scoreMateriality({
      eventType: 'pricing_changed', sourceTrust: 'official', isTrackedEntity: true,
    });
    const untracked = scoreMateriality({
      eventType: 'pricing_changed', sourceTrust: 'official', isTrackedEntity: false,
    });
    expect(untracked.score).toBeLessThan(tracked.score);
  });

  it('discounts a repeat of a familiar pattern', () => {
    const novel = scoreMateriality({ eventType: 'feature_launched', sourceTrust: 'official' });
    const repeat = scoreMateriality({
      eventType: 'feature_launched', sourceTrust: 'official', isRepeat: true,
    });
    expect(repeat.score).toBeLessThan(novel.score);
  });

  it('stays inside 0..1 under compounding boosts', () => {
    const result = scoreMateriality({
      eventType: 'pricing_changed', magnitude: 5, sourceTrust: 'official',
      isTrackedEntity: true, decisionFocus: 'pricing',
    });
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('always explains itself', () => {
    // A threshold nobody can reason about cannot be tuned.
    const result = scoreMateriality({ eventType: 'review_theme', sourceTrust: 'community' });
    expect(result.reason).toMatch(/^Scored \d\.\d{2} because /);
    expect(result.reason.length).toBeGreaterThan(40);
  });

  it('keeps a routine low-trust edit below the alert threshold', () => {
    const routine = scoreMateriality({
      eventType: 'documentation_changed', sourceTrust: 'community', magnitude: 0.01,
    });
    expect(isMaterial(routine.score)).toBe(false);
  });

  it('lets a significant official pricing move clear the threshold', () => {
    const significant = scoreMateriality({
      eventType: 'pricing_changed', magnitude: 0.25, sourceTrust: 'official',
      isTrackedEntity: true, decisionFocus: 'pricing',
    });
    expect(isMaterial(significant.score)).toBe(true);
    expect(materialityToConfidence(significant.score)).toBe('high');
  });
});
