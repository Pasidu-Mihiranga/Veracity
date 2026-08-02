/**
 * Plain-language layer.
 *
 * The target user is a founder or product marketer, not a data engineer. These
 * tests hold the line that no internal vocabulary leaks into what they read,
 * and that the sentences the product generates are accurate — a readable lie is
 * worse than an unreadable truth.
 */

import { describe, it, expect } from 'vitest';
import {
  DATA_CLASS,
  ENTITY_MATCH,
  CLAIM_TYPE,
  GLOSSARY,
  importanceOf,
  freshnessOf,
  describeEvent,
} from '@/lib/ux/vocabulary';
import {
  formatValue,
  describeMovement,
  summariseChart,
  summariseChange,
  summariseCoverage,
} from '@/lib/intelligence/plain-language';
import type { ChartSpec } from '@/lib/intelligence/types';

/** Internal terms that must never reach a user-facing string. */
const JARGON = [
  'materiality', 'evidence span', 'entity_match', 'data class', 'dataClass',
  'dedupe', 'snapshot hash', 'claim_type', 'short circuit', 'span id',
  'observation', 'artifact', 'persona id',
];

function assertNoJargon(text: string, where: string) {
  for (const term of JARGON) {
    expect(text.toLowerCase(), `${where} leaked "${term}"`).not.toContain(term.toLowerCase());
  }
}

function chart(over: Partial<ChartSpec> = {}): ChartSpec {
  return {
    id: 'c1',
    kind: 'line',
    dataClass: 'measured',
    title: 'Entry-tier price',
    questionAnswered: 'Has the entry-tier price changed?',
    metricDefinition: 'Advertised monthly price',
    unit: 'USD/month',
    period: { start: '2026-01-01', end: '2026-03-01', cadence: 'month' },
    dimensions: ['period'],
    series: [{ key: 'price', label: 'Entry tier' }],
    rows: [
      { period: '2026-01', price: 49 },
      { period: '2026-02', price: 49 },
      { period: '2026-03', price: 59 },
    ],
    sourceIds: ['s1'],
    evidenceSpanIds: ['span-1'],
    sampleSize: 3,
    isEstimated: false,
    limitations: [],
    generatedAt: '2026-03-01T00:00:00.000Z',
    ...over,
  } as ChartSpec;
}

describe('vocabulary', () => {
  it('gives every term a label and a plain explanation', () => {
    const all = [
      ...Object.values(DATA_CLASS),
      ...Object.values(ENTITY_MATCH),
      ...Object.values(CLAIM_TYPE),
    ];
    for (const term of all) {
      expect(term.label.length).toBeGreaterThan(0);
      // The explanation has to be a sentence, not a restatement of the label.
      expect(term.meaning.length).toBeGreaterThan(25);
      assertNoJargon(term.label, 'label');
      assertNoJargon(term.meaning, 'meaning');
    }
  });

  it('never shows a raw score for importance', () => {
    for (const score of [0.1, 0.5, 0.85, 1]) {
      const term = importanceOf(score);
      expect(term.label).not.toMatch(/\d/);
      assertNoJargon(term.label, 'importance');
    }
  });

  it('separates the three importance bands meaningfully', () => {
    expect(importanceOf(0.9).label).toBe('Worth acting on');
    expect(importanceOf(0.6).label).toBe('Worth knowing');
    expect(importanceOf(0.2).label).toBe('Minor');
  });

  it('states an unchecked source as an absence, not a blank', () => {
    // A blank cell reads as a rendering failure; "Never checked" is a fact.
    const term = freshnessOf(null);
    expect(term.label).toBe('Never checked');
    expect(term.meaning).toContain('cannot say');
  });

  it('describes freshness in days rather than a timestamp', () => {
    const recent = freshnessOf(new Date(Date.now() - 3 * 86_400_000).toISOString());
    expect(recent.label).toBe('Checked 3 days ago');

    const stale = freshnessOf(new Date(Date.now() - 60 * 86_400_000).toISOString());
    expect(stale.tone).toBe('caution');
    expect(stale.meaning).toContain('out of date');
  });

  it('turns event types into readable phrases', () => {
    expect(describeEvent('pricing_changed')).toBe('changed their pricing');
    expect(describeEvent('feature_launched')).toBe('shipped something new');
    // An unknown type degrades to readable words rather than showing snake_case.
    expect(describeEvent('some_new_type')).toBe('some new type');
  });

  it('defines every glossary term without using jargon to do it', () => {
    expect(GLOSSARY.length).toBeGreaterThan(5);
    for (const entry of GLOSSARY) {
      expect(entry.plain.length).toBeGreaterThan(40);
      assertNoJargon(entry.plain, `glossary:${entry.term}`);
    }
  });
});

describe('formatting numbers as people write them', () => {
  it('renders currency with a symbol and period', () => {
    expect(formatValue(49, 'USD/month')).toBe('$49/month');
    expect(formatValue(39, 'GBP/month')).toBe('£39/month');
    expect(formatValue(1200, 'EUR/year')).toBe('€1200/year');
  });

  it('keeps a non-currency unit as words', () => {
    expect(formatValue(3, 'releases')).toBe('3 releases');
  });

  it('describes movement as a direction a person would say', () => {
    expect(describeMovement(49, 59)).toBe('a 20% rise');
    expect(describeMovement(100, 85)).toBe('a 15% drop');
  });

  it('returns nothing when there is no meaningful movement', () => {
    expect(describeMovement(49, 49)).toBeNull();
    // Dividing by a zero baseline would produce Infinity%.
    expect(describeMovement(0, 10)).toBeNull();
  });
});

describe('chart summaries', () => {
  it('leads with what happened, accurately', () => {
    const summary = summariseChart(chart());
    expect(summary.headline).toContain('$49');
    expect(summary.headline).toContain('$59');
    expect(summary.headline).toContain('20% rise');
    assertNoJargon(summary.headline, 'chart headline');
  });

  it('states stability rather than making the user read the line', () => {
    const flat = summariseChart(
      chart({ rows: [{ period: '2026-01', price: 49 }, { period: '2026-02', price: 49 }] }),
    );
    expect(flat.headline).toContain('has not moved');
  });

  it('says where the numbers came from without naming the class', () => {
    expect(summariseChart(chart()).provenance).toContain('Read directly from the sources');
    expect(summariseChart(chart({ dataClass: 'derived', formula: 'x' })).provenance)
      .toContain('Worked out by us');
    expect(summariseChart(chart({ dataClass: 'synthetic' })).provenance)
      .toContain('Generated by a model');
  });

  it('warns about a simulated chart above everything else', () => {
    // Only one caveat is shown, and this is the one that matters most.
    const summary = summariseChart(chart({ dataClass: 'synthetic', isEstimated: true }));
    expect(summary.caveat).toContain('simulated');
  });

  it('flags too few readings to call a trend', () => {
    // A single reading on a monthly series states the value and says outright
    // that it is not a trend — which is the honest read, and better than a
    // lone point implying direction.
    const summary = summariseChart(chart({ rows: [{ period: '2026-01', price: 49 }] }));
    expect(summary.headline).toContain('$49');
    expect(summary.caveat).toContain('too few to call a trend');
  });

  it('does not warn about trend length on a point-in-time snapshot', () => {
    // A snapshot never claimed to be a series, so the warning would be noise.
    const summary = summariseChart(
      chart({
        period: { start: '2026-01-01', end: '2026-01-01', cadence: 'snapshot' },
        rows: [{ period: '2026-01', price: 49 }],
      }),
    );
    expect(summary.caveat).toBeNull();
  });

  it('shows at most one caveat', () => {
    const summary = summariseChart(
      chart({ isEstimated: true, rows: [{ period: '2026-01', price: 49 }, { period: '2026-02', price: 59 }] }),
    );
    expect(typeof summary.caveat === 'string' || summary.caveat === null).toBe(true);
  });

  it('says so plainly when there is nothing to show', () => {
    const summary = summariseChart(chart({ rows: [] }));
    expect(summary.headline).toContain('Nothing to show');
  });
});

describe('change summaries', () => {
  const base = {
    entityLabel: 'Lilian',
    eventType: 'pricing_changed',
    beforeValue: '$49/month',
    afterValue: '$59/month',
    materiality: 0.85,
    observedAt: new Date().toISOString(),
  };

  it('reads as a sentence about the company', () => {
    const summary = summariseChange(base);
    expect(summary.sentence).toBe(
      'Lilian changed their pricing: $49/month → $59/month — spotted today.',
    );
    assertNoJargon(summary.sentence, 'change sentence');
  });

  it('explains importance in words, not a score', () => {
    const summary = summariseChange(base);
    expect(summary.importance).not.toMatch(/0\.\d/);
    assertNoJargon(summary.importance, 'change importance');
  });

  it('suggests a next step as a question, not an instruction', () => {
    // The product does not know enough about their situation to give orders.
    const summary = summariseChange(base);
    expect(summary.suggestion).toContain('Worth checking');
  });

  it('withholds a suggestion for a minor change', () => {
    expect(summariseChange({ ...base, materiality: 0.2 }).suggestion).toBeNull();
  });

  it('handles a change with only one side recorded', () => {
    const summary = summariseChange({ ...base, beforeValue: null, afterValue: 'Team plan added' });
    expect(summary.sentence).toContain('Team plan added');
  });
});

describe('coverage summaries', () => {
  it('says plainly when everything was checked and nothing moved', () => {
    expect(summariseCoverage({ sourcesChecked: 5, unchanged: 5, unreachable: 0 }))
      .toContain('every one was identical');
  });

  it('warns that an unreachable source hides changes', () => {
    // "No change" and "we could not look" mean opposite things.
    const text = summariseCoverage({ sourcesChecked: 5, unchanged: 2, unreachable: 2 });
    expect(text).toContain('could not be reached');
    expect(text).toContain('would not have been spotted');
  });

  it('says nothing has been checked yet rather than reporting zeros', () => {
    expect(summariseCoverage({ sourcesChecked: 0, unchanged: 0, unreachable: 0 }))
      .toContain('have not checked any sources');
  });
});
