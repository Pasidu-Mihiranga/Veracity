/**
 * Confidence propagation — pure helpers (unit-testable without DB).
 * Claim confidence rises with more trusted supporting sources.
 */

export function propagateClaimConfidence(supports: Array<{ trust: number }>): number {
  if (supports.length === 0) return 0.4;
  const avgTrust =
    supports.reduce((sum, s) => sum + Math.min(1, Math.max(0, s.trust)), 0) / supports.length;
  const countBoost = Math.min(0.25, Math.log2(1 + supports.length) * 0.1);
  return Math.min(0.98, Math.max(0.2, avgTrust * 0.75 + countBoost + 0.15));
}

export function sourceTrustFromUrl(url: string): number {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (!host) return 0.55;
  if (/(gov|edu|reuters|bloomberg|wsj|ft\.com|techcrunch|forbes)/.test(host)) return 0.9;
  if (/(reddit|hn|news\.ycombinator|medium|substack)/.test(host)) return 0.6;
  return 0.7;
}
