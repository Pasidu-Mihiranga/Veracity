import type {
  AgentOutput,
  AgentSource,
  ConfidenceLevel,
  OutputQualityReport,
  Recommendation,
} from '@/lib/agents/types';
import { scoreToLevel } from '@/lib/agents/types';
import {
  buildEntityTerms,
  filterSourcesByEntityRelevance,
  sourceMatchesEntities,
} from '@/lib/tools/source-relevance';

export type { OutputQualityReport };

export type QualityGuardedSynthesis = {
  answer: string;
  recommendations: Recommendation[];
  followUps: string[];
  totalConfidence: ConfidenceLevel;
  confidenceScore: number;
  quality: OutputQualityReport;
};

function downgradeConfidence(level: ConfidenceLevel): ConfidenceLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

function looksLikePersonHomonymNoise(sources: AgentSource[], product: string): boolean {
  const name = product.trim().toLowerCase();
  if (name.length < 3 || name === 'unknown product') return false;
  const productTerms = buildEntityTerms(product);

  // If 2 or more valid product/software sources exist (e.g. clay.com, G2, pricing, enrichment), it's not noise
  const companySources = sources.filter((s) => {
    const url = (s.url ?? '').toLowerCase();
    const title = (s.title ?? '').toLowerCase();
    return (
      url.includes(`${name}.com`) ||
      url.includes('g2.com') ||
      url.includes('capterra.com') ||
      url.includes('producthunt.com') ||
      /\b(pricing|enrichment|software|platform|b2b|outreach|sdr|features|workflow)\b/i.test(title)
    );
  });
  if (companySources.length >= 2) return false;

  // Only personal profiles / bios — NOT linkedin.com/company, posts, or any URL that
  // merely contains the word "linkedin" (that false-flagged Notion with 54 matched sources).
  const personProfiles = sources.filter((s) => {
    if (!sourceMatchesEntities(s, productTerms)) return false;
    const url = (s.url ?? '').toLowerCase();
    const title = (s.title ?? '').toLowerCase();
    const isPersonalLinkedIn = /linkedin\.com\/in\//i.test(url);
    const isResumeOrSchoolBio =
      /\b(cv|resume)\b/i.test(title) ||
      /\b(school of business|professor|phd student|student at)\b/i.test(title);
    return isPersonalLinkedIn || isResumeOrSchoolBio;
  });

  if (personProfiles.length < 2) return false;
  return personProfiles.length >= Math.ceil(sources.length * 0.4);
}

function hasContradictoryFraming(text: string): boolean {
  const lower = text.toLowerCase();
  const industrial =
    /\b(aerospace|missile|manufacturing|industrial agent|industrial)\b/.test(lower);
  const realEstate =
    /\b(real estate|property acquisition|property and business)\b/.test(lower);
  return industrial && realEstate;
}

/**
 * Assess grounding quality from sources + draft synthesis text.
 */
export function assessOutputQuality(input: {
  product: string;
  competitor?: string;
  sources: AgentSource[];
  answer: string;
  recommendations: Recommendation[];
  agentConfidenceAvg: number;
}): OutputQualityReport {
  const terms = buildEntityTerms(input.product, input.competitor);
  const relevance = filterSourcesByEntityRelevance(input.sources, terms);
  const matchedSourceCount = input.sources.filter((s) =>
    sourceMatchesEntities(s, terms),
  ).length;

  const flags: string[] = [];

  if (terms.length === 0 || input.product.toLowerCase() === 'unknown product') {
    flags.push('weak_entity_resolution');
  }
  if (relevance.matchRatio < 0.35) {
    flags.push('low_entity_source_match');
  }
  if (matchedSourceCount < 3) {
    flags.push('thin_entity_evidence');
  }
  if (looksLikePersonHomonymNoise(input.sources, input.product)) {
    flags.push('person_homonym_noise');
  }

  const combinedText = [
    input.answer,
    ...input.recommendations.map((r) => `${r.title} ${r.rationale}`),
  ].join('\n');
  if (hasContradictoryFraming(combinedText)) {
    flags.push('contradictory_strategy_framing');
  }

  const agentAvg = Math.max(0, Math.min(1, input.agentConfidenceAvg));
  const entityMatch = Math.max(0, Math.min(1, relevance.matchRatio));
  // Tool health proxy: enough matched sources and non-empty pool
  const toolHealth = Math.max(
    0,
    Math.min(
      1,
      input.sources.length === 0
        ? 0
        : 0.35 * Math.min(input.sources.length / 10, 1) +
          0.65 * Math.min(matchedSourceCount / 8, 1),
    ),
  );

  // Blend tool/agent confidence with evidence match
  const evidenceScore = Math.max(
    0,
    Math.min(
      1,
      agentAvg * 0.45 + entityMatch * 0.4 + Math.min(matchedSourceCount / 8, 1) * 0.15,
    ),
  );

  // Strong grounding (e.g. Notion with dozens of on-brand sources) must not abstain
  // just because LinkedIn discussions mention the product.
  const strongGrounding =
    relevance.matchRatio >= 0.7 && matchedSourceCount >= 6;

  const shouldAbstainFromStrongClaims =
    flags.includes('weak_entity_resolution') ||
    flags.includes('low_entity_source_match') ||
    flags.includes('thin_entity_evidence') ||
    flags.includes('contradictory_strategy_framing') ||
    (flags.includes('person_homonym_noise') && !strongGrounding) ||
    (!strongGrounding && evidenceScore < 0.45);

  // Gate score drops when abstaining / flagged
  const qualityGate = shouldAbstainFromStrongClaims
    ? Math.min(evidenceScore, 0.42)
    : evidenceScore;

  return {
    evidenceScore,
    sourceMatchRatio: relevance.matchRatio,
    matchedSourceCount,
    totalSourceCount: input.sources.length,
    flags,
    shouldAbstainFromStrongClaims,
    toolHealth,
    entityMatch,
    agentAvg,
    qualityGate,
  };
}

/**
 * Apply quality gate: lower confidence, soften recommendations, prepend caution
 * when evidence is thin or noisy — reduces hallucinated decisive pivots.
 */
export function applyOutputQualityGate(input: {
  product: string;
  competitor?: string;
  sources: AgentSource[];
  answer: string;
  recommendations: Recommendation[];
  followUps: string[];
  agentConfidenceAvg: number;
}): QualityGuardedSynthesis {
  const quality = assessOutputQuality(input);
  let { answer, recommendations, followUps } = input;
  let confidenceScore = quality.evidenceScore;

  if (quality.shouldAbstainFromStrongClaims) {
    confidenceScore = Math.min(confidenceScore, 0.42);
    recommendations = recommendations.map((r) => ({
      ...r,
      confidence: downgradeConfidence(r.confidence),
      priority: r.priority === 'immediate' ? 'short-term' : r.priority,
      title: r.title,
      rationale: `${r.rationale} Double-check this before acting — evidence for "${input.product}" is limited.`,
    }));

    const caution =
      `Heads up: we're not fully sure the sources are about the right "${input.product}"` +
      ` (${quality.matchedSourceCount} of ${quality.totalSourceCount} sources matched the name). ` +
      `Treat this as a draft hypothesis — if this is the wrong company, add the official website and rerun.\n\n`;

    if (!/^heads up:/i.test(answer) && !/evidence quality check/i.test(answer)) {
      answer = caution + answer;
    }

    const needsIdentityClarify =
      quality.flags.includes('person_homonym_noise') ||
      quality.flags.includes('weak_entity_resolution') ||
      quality.flags.includes('thin_entity_evidence');

    if (needsIdentityClarify) {
      const clarifyUps = [
        `What is the official website for ${input.product}?`,
        `Just to confirm: is ${input.product} a software product?`,
      ];
      followUps = [...clarifyUps, ...followUps].slice(0, 3);
    }
  }

  return {
    answer,
    recommendations,
    followUps,
    totalConfidence: scoreToLevel(confidenceScore),
    confidenceScore,
    quality,
  };
}

/** Filter each agent output's sources to entity-relevant links when possible. */
export function applyEntitySourceFilterToOutputs(
  outputs: AgentOutput[],
  product: string,
  competitor?: string,
): { outputs: AgentOutput[]; aggregateMatchRatio: number } {
  const terms = buildEntityTerms(product, competitor);
  let matched = 0;
  let total = 0;

  const next = outputs.map((output) => {
    total += output.sources.length;
    const { kept, matchRatio } = filterSourcesByEntityRelevance(output.sources, terms);
    matched += Math.round(matchRatio * output.sources.length);
    // Prefer entity-matched list when we have any matches
    const sources =
      matchRatio > 0 && kept.length > 0 && kept.length < output.sources.length
        ? kept
        : matchRatio === 0
          ? output.sources // keep for audit; quality gate will abstain
          : kept;
    return { ...output, sources };
  });

  return {
    outputs: next,
    aggregateMatchRatio: total > 0 ? matched / total : 0,
  };
}
