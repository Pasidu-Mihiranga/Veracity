export type DecisionOutcome =
  | 'pending'
  | 'validated'
  | 'invalidated'
  | 'adopted_after_reject';

export function confidenceFromRecLevel(level?: string): number {
  if (level === 'high') return 0.85;
  if (level === 'low') return 0.4;
  return 0.65;
}

export function applyOutcomeConfidence(
  current: number,
  outcome: DecisionOutcome,
): number {
  if (outcome === 'validated') return Math.min(1, Number((current + 0.12).toFixed(2)));
  if (outcome === 'invalidated') return Math.max(0, Number((current - 0.15).toFixed(2)));
  if (outcome === 'adopted_after_reject') return Math.min(1, Number((current + 0.05).toFixed(2)));
  return current;
}
