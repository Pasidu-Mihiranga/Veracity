export type EventCategory =
  | 'pricing'
  | 'launch'
  | 'feature'
  | 'hiring'
  | 'leadership'
  | 'security'
  | 'docs'
  | 'sentiment'
  | 'funding'
  | 'acquisition'
  | 'news'
  | 'other';

export type AlertSeverity = 'high' | 'medium' | 'low';

/** Deterministic severity from category — never trust LLM severity. */
export function severityFromCategory(category: EventCategory): AlertSeverity {
  switch (category) {
    case 'pricing':
    case 'launch':
    case 'funding':
    case 'acquisition':
    case 'security':
      return 'high';
    case 'feature':
    case 'hiring':
    case 'leadership':
      return 'medium';
    case 'docs':
    case 'sentiment':
    case 'news':
    case 'other':
    default:
      return 'low';
  }
}

/** Heuristic category from free-text title/summary. */
export function categorizeEventText(text: string): EventCategory {
  const t = text.toLowerCase();
  if (/\b(pric(e|ing)|wtp|tier|discount|packag)/i.test(t)) return 'pricing';
  if (/\b(acqui(?:re|red|res|sition)|merger|takeover|buyout|purchased by)\b/i.test(t)) return 'acquisition';
  if (/\b(breach|vulnerabilit|cve-\d+|ransomware|security incident|soc ?2|iso ?27001|data leak)\b/i.test(t)) return 'security';
  if (/\b(ceo|cto|cfo|chief \w+ officer|founder|executive|leadership|appointed|resigned|steps down|joins as)\b/i.test(t)) return 'leadership';
  if (/\b(launch|ga\b|generally available|release|unveil)/i.test(t)) return 'launch';
  if (/\b(fund|financing|series [a-d]|raised|venture round|seed round)\b/i.test(t)) return 'funding';
  if (/\b(feature|integrat|ai\b|model|capability)/i.test(t)) return 'feature';
  if (/\b(hir(e|ing)|layoff|headcount|job)/i.test(t)) return 'hiring';
  if (/\b(doc|changelog|readme|docs\b)/i.test(t)) return 'docs';
  if (/\b(reddit|hacker news|\bhn\b|thread|complaint)/i.test(t)) return 'sentiment';
  if (/\b(news|announc|partnership|partnered|lawsuit|regulator|award)\b/i.test(t)) return 'news';
  return 'other';
}

/** Severity matrix uses both event kind and measured materiality. */
export function severityForSignal(
  category: EventCategory,
  materialityScore: number,
  text = '',
): AlertSeverity {
  if (
    category === 'acquisition'
    || category === 'security' && /\b(breach|ransomware|data leak|critical|cve-)\b/i.test(text)
    || category === 'pricing' && materialityScore >= 0.7
    || category === 'funding' && materialityScore >= 0.75
  ) {
    return 'high';
  }
  if (
    materialityScore >= 0.8
    || category === 'leadership'
    || category === 'launch'
    || category === 'feature'
    || category === 'hiring'
    || category === 'security'
  ) {
    return 'medium';
  }
  return 'low';
}
