import type {
  AgentOutput,
  ConfidenceLevel,
  CompetitiveOutput,
  OrchestratorOutput,
  PricingOutput,
} from '@/lib/agents/types';
import {
  categorizeEventText,
  severityForSignal,
  type AlertSeverity,
  type EventCategory,
} from '@/lib/monitoring/severity';

export type MonitoringSignalOrigin = 'fact' | 'source' | 'structured' | 'recommendation';

export type MonitoringSignal = {
  id: string;
  category: EventCategory;
  title: string;
  summary: string;
  sourceUrls: string[];
  eventDate?: string;
  confidence: ConfidenceLevel;
  materialityScore: number;
  material: boolean;
  materialityReason: string;
  severity: AlertSeverity;
  origin: MonitoringSignalOrigin;
};

const MATERIALITY_THRESHOLD: Record<EventCategory, number> = {
  pricing: 0.65,
  launch: 0.65,
  feature: 0.65,
  hiring: 0.65,
  leadership: 0.7,
  security: 0.7,
  docs: 0.8,
  sentiment: 0.7,
  funding: 0.7,
  acquisition: 0.7,
  news: 0.7,
  other: 0.9,
};

/**
 * Per-signal collectors turn retrieved facts and source headlines into typed
 * monitoring events. Recommendation titles are retained only as diagnostics:
 * their score is capped below every materiality threshold.
 */
export function collectMonitoringSignals(
  output: OrchestratorOutput | null | undefined,
): MonitoringSignal[] {
  if (!output) return [];
  const candidates: MonitoringSignal[] = [];
  for (const agentOutput of output.outputs ?? []) {
    candidates.push(...signalsFromAgentOutput(agentOutput));
  }
  for (const recommendation of output.topRecommendations ?? []) {
    const text = `${recommendation.title}. ${recommendation.rationale}`.trim();
    candidates.push(buildSignal({
      text,
      origin: 'recommendation',
      sourceUrls: recommendation.sourceUrls ?? [],
      confidence: recommendation.confidence,
    }));
  }
  return dedupeSignals(candidates);
}

export function extractChangedMonitoringSignals(
  prev: OrchestratorOutput | null | undefined,
  next: OrchestratorOutput,
): {
  material: MonitoringSignal[];
  suppressed: MonitoringSignal[];
  allNew: MonitoringSignal[];
} {
  const previous = collectMonitoringSignals(prev);
  const nextSignals = collectMonitoringSignals(next);
  const allNew = nextSignals.filter(
    (candidate) => !previous.some((prior) => equivalentSignal(prior, candidate)),
  );
  const material = allNew
    .filter((signal) => signal.material)
    .sort((a, b) => b.materialityScore - a.materialityScore);
  return {
    material,
    suppressed: allNew.filter((signal) => !signal.material),
    allNew,
  };
}

export function applyWeeklyAlertBudget(
  signals: MonitoringSignal[],
  alreadySent: number,
  weeklyBudget: number,
): {
  deliver: MonitoringSignal[];
  suppressedByBudget: MonitoringSignal[];
} {
  const remaining = Math.max(0, Math.floor(weeklyBudget) - Math.max(0, alreadySent));
  return {
    deliver: signals.slice(0, remaining),
    suppressedByBudget: signals.slice(remaining),
  };
}

function signalsFromAgentOutput(output: AgentOutput): MonitoringSignal[] {
  const sourceUrls = [...new Set(
    (output.sources ?? []).map((source) => source.url).filter(Boolean),
  )].slice(0, 4);
  const latestTimestamp = (output.sources ?? [])
    .map((source) => source.timestamp)
    .filter((timestamp) => !Number.isNaN(Date.parse(timestamp)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const factSignals = (output.facts ?? [])
    .filter((fact) => fact && !fact.startsWith('['))
    .map((fact) => buildSignal({
      text: fact,
      origin: 'fact',
      sourceUrls,
      confidence: output.confidence,
      eventDate: latestTimestamp?.slice(0, 10),
    }));
  const sourceSignals = (output.sources ?? []).map((source) => buildSignal({
    text: source.title,
    origin: 'source',
    sourceUrls: source.url ? [source.url] : [],
    confidence: output.confidence,
    eventDate: source.timestamp?.slice(0, 10),
  }));
  const structuredSignals = structuredTextsFromAgentOutput(output).map((text) => buildSignal({
    text,
    origin: 'structured',
    sourceUrls,
    confidence: output.confidence,
    eventDate: latestTimestamp?.slice(0, 10),
  }));
  return [...factSignals, ...structuredSignals, ...sourceSignals];
}

function structuredTextsFromAgentOutput(output: AgentOutput): string[] {
  if (output.artifactType === 'pricing-table') {
    const pricing = output as PricingOutput;
    return [
      ...(pricing.competitorPricing ?? []).map((tier) =>
        `Pricing tier ${tier.tierName}: ${tier.price}; target ${tier.targetSegment}.`,
      ),
      ...(pricing.pricingSignals ?? []),
    ];
  }
  if (output.artifactType === 'competitive-matrix') {
    const competitive = output as CompetitiveOutput;
    return [
      ...(competitive.hiringSignals ?? []),
      ...(competitive.recentMoves ?? []),
    ];
  }
  return [];
}

function buildSignal(input: {
  text: string;
  origin: MonitoringSignalOrigin;
  sourceUrls: string[];
  confidence: ConfidenceLevel;
  eventDate?: string;
}): MonitoringSignal {
  const summary = cleanText(input.text);
  const category = categorizeEventText(summary);
  const scored = scoreMateriality(summary, category, input.origin);
  const groundedScore = input.sourceUrls.length > 0
    ? scored.score
    : Math.min(scored.score, 0.49);
  const threshold = MATERIALITY_THRESHOLD[category];
  const material = input.origin !== 'recommendation' && groundedScore >= threshold;
  return {
    id: stableSignalId(category, summary),
    category,
    title: titleForSignal(category, summary),
    summary,
    sourceUrls: [...new Set(input.sourceUrls)].slice(0, 4),
    eventDate: validDate(input.eventDate) ? input.eventDate : undefined,
    confidence: input.confidence,
    materialityScore: Number(groundedScore.toFixed(2)),
    material,
    materialityReason: input.sourceUrls.length === 0
      ? 'Suppressed because no retrieved source URL grounds this signal.'
      : scored.reason,
    severity: severityForSignal(category, groundedScore, summary),
    origin: input.origin,
  };
}

function scoreMateriality(
  text: string,
  category: EventCategory,
  origin: MonitoringSignalOrigin,
): { score: number; reason: string } {
  if (origin === 'recommendation') {
    return {
      score: 0.25,
      reason: 'Recommendation-title changes are diagnostic only and cannot trigger alerts.',
    };
  }
  switch (category) {
    case 'acquisition':
      return { score: 0.96, reason: 'M&A changes ownership and competitive structure.' };
    case 'security':
      return /\b(breach|ransomware|data leak|critical|cve-\d+)\b/i.test(text)
        ? { score: 0.95, reason: 'Material security incident or vulnerability.' }
        : { score: 0.72, reason: 'Material security or compliance posture change.' };
    case 'leadership':
      return /\b(appointed|resigned|steps down|joins as|named|new ceo|new cto|new cfo)\b/i.test(text)
        ? { score: 0.88, reason: 'Named executive appointment or departure.' }
        : { score: 0.55, reason: 'Generic leadership mention without a confirmed change.' };
    case 'funding':
      return /(?:[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:m|b|million|billion)\b|series [a-d]|seed round)/i.test(text)
        ? { score: 0.92, reason: 'Quantified or named financing event.' }
        : { score: 0.68, reason: 'Funding language without a quantified or named round.' };
    case 'pricing':
      if (/\b(increas|decreas|raised|lowered|from .{0,25} to|new tier|removed.*plan|introduced.*plan)\b/i.test(text)) {
        return { score: 0.92, reason: 'Explicit pricing or packaging change.' };
      }
      if (/(?:[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:per user|\/mo|\/month|annual))|free tier|enterprise tier/i.test(text)) {
        return { score: 0.74, reason: 'Concrete price or tier signal.' };
      }
      return { score: 0.45, reason: 'Generic pricing mention without a changed amount or tier.' };
    case 'launch':
      return { score: 0.82, reason: 'Confirmed launch or general-availability signal.' };
    case 'feature':
      return /\b(shipped|released|introduced|added|now available|rollout|launched)\b/i.test(text)
        ? { score: 0.72, reason: 'Confirmed feature availability change.' }
        : { score: 0.48, reason: 'Feature mention without a confirmed availability change.' };
    case 'hiring':
      return /(?:\b\d+\b.*\b(?:roles|jobs|employees|headcount)\b|\blayoff|restructur|hiring spree|workforce)/i.test(text)
        ? { score: 0.82, reason: 'Quantified or directional workforce change.' }
        : { score: 0.48, reason: 'Isolated job or generic hiring mention.' };
    case 'sentiment':
      return /\b(backlash|outage|surge|spike|widespread|repeated|boycott|complaints? rose)\b/i.test(text)
        ? { score: 0.76, reason: 'Material sentiment shift or repeated complaint pattern.' }
        : { score: 0.34, reason: 'Single community mention; insufficient for a sentiment shift.' };
    case 'news':
      return /\b(lawsuit|regulator|investigation|partnership|partnered|settlement)\b/i.test(text)
        ? { score: 0.72, reason: 'Material legal, regulatory, or partnership news.' }
        : { score: 0.4, reason: 'Generic news mention without a strategic change.' };
    case 'docs':
      return { score: 0.2, reason: 'Documentation wording alone is non-material.' };
    case 'other':
    default:
      return { score: 0.1, reason: 'No material event pattern was detected.' };
  }
}

function equivalentSignal(left: MonitoringSignal, right: MonitoringSignal): boolean {
  if (left.category !== right.category) return false;
  if (left.id === right.id) return true;
  const a = tokenSet(left.summary);
  const b = tokenSet(right.summary);
  if (a.size === 0 || b.size === 0) return false;
  const overlap = [...a].filter((token) => b.has(token)).length;
  const similarity = overlap / Math.max(a.size, b.size);
  if (left.category === 'pricing' || left.category === 'funding') {
    const leftNumbers = numericTokens(left.summary);
    const rightNumbers = numericTokens(right.summary);
    if (leftNumbers.length > 0 && rightNumbers.length > 0) {
      return leftNumbers.join('|') === rightNumbers.join('|') && similarity >= 0.3;
    }
  }
  return similarity >= 0.82;
}

function dedupeSignals(signals: MonitoringSignal[]): MonitoringSignal[] {
  const deduped = new Map<string, MonitoringSignal>();
  for (const signal of signals) {
    const current = deduped.get(signal.id);
    if (
      !current
      || signal.materialityScore > current.materialityScore
      || signal.sourceUrls.length > current.sourceUrls.length
    ) {
      deduped.set(signal.id, signal);
    }
  }
  return [...deduped.values()];
}

function titleForSignal(category: EventCategory, text: string): string {
  const label = category === 'acquisition'
    ? 'Acquisition'
    : category.charAt(0).toUpperCase() + category.slice(1);
  const trimmed = text.length > 110 ? `${text.slice(0, 107).trim()}…` : text;
  return `${label}: ${trimmed}`;
}

function stableSignalId(category: EventCategory, text: string): string {
  const normalized = cleanText(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) | 0;
  }
  return `${category}_${(hash >>> 0).toString(16)}`;
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value.toLowerCase().split(/[^a-z0-9$€£]+/).filter((token) => token.length > 2),
  );
}

function numericTokens(value: string): string[] {
  return [...value.matchAll(/[$€£]?\s?\d+(?:[.,]\d+)?\s?(?:m|b|million|billion|%|\/mo|\/month)?/gi)]
    .map((match) => match[0].replace(/\s+/g, '').toLowerCase())
    .sort();
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function validDate(value?: string): value is string {
  return Boolean(value) && !Number.isNaN(Date.parse(value!));
}

