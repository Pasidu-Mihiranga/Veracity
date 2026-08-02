/**
 * Changelog/RSS and pricing-extraction tests.
 *
 * The pricing tests matter most: a pricing page is prose and a price is a
 * number, which is exactly the gap where a model invents a plausible figure.
 * Every price here must be locatable in the input text.
 */

import { describe, it, expect } from 'vitest';
import {
  parseFeed,
  candidateFeedUrls,
  feedEntriesToSpans,
  feedEntriesToMonthlyCounts,
  type FeedEntry,
} from '@/lib/intelligence/connectors/changelog-rss';
import {
  extractPrices,
  pricesToSpans,
} from '@/lib/intelligence/connectors/pricing-extractor';
import { normalizeContent } from '@/lib/intelligence/snapshot-store';

// ── Feeds ───────────────────────────────────────────────────────────────────

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Acme changelog</title>
  <item>
    <title>Shipped bulk import</title>
    <link>https://acme.example/changelog/bulk-import</link>
    <pubDate>Mon, 03 Mar 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>You can now import <b>10,000</b> records at once.</p>]]></description>
  </item>
  <item>
    <title>SSO for enterprise</title>
    <link>https://acme.example/changelog/sso</link>
    <pubDate>Wed, 15 Jan 2026 09:00:00 GMT</pubDate>
    <description>SAML and SCIM are available on the Enterprise plan.</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Acme releases</title>
  <entry>
    <title>Version 3.0</title>
    <link href="https://acme.example/releases/3.0"/>
    <updated>2026-04-02T12:00:00Z</updated>
    <summary>A faster query engine &amp; new dashboards.</summary>
  </entry>
</feed>`;

describe('feed parsing', () => {
  it('parses RSS entries with dates, links, and stripped HTML', () => {
    const entries = parseFeed(RSS);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe('Shipped bulk import');
    expect(entries[0].link).toBe('https://acme.example/changelog/bulk-import');
    expect(entries[0].publishedAt).toBe('2026-03-03T10:00:00.000Z');
    // CDATA unwrapped and markup stripped, so the excerpt reads as text.
    expect(entries[0].summary).toContain('10,000 records');
    expect(entries[0].summary).not.toContain('<b>');
  });

  it('parses Atom entries, including href links and escaped entities', () => {
    const entries = parseFeed(ATOM);
    expect(entries).toHaveLength(1);
    expect(entries[0].link).toBe('https://acme.example/releases/3.0');
    expect(entries[0].publishedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(entries[0].summary).toContain('engine & new');
  });

  it('returns nothing for a document that is not a feed', () => {
    expect(parseFeed('<html><body>Not a feed</body></html>')).toEqual([]);
  });

  it('proposes candidate feed URLs from a site root', () => {
    const candidates = candidateFeedUrls('https://acme.example/pricing?x=1');
    expect(candidates).toContain('https://acme.example/feed.xml');
    expect(candidates).toContain('https://acme.example/changelog/feed.xml');
    expect(candidateFeedUrls('not a url')).toEqual([]);
  });
});

describe('feed to evidence', () => {
  const entries: FeedEntry[] = [
    { title: 'A', link: 'l', publishedAt: '2026-01-05T00:00:00.000Z', summary: 'first' },
    { title: 'B', link: 'l', publishedAt: '2026-01-20T00:00:00.000Z', summary: '' },
    { title: 'C', link: 'l', publishedAt: '2026-04-01T00:00:00.000Z', summary: 'third' },
    { title: 'Undated', link: 'l', publishedAt: null, summary: 'no date' },
  ];

  it('drops undated entries rather than dating them to now', () => {
    // An undated item placed at today would look like a brand-new release and
    // could fire a false alert.
    const spans = feedEntriesToSpans(entries, 'Acme');
    expect(spans).toHaveLength(3);
    expect(spans.some((s) => s.excerpt.includes('Undated'))).toBe(false);
  });

  it('does not invent a metric from a changelog entry', () => {
    // A changelog entry is a dated event, not a measurement.
    const spans = feedEntriesToSpans(entries, 'Acme');
    expect(spans.every((s) => s.metric === null)).toBe(true);
  });

  it('emits quiet months when counting publishing cadence', () => {
    const counts = feedEntriesToMonthlyCounts(entries);
    expect(counts.map((c) => c.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(counts.map((c) => c.count)).toEqual([2, 0, 0, 1]);
  });

  it('returns nothing when no entry is dated', () => {
    expect(feedEntriesToMonthlyCounts([entries[3]])).toEqual([]);
  });
});

// ── Pricing ─────────────────────────────────────────────────────────────────

describe('price extraction', () => {
  const PAGE = normalizeContent(`
    Simple pricing for every team.
    The Starter plan is $19 per month for up to 3 seats.
    Our Pro plan costs $49/mo and includes advanced analytics.
    The Enterprise plan is $499 per year, billed annually.
    Save $100 when you switch from a competitor.
    We process 10,000 requests before overage applies.
  `);

  it('finds the prices that are actually written on the page', () => {
    const prices = extractPrices(PAGE);
    const amounts = prices.map((p) => p.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([19, 49, 499]);
  });

  it('never returns a price that is not in the text', () => {
    // The property that matters. Every extracted figure must be locatable.
    for (const price of extractPrices(PAGE)) {
      expect(PAGE).toContain(String(price.amount));
      expect(PAGE).toContain(price.excerpt);
    }
  });

  it('ignores a discount amount', () => {
    // "Save $100" is not a price for anything.
    expect(extractPrices(PAGE).some((p) => p.amount === 100)).toBe(false);
  });

  it('ignores a bare number that is not money', () => {
    // 10,000 requests is a limit, not a price.
    expect(extractPrices(PAGE).some((p) => p.amount === 10000)).toBe(false);
  });

  it('attributes each price to its plan', () => {
    const byAmount = new Map(extractPrices(PAGE).map((p) => [p.amount, p.planName]));
    expect(byAmount.get(19)).toBe('Starter');
    expect(byAmount.get(49)).toBe('Pro');
    expect(byAmount.get(499)).toBe('Enterprise');
  });

  it('reads the interval from the number or the sentence', () => {
    const byAmount = new Map(extractPrices(PAGE).map((p) => [p.amount, p.interval]));
    expect(byAmount.get(19)).toBe('month'); // "per month"
    expect(byAmount.get(49)).toBe('month'); // "/mo"
    expect(byAmount.get(499)).toBe('year'); // "per year"
  });

  it('recognises non-dollar currencies', () => {
    const prices = extractPrices(normalizeContent('The Pro plan is £39 per month.'));
    expect(prices[0].currency).toBe('GBP');
    expect(prices[0].amount).toBe(39);
  });

  it('does not double count a price repeated in a table and a summary', () => {
    const repeated = normalizeContent(`
      The Pro plan is $49 per month.
      Pro: $49 per month.
    `);
    expect(extractPrices(repeated)).toHaveLength(1);
  });

  it('returns nothing for a page with no prices', () => {
    expect(extractPrices(normalizeContent('Contact sales for a quote.'))).toEqual([]);
  });

  it('keeps tiers in separate metric series', () => {
    // Without the plan in the key, "$49 -> $499" reads as a 10x price rise
    // when it is really the Pro and Enterprise tiers being compared.
    const spans = pricesToSpans(extractPrices(PAGE), 'Acme');
    const keys = new Set(spans.map((s) => s.metric?.key));
    expect(keys.size).toBe(3);
    expect(keys).toContain('plan_price:pro');
    expect(keys).toContain('plan_price:enterprise');
  });

  it('carries the surrounding sentence as the excerpt', () => {
    const spans = pricesToSpans(extractPrices(PAGE), 'Acme');
    const pro = spans.find((s) => s.metric?.key === 'plan_price:pro');
    expect(pro!.excerpt).toContain('$49');
    expect(pro!.entityMatch).toBe('confirmed');
    expect(pro!.metric?.unit).toBe('USD/month');
    expect(pro!.metric?.isEstimated).toBe(false);
  });

  it('marks an unattributed price as probable rather than confirmed', () => {
    const spans = pricesToSpans(
      extractPrices(normalizeContent('It costs $12 per month.')),
      'Acme',
    );
    expect(spans[0].entityMatch).toBe('probable');
    expect(spans[0].metric?.key).toBe('plan_price');
  });
});
