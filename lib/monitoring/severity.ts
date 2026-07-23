export type EventCategory =
  | 'pricing'
  | 'launch'
  | 'feature'
  | 'hiring'
  | 'docs'
  | 'sentiment'
  | 'funding'
  | 'other';

export type AlertSeverity = 'high' | 'medium' | 'low';

/** Deterministic severity from category — never trust LLM severity. */
export function severityFromCategory(category: EventCategory): AlertSeverity {
  switch (category) {
    case 'pricing':
    case 'launch':
    case 'funding':
      return 'high';
    case 'feature':
    case 'hiring':
      return 'medium';
    case 'docs':
    case 'sentiment':
    case 'other':
    default:
      return 'low';
  }
}

/** Heuristic category from free-text title/summary. */
export function categorizeEventText(text: string): EventCategory {
  const t = text.toLowerCase();
  if (/\b(pric(e|ing)|wtp|tier|discount|packag)/i.test(t)) return 'pricing';
  if (/\b(launch|ga\b|generally available|release|unveil)/i.test(t)) return 'launch';
  if (/\b(fund|acqui|merger|series [a-d]|raised)/i.test(t)) return 'funding';
  if (/\b(feature|integrat|ai\b|model|capability)/i.test(t)) return 'feature';
  if (/\b(hir(e|ing)|layoff|headcount|job)/i.test(t)) return 'hiring';
  if (/\b(doc|changelog|readme|docs\b)/i.test(t)) return 'docs';
  if (/\b(reddit|hacker news|\bhn\b|thread|complaint)/i.test(t)) return 'sentiment';
  return 'other';
}
