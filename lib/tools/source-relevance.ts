import type { AgentSource } from '@/lib/agents/types';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'vs', 'versus', 'for', 'of', 'to', 'in', 'on',
  'with', 'by', 'at', 'from', 'ai', 'inc', 'ltd', 'llc', 'co', 'corp', 'company',
  'product', 'software', 'platform', 'app', 'unknown',
]);

/** Build searchable tokens from product / competitor names. */
export function buildEntityTerms(
  product?: string | null,
  competitor?: string | null,
  extra: string[] = [],
): string[] {
  const terms = new Set<string>();

  const addName = (name: string | null | undefined) => {
    const raw = (name ?? '').trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    if (
      lower === 'unknown product' ||
      lower === 'the product' ||
      lower === 'the current product' ||
      lower === 'relevant competitors' ||
      lower === 'top competitors'
    ) {
      return;
    }
    terms.add(lower);
    for (const part of lower.split(/[\s/|,]+/)) {
      const token = part.replace(/[^a-z0-9.+-]/gi, '').trim();
      if (token.length >= 3 && !STOP_WORDS.has(token)) terms.add(token);
    }
  };

  addName(product);
  addName(competitor);
  for (const e of extra) addName(e);

  return [...terms];
}

/**
 * True when title/url likely refers to a resolved entity (or is a trusted
 * primary domain for that entity). Short unique brand tokens match loosely;
 * multi-word brands need stronger overlap. Allows 1-char edit distance for
 * tokens ≥5 chars (e.g. Lilian vs Lillian).
 */
export function sourceMatchesEntities(
  source: Pick<AgentSource, 'url' | 'title'>,
  entityTerms: string[],
  officialDomains: string[] = [],
): boolean {
  try {
    const hostname = new URL(source.url).hostname.replace(/^www\./, '').toLowerCase();
    if (officialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return true;
    }
  } catch {
    // Invalid URLs are rejected by source validation later.
  }
  if (entityTerms.length === 0) return true; // nothing to gate on

  const haystack = `${source.title ?? ''} ${source.url ?? ''}`.toLowerCase();
  if (!haystack.trim()) return false;

  // Prefer full-name matches first
  const fullNames = entityTerms.filter((t) => t.includes(' ') || t.length >= 5);
  for (const term of fullNames) {
    if (haystack.includes(term) || fuzzyIncludes(haystack, term)) return true;
  }

  // Token overlap: require at least one strong brand token (≥4 chars)
  const strong = entityTerms.filter((t) => !t.includes(' ') && t.length >= 4);
  for (const term of strong) {
    // word-ish boundary to reduce substring false positives (e.g. "ai" already filtered)
    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:[^a-z0-9]|$)`, 'i');
    if (re.test(haystack)) return true;
    if (term.length >= 5 && fuzzyTokenInHaystack(haystack, term)) return true;
  }

  return false;
}

/** Personal profiles and academic bios are identity clues, not product evidence. */
export function isPersonOrSchoolBioSource(
  source: Pick<AgentSource, 'url' | 'title'>,
): boolean {
  const url = source.url.toLowerCase();
  const title = source.title.toLowerCase();
  return (
    /linkedin\.com\/in\//i.test(url)
    || /\/(?:people|person|faculty|students?|alumni|authors?)\//i.test(url)
    || /\b(cv|resume|curriculum vitae)\b/i.test(title)
    || /\b(school of business|university profile|professor|phd student|student at|faculty bio|alumni)\b/i.test(title)
  );
}

/** Derive canonical official domains from classifier/user-provided URLs. */
export function officialDomainsFromUrls(
  ...urls: (string | undefined | null)[]
): string[] {
  const domains = new Set<string>();
  for (const value of urls) {
    if (!value?.trim()) continue;
    try {
      const candidate = /^https?:\/\//i.test(value.trim())
        ? value.trim()
        : `https://${value.trim()}`;
      domains.add(new URL(candidate).hostname.replace(/^www\./, '').toLowerCase());
    } catch {
      // Ignore malformed classifier output.
    }
  }
  return [...domains];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fuzzyIncludes(haystack: string, term: string): boolean {
  if (term.length < 5) return false;
  // Sliding window over haystack tokens / substrings of same length ±1
  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((w) => levenshteinAtMostOne(w, term));
}

function fuzzyTokenInHaystack(haystack: string, term: string): boolean {
  return fuzzyIncludes(haystack, term);
}

/** True if edit distance between a and b is 0 or 1 (same length or ±1). */
function levenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let diffs = 0;
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i] && ++diffs > 1) return false;
    }
    return diffs === 1;
  }
  // insertion / deletion
  const shorter = la < lb ? a : b;
  const longer = la < lb ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    j++;
  }
  return true;
}

export type RelevanceFilterResult = {
  kept: AgentSource[];
  dropped: number;
  matchRatio: number;
};

/**
 * Keep credible sources that mention resolved entities or belong to an
 * explicitly supplied official domain. Empty results stay empty.
 */
export function filterSourcesByEntityRelevance(
  sources: AgentSource[],
  entityTerms: string[],
  opts?: {
    officialDomains?: string[];
    rejectPersonBios?: boolean;
  },
): RelevanceFilterResult {
  if (sources.length === 0) {
    return { kept: [], dropped: 0, matchRatio: 0 };
  }
  const credible = opts?.rejectPersonBios === false
    ? sources
    : sources.filter((source) => !isPersonOrSchoolBioSource(source));
  if (entityTerms.length === 0) {
    return {
      kept: credible,
      dropped: sources.length - credible.length,
      matchRatio: credible.length / sources.length,
    };
  }
  const matched = credible.filter((source) =>
    sourceMatchesEntities(source, entityTerms, opts?.officialDomains ?? []),
  );
  const matchRatio = matched.length / sources.length;

  return {
    kept: matched,
    dropped: sources.length - matched.length,
    matchRatio,
  };
}
