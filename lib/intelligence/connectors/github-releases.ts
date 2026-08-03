/**
 * GitHub releases connector.
 *
 * The cheapest path in the product to a genuinely *measured* chart row. Release
 * dates are published, dated, and unambiguous — no model reads them, no
 * extraction step can hallucinate them, and the evidence span is the release
 * name and tag as GitHub returned them.
 *
 * Contrast with asking an LLM "how often does this competitor ship?", which
 * produces a confident sentence with no provenance. Release cadence is the kind
 * of question where a small, boring connector beats a large model outright.
 *
 * Public repositories need no key. `GITHUB_TOKEN` is used when present purely
 * to raise the rate limit.
 */

import { safeFetch } from '@/lib/net/outbound-policy';
import type { ExtractedSpan } from '../evidence-extractor';

const API_ROOT = 'https://api.github.com';

export interface GitHubRelease {
  tag: string;
  name: string;
  publishedAt: string;
  url: string;
  isPrerelease: boolean;
}

export type ConnectorResult<T> =
  | { ok: true; data: T; sourceUrl: string; retrievedAt: string }
  | { ok: false; reason: string; sourceUrl: string };

/** Parse "owner/repo" out of the various forms a user might supply. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\.git$/, '');

  const url = trimmed.match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
  if (url) return { owner: url[1], repo: url[2] };

  const shorthand = trimmed.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };

  return null;
}

function headers(): Record<string, string> {
  const base: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'veracity-market-intelligence',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

/**
 * Fetch published releases, newest first.
 *
 * Drafts are excluded because an unpublished draft is not a shipped release.
 * Prereleases are kept but flagged, so a caller can decide whether a beta counts
 * as shipping for its purposes.
 */
export async function fetchReleases(
  repoInput: string,
  limit = 100,
): Promise<ConnectorResult<GitHubRelease[]>> {
  const parsed = parseRepo(repoInput);
  if (!parsed) {
    return { ok: false, reason: `"${repoInput}" is not a GitHub repository`, sourceUrl: repoInput };
  }

  const { owner, repo } = parsed;
  const sourceUrl = `https://github.com/${owner}/${repo}/releases`;
  const apiUrl = `${API_ROOT}/repos/${owner}/${repo}/releases?per_page=${Math.min(limit, 100)}`;

  try {
    const response = await safeFetch(apiUrl, { headers: headers(), timeoutMs: 15_000 });

    if (response.status === 404) {
      return { ok: false, reason: 'repository not found or not public', sourceUrl };
    }
    if (response.status === 403) {
      // Distinguished from a real failure: the data exists, we are throttled.
      // Reporting it as "no releases" would read as a competitor that stopped
      // shipping.
      return { ok: false, reason: 'GitHub rate limit reached; set GITHUB_TOKEN to raise it', sourceUrl };
    }
    if (!response.ok) {
      return { ok: false, reason: `GitHub returned ${response.status}`, sourceUrl };
    }

    const body = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(body)) {
      return { ok: false, reason: 'unexpected response shape', sourceUrl };
    }

    const releases: GitHubRelease[] = body
      .filter((r) => r.draft !== true && typeof r.published_at === 'string')
      .map((r) => ({
        tag: String(r.tag_name ?? ''),
        name: String(r.name || r.tag_name || ''),
        publishedAt: new Date(String(r.published_at)).toISOString(),
        url: String(r.html_url ?? sourceUrl),
        isPrerelease: r.prerelease === true,
      }));

    return { ok: true, data: releases, sourceUrl, retrievedAt: new Date().toISOString() };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      sourceUrl,
    };
  }
}

/**
 * Bucket releases into monthly counts.
 *
 * Every month between the first and last release is emitted, including months
 * with zero releases. A quiet month is a real finding about a competitor's
 * cadence; omitting it would let the chart skip the gap and imply steady
 * shipping.
 */
export function releasesToMonthlyCounts(
  releases: GitHubRelease[],
  options: { includePrereleases?: boolean } = {},
): Array<{ month: string; count: number; releases: GitHubRelease[] }> {
  const included = options.includePrereleases
    ? releases
    : releases.filter((r) => !r.isPrerelease);

  if (included.length === 0) return [];

  const byMonth = new Map<string, GitHubRelease[]>();
  for (const release of included) {
    const month = release.publishedAt.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(release);
  }

  const months = [...byMonth.keys()].sort();
  const out: Array<{ month: string; count: number; releases: GitHubRelease[] }> = [];

  const [startYear, startMonth] = months[0].split('-').map(Number);
  const [endYear, endMonth] = months[months.length - 1].split('-').map(Number);

  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const inMonth = byMonth.get(key) ?? [];
    out.push({ month: key, count: inMonth.length, releases: inMonth });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return out;
}

/**
 * Turn monthly counts into evidence spans carrying metric observations.
 *
 * The excerpt lists the actual release names in the month, so "3 releases in
 * March" opens onto the three tags that produced the number. A zero month
 * carries an excerpt saying so rather than being silently dropped.
 */
export function releasesToSpans(
  buckets: Array<{ month: string; count: number; releases: GitHubRelease[] }>,
  repoLabel: string,
): ExtractedSpan[] {
  return buckets.map((bucket) => {
    const excerpt =
      bucket.count === 0
        ? `${repoLabel}: no releases published in ${bucket.month}`
        : `${repoLabel} released in ${bucket.month}: ${bucket.releases
            .map((r) => r.name || r.tag)
            .join(', ')}`;

    return {
      excerpt,
      startOffset: 0,
      endOffset: excerpt.length,
      extractionType: 'release',
      // The GitHub API was queried for this exact repository, so the entity is
      // not in question the way it is for a search result.
      entityMatch: 'confirmed',
      statement: `${repoLabel} published ${bucket.count} release(s) in ${bucket.month}`,
      metric: {
        key: 'release_count',
        value: bucket.count,
        unit: 'releases',
        periodStart: `${bucket.month}-01T00:00:00.000Z`,
        periodEnd: null,
        // Counted from published records, not read off a page and not estimated.
        isEstimated: false,
      },
    };
  });
}
