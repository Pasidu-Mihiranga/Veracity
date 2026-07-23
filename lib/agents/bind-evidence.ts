import type { AgentSource, Recommendation } from '@/lib/agents/types';
import { buildEntityTerms } from '@/lib/tools/source-relevance';

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'this', 'that', 'from', 'by', 'as', 'at', 'be', 'it', 'its', 'our', 'your', 'their',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function scoreEvidenceAgainstSource(
  evidence: string,
  source: AgentSource,
  entityTerms: string[],
): number {
  const evTokens = new Set(tokenize(evidence));
  if (evTokens.size === 0) return 0;

  const hay = tokenize(`${source.title} ${source.url}`);
  if (hay.length === 0) return 0;

  let overlap = 0;
  for (const t of hay) {
    if (evTokens.has(t)) overlap += 1;
  }
  const overlapScore = overlap / Math.max(evTokens.size, 1);

  const entityBoost = entityTerms.some((term) => {
    const tl = term.toLowerCase();
    return (
      source.title.toLowerCase().includes(tl) ||
      source.url.toLowerCase().includes(tl) ||
      evidence.toLowerCase().includes(tl)
    );
  })
    ? 0.15
    : 0;

  return Math.min(1, overlapScore + entityBoost);
}

/**
 * Deterministically bind recommendation evidence bullets to source URLs.
 * No LLM / synthesizer prompt changes.
 */
export function bindEvidenceToSources(
  recommendations: Recommendation[],
  sources: AgentSource[],
  product: string,
  competitor?: string,
  maxUrls = 3,
): Recommendation[] {
  if (!recommendations.length || !sources.length) {
    return recommendations.map((r) => ({
      ...r,
      sourceUrls: r.sourceUrls ?? [],
    }));
  }

  const entityTerms = buildEntityTerms(product, competitor);

  return recommendations.map((rec) => {
    const claims = [
      ...(rec.evidence ?? []),
      rec.title,
      rec.rationale,
    ].filter(Boolean);

    const scored = sources
      .map((s) => {
        const best = Math.max(
          ...claims.map((c) => scoreEvidenceAgainstSource(c, s, entityTerms)),
          0,
        );
        return { url: s.url, score: best };
      })
      .filter((x) => x.score > 0.08)
      .sort((a, b) => b.score - a.score);

    const urls: string[] = [];
    const seen = new Set<string>();
    for (const row of scored) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      urls.push(row.url);
      if (urls.length >= maxUrls) break;
    }

    // Fallback: if no claim overlap, still attach top trusted-ish sources for trail UX
    if (urls.length === 0) {
      for (const s of sources.slice(0, maxUrls)) {
        if (!seen.has(s.url)) {
          urls.push(s.url);
          seen.add(s.url);
        }
      }
    }

    return { ...rec, sourceUrls: urls };
  });
}
