/** Confidence → TTL for Cross-Agent Memory aging */

export function ttlMsFromConfidence(confidence: number): number {
  const c = Math.min(1, Math.max(0, confidence));
  if (c >= 0.8) return 30 * 24 * 60 * 60 * 1000; // 30d
  if (c >= 0.5) return 7 * 24 * 60 * 60 * 1000; // 7d
  return 36 * 60 * 60 * 1000; // 36h
}

export function expiresAtFromConfidence(confidence: number, now = Date.now()): Date {
  return new Date(now + ttlMsFromConfidence(confidence));
}
