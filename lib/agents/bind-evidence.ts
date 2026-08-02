import type {
  AgentSource,
  EvidenceClaimBinding,
  EvidenceSupportLevel,
  Recommendation,
} from '@/lib/agents/types';
import {
  buildEntityTerms,
  officialDomainsFromUrls,
} from '@/lib/tools/source-relevance';

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

export function scoreEvidenceAgainstSource(
  evidence: string,
  source: AgentSource,
  entityTerms: string[],
  officialDomains: string[] = [],
): number {
  const evTokens = new Set(tokenize(evidence));
  if (evTokens.size === 0) return 0;

  const sourceTokens = new Set(tokenize(`${source.title} ${source.url}`));
  if (sourceTokens.size === 0) return 0;
  const entityTokenSet = new Set(entityTerms.flatMap(tokenize));
  const evidenceContentTokens = [...evTokens].filter((token) => !entityTokenSet.has(token));

  let overlap = 0;
  for (const token of evidenceContentTokens) {
    if (sourceTokens.has(token)) overlap += 1;
  }
  const overlapScore = overlap / Math.max(evidenceContentTokens.length, 1);

  const entityAligned = entityTerms.some((term) => {
    const tl = term.toLowerCase();
    return (
      evidence.toLowerCase().includes(tl)
      && (
        source.title.toLowerCase().includes(tl)
        || source.url.toLowerCase().includes(tl)
      )
    );
  });
  let official = false;
  try {
    const hostname = new URL(source.url).hostname.replace(/^www\./, '').toLowerCase();
    official = officialDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    official = false;
  }
  const requiresIndependentEvidence =
    /\b(hacker news|reddit|reviews?|buyers?|customers?|users? (?:say|report)|engagement|market share|growth|funding|revenue|adoption|interest|sentiment)\b/i.test(
      evidence,
    );

  // Entity alignment can strengthen real lexical overlap, but never creates a
  // strong binding by itself. A known official domain may provide weak support
  // for an entity-aligned claim even when its page title is terse.
  if (overlap === 0) {
    return official && entityAligned && !requiresIndependentEvidence ? 0.2 : 0;
  }
  return Math.min(1, overlapScore + (entityAligned ? 0.12 : 0));
}

function supportLevel(score: number): EvidenceSupportLevel {
  if (score >= 0.38) return 'supported';
  if (score >= 0.18) return 'weakly-supported';
  return 'unsupported';
}

/**
 * Spans available to prove claims, keyed by the claim text they support.
 *
 * When a span is available it wins outright: an excerpt from the page is proof,
 * whereas the lexical score below only measures whether a claim's words happen
 * to overlap a source's title and URL. Keeping the lexical path is deliberate —
 * most agents do not produce spans yet — but it is now labelled as what it is
 * so a caller can tell a proven claim from a topically-related link.
 */
export interface SpanBindingIndex {
  /** claim text -> { spanIds, sourceUrls } */
  byClaim: Map<string, { spanIds: string[]; sourceUrls: string[] }>;
}

function bindClaim(
  claim: string,
  sources: AgentSource[],
  entityTerms: string[],
  officialDomains: string[],
  maxUrls: number,
  spanIndex?: SpanBindingIndex,
): EvidenceClaimBinding {
  const spanMatch = spanIndex?.byClaim.get(claim.trim());
  if (spanMatch && spanMatch.spanIds.length > 0) {
    return {
      claim,
      // An excerpt that supports the claim is the strongest binding available.
      support: 'supported',
      sourceUrls: spanMatch.sourceUrls.slice(0, maxUrls),
      matchScore: 1,
      bindingMethod: 'span',
      evidenceSpanIds: spanMatch.spanIds,
    };
  }

  const scored = sources
    .map((source) => ({
      url: source.url,
      score: scoreEvidenceAgainstSource(claim, source, entityTerms, officialDomains),
    }))
    .filter((row) => row.score >= 0.18)
    .sort((a, b) => b.score - a.score);

  const sourceUrls = [...new Set(scored.map((row) => row.url))].slice(0, maxUrls);
  const matchScore = Number((scored[0]?.score ?? 0).toFixed(3));
  return {
    claim,
    support: supportLevel(matchScore),
    sourceUrls,
    matchScore,
    // Recorded so the UI can say "related source" rather than "evidence".
    bindingMethod: 'lexical',
  };
}

function aggregateSupport(bindings: EvidenceClaimBinding[]): EvidenceSupportLevel {
  if (bindings.length === 0 || bindings.every((binding) => binding.support === 'unsupported')) {
    return 'unsupported';
  }
  if (bindings.every((binding) => binding.support === 'supported')) {
    return 'supported';
  }
  return 'weakly-supported';
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
  opts?: {
    productUrl?: string;
    competitorUrl?: string;
    spanIndex?: SpanBindingIndex;
  },
): Recommendation[] {
  const entityTerms = buildEntityTerms(product, competitor);
  const officialDomains = officialDomainsFromUrls(opts?.productUrl, opts?.competitorUrl);

  return recommendations.map((rec) => {
    const bindings = (rec.evidence ?? [])
      .filter((claim) => claim.trim().length > 0)
      .map((claim) =>
        bindClaim(claim, sources, entityTerms, officialDomains, maxUrls, opts?.spanIndex),
      );
    const sourceUrls = [...new Set(bindings.flatMap((binding) => binding.sourceUrls))]
      .slice(0, maxUrls);
    const evidenceStatus = aggregateSupport(bindings);

    return {
      ...rec,
      sourceUrls,
      evidenceBindings: bindings,
      evidenceStatus,
      confidence:
        evidenceStatus === 'unsupported'
          ? 'low'
          : evidenceStatus === 'weakly-supported' && rec.confidence === 'high'
            ? 'medium'
            : rec.confidence,
      priority:
        evidenceStatus === 'unsupported' && rec.priority === 'immediate'
          ? 'short-term'
          : rec.priority,
    };
  });
}

/**
 * Split prose into sentences and deterministically bind each sentence to source URLs.
 * Used for executive brief / synthesized answer claim binding (AIQ-016).
 */
export function bindProseToSources(
  prose: string,
  sources: AgentSource[],
  product: string,
  competitor?: string,
  maxUrls = 3,
  opts?: {
    productUrl?: string;
    competitorUrl?: string;
    spanIndex?: SpanBindingIndex;
  },
): EvidenceClaimBinding[] {
  if (!prose || typeof prose !== 'string') return [];
  const entityTerms = buildEntityTerms(product, competitor);
  const officialDomains = officialDomainsFromUrls(opts?.productUrl, opts?.competitorUrl);

  // Split into rough sentences (simple heuristic)
  const sentences = prose
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  return sentences.map((sentence) =>
    bindClaim(sentence, sources, entityTerms, officialDomains, maxUrls, opts?.spanIndex),
  );
}
