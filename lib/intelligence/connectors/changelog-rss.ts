/**
 * Changelog / RSS / Atom connector.
 *
 * Cheap, structured, and high signal. A product's changelog feed says what
 * shipped and when, in the vendor's own words, without spending a search credit
 * or a model call. For competitors that publish one, this is a better source of
 * release activity than any amount of web search.
 *
 * The parser is deliberately small and dependency-free. Feeds in the wild are
 * inconsistent enough that a strict XML parser rejects a meaningful share of
 * them, and a rejected feed is a competitor that looks inactive.
 */

import { safeFetch } from '@/lib/net/outbound-policy';
import type { ExtractedSpan } from '../evidence-extractor';

export interface FeedEntry {
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string;
}

export type FeedResult =
  | { ok: true; entries: FeedEntry[]; sourceUrl: string; retrievedAt: string }
  | { ok: false; reason: string; sourceUrl: string };

/** Common paths a changelog lives at, tried in order of likelihood. */
export const COMMON_FEED_PATHS = [
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '/changelog.xml',
  '/blog/feed.xml',
  '/changelog/feed.xml',
  '/feed',
  '/rss',
];

/** Candidate feed URLs for a site root, for discovery. */
export function candidateFeedUrls(siteUrl: string): string[] {
  try {
    const base = new URL(siteUrl);
    base.pathname = '';
    base.search = '';
    base.hash = '';
    const root = base.toString().replace(/\/$/, '');
    return COMMON_FEED_PATHS.map((path) => `${root}${path}`);
  } catch {
    return [];
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function firstTag(block: string, ...names: string[]): string {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
    if (match) return decodeEntities(match[1]);

    // Atom links carry the URL in an attribute rather than as text.
    const attr = block.match(new RegExp(`<${name}[^>]*href=["']([^"']+)["']`, 'i'));
    if (attr) return decodeEntities(attr[1]);
  }
  return '';
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function toIso(raw: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Parse an RSS 2.0 or Atom document.
 *
 * Exported separately from fetching so feed quirks can be tested against fixed
 * fixtures rather than against whatever a live site happens to serve today.
 */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];

  return blocks
    .map((block) => {
      const title = stripTags(firstTag(block, 'title'));
      const link = firstTag(block, 'link', 'guid');
      const publishedAt = toIso(firstTag(block, 'pubDate', 'published', 'updated', 'dc:date'));
      const summary = stripTags(
        firstTag(block, 'description', 'summary', 'content:encoded', 'content'),
      ).slice(0, 500);

      return { title, link, publishedAt, summary };
    })
    .filter((entry) => entry.title.length > 0);
}

/** Fetch and parse a feed. */
export async function fetchFeed(feedUrl: string): Promise<FeedResult> {
  try {
    const response = await safeFetch(feedUrl, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'User-Agent': 'veracity-market-intelligence',
      },
      timeoutMs: 15_000,
    });

    if (!response.ok) {
      return { ok: false, reason: `feed returned ${response.status}`, sourceUrl: feedUrl };
    }

    const xml = await response.text();
    const entries = parseFeed(xml);

    if (entries.length === 0) {
      // Distinguished from a transport error: the URL responded but is not a
      // feed, which is worth telling the user so they can correct the source.
      return { ok: false, reason: 'the response contained no feed entries', sourceUrl: feedUrl };
    }

    return { ok: true, entries, sourceUrl: feedUrl, retrievedAt: new Date().toISOString() };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      sourceUrl: feedUrl,
    };
  }
}

/**
 * Convert feed entries into evidence spans.
 *
 * Entries with no usable date are dropped rather than dated to now. An undated
 * item placed at today's date would show up as a brand-new release and could
 * trigger a false alert.
 */
export function feedEntriesToSpans(entries: FeedEntry[], entityLabel: string): ExtractedSpan[] {
  return entries
    .filter((entry) => entry.publishedAt !== null)
    .map((entry) => {
      const excerpt = entry.summary
        ? `${entry.title} — ${entry.summary}`
        : entry.title;

      return {
        excerpt,
        startOffset: 0,
        endOffset: excerpt.length,
        extractionType: 'release',
        // The feed belongs to the entity whose site we fetched it from.
        entityMatch: 'confirmed',
        statement: `${entityLabel} published "${entry.title}" on ${entry.publishedAt!.slice(0, 10)}`,
        // No metric: a changelog entry is a dated event, not a measurement.
        // Counting entries per month is the caller's job, and doing it here
        // would invent a metric the feed never stated.
        metric: null,
      } satisfies ExtractedSpan;
    });
}

/** Monthly entry counts, for a publishing-cadence chart. */
export function feedEntriesToMonthlyCounts(
  entries: FeedEntry[],
): Array<{ month: string; count: number; titles: string[] }> {
  const dated = entries.filter((e) => e.publishedAt !== null);
  if (dated.length === 0) return [];

  const byMonth = new Map<string, string[]>();
  for (const entry of dated) {
    const month = entry.publishedAt!.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(entry.title);
  }

  const months = [...byMonth.keys()].sort();
  const out: Array<{ month: string; count: number; titles: string[] }> = [];

  const [startYear, startMonth] = months[0].split('-').map(Number);
  const [endYear, endMonth] = months[months.length - 1].split('-').map(Number);

  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const titles = byMonth.get(key) ?? [];
    // Quiet months are emitted, same reason as the GitHub connector: a gap in
    // publishing is a real signal about a competitor.
    out.push({ month: key, count: titles.length, titles });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return out;
}
