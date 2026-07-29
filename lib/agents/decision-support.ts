import type {
  AgentOutput,
  BoardPack,
  DecisionFrame,
  EvidenceSupportLevel,
  ExecutiveContentContract,
  Recommendation,
  RecommendationPattern,
} from '@/lib/agents/types';

const IMPACT_SCORE = { high: 24, medium: 14, low: 6 } as const;
const EFFORT_PENALTY = { low: 0, medium: 6, high: 12 } as const;
const PRIORITY_SCORE = { immediate: 24, 'short-term': 16, strategic: 10 } as const;
const CONFIDENCE_SCORE = { high: 14, medium: 8, low: 3 } as const;
const EVIDENCE_SCORE: Record<EvidenceSupportLevel, number> = {
  supported: 18,
  'weakly-supported': 9,
  unsupported: 0,
};

type Preference = {
  title: string;
  pattern: RecommendationPattern;
  direction: 'accepted' | 'rejected';
};

export function recommendationPattern(value: string): RecommendationPattern {
  const text = value.toLowerCase();
  if (/\b(price|pricing|package|tier|moneti[sz]|discount)\b/.test(text)) return 'pricing';
  if (/\b(build|ship|product|feature|integration|api|roadmap)\b/.test(text)) return 'product';
  if (/\b(position|message|brand|narrative|category)\b/.test(text)) return 'positioning';
  if (/\b(customer|buyer|retention|churn|reference|review)\b/.test(text)) return 'customer';
  if (/\b(market|segment|category|demand|growth)\b/.test(text)) return 'market';
  if (/\b(risk|security|legal|compliance|dependency|threat)\b/.test(text)) return 'risk';
  if (/\b(research|verify|validate|audit|investigate|measure|test)\b/.test(text)) return 'research';
  if (/\b(execute|launch|campaign|outreach|sell|deploy)\b/.test(text)) return 'execution';
  return 'general';
}

export function extractRecommendationPreferences(context?: string): Preference[] {
  if (!context) return [];
  const preferences: Preference[] = [];
  for (const line of context.split('\n')) {
    const accepted = line.match(/(?:Action accepted:|Feedback up:|-\s*ACCEPT(?:ED)?:)\s*(.+)/i);
    const rejected = line.match(/(?:Action rejected:|Feedback down:|-\s*REJECT(?:ED)?:)\s*(.+)/i);
    const match = accepted ?? rejected;
    if (!match?.[1]) continue;
    const title = match[1].split(/\s+because\s+|·|\(confidence/i)[0].trim();
    if (!title) continue;
    preferences.push({
      title,
      pattern: recommendationPattern(title),
      direction: accepted ? 'accepted' : 'rejected',
    });
  }
  return preferences.slice(0, 20);
}

export function rankRecommendations(input: {
  recommendations: Recommendation[];
  learningContext?: string;
  fallbackFalsifiers?: string[];
}): Recommendation[] {
  const preferences = extractRecommendationPreferences(input.learningContext);
  const candidates = input.recommendations.length > 0
    ? input.recommendations
    : [{
        title: 'Resolve the highest-priority evidence gap',
        rationale: 'The research run did not produce a decision-grade recommendation, so verify the most material unknown before committing resources.',
        evidence: ['not enough evidence'],
        confidence: 'low' as const,
        priority: 'short-term' as const,
        evidenceStatus: 'unsupported' as const,
        sourceUrls: [],
        evidenceBindings: [],
      }];
  const enriched = candidates.map((recommendation, index) => {
    const pattern = recommendation.pattern ?? recommendationPattern(
      `${recommendation.title} ${recommendation.rationale}`,
    );
    const inferredImpact = inferImpact(recommendation);
    const impact = recommendation.evidenceStatus === 'unsupported'
      ? 'low'
      : recommendation.evidenceStatus === 'weakly-supported' && recommendation.impact === 'high'
        ? 'medium'
        : recommendation.impact ?? inferredImpact;
    const effort = recommendation.effort ?? inferEffort(recommendation);
    const adjustment = learningAdjustment(recommendation.title, pattern, preferences);
    const evidenceStatus = recommendation.evidenceStatus ?? 'unsupported';
    const rawScore =
      PRIORITY_SCORE[recommendation.priority]
      + IMPACT_SCORE[impact]
      - EFFORT_PENALTY[effort]
      + CONFIDENCE_SCORE[recommendation.confidence]
      + EVIDENCE_SCORE[evidenceStatus]
      + adjustment.delta
      - index * 0.01;
    const decisionScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    return {
      ...recommendation,
      pattern,
      impact,
      effort,
      // Canonical relative windows avoid stale model-authored calendar dates.
      timing: timingForPriority(recommendation.priority),
      ownerSuggestion: recommendation.ownerSuggestion ?? ownerForPattern(pattern),
      dependencies: recommendation.dependencies?.length
        ? recommendation.dependencies
        : dependenciesFor(recommendation),
      riskOfInaction: recommendation.evidenceStatus === 'unsupported'
        ? 'Delay leaves the decision unresolved, but the current evidence does not establish a quantified downside.'
        : recommendation.evidenceStatus === 'weakly-supported'
          ? 'Delay may postpone the potential benefit, but the downside magnitude remains directional.'
          : recommendation.riskOfInaction
            ?? `The opportunity described in “${recommendation.title}” may weaken while the underlying risk remains unresolved.`,
      falsifier: recommendation.falsifier
        ?? input.fallbackFalsifiers?.[index % Math.max(1, input.fallbackFalsifiers.length)]
        ?? `New primary evidence showing that ${recommendation.title.toLowerCase()} would not improve the decision outcome.`,
      decisionScore,
      learningAdjustment: adjustment,
    };
  });

  return enriched
    .sort((a, b) => (b.decisionScore ?? 0) - (a.decisionScore ?? 0))
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

export function buildDecisionFrame(input: {
  answer: string;
  recommendations: Recommendation[];
  unknowns: string[];
  evidenceLimitations: string[];
  falsifiers: string[];
  parsed?: Partial<DecisionFrame>;
}): DecisionFrame {
  // The model cannot self-certify option support. Build options only from
  // claim-bound, structurally ranked recommendations.
  const options = input.recommendations.slice(0, 3).map((recommendation) => ({
    label: recommendation.title,
    tradeoff: recommendation.evidenceStatus === 'unsupported'
      ? 'Retrieved evidence does not establish this option’s trade-off; verify it before choosing.'
      : recommendation.rationale,
    evidenceStatus: recommendation.evidenceStatus ?? 'unsupported',
  }));
  const risks = [
    ...input.recommendations.map((recommendation) => recommendation.riskOfInaction ?? ''),
    ...input.unknowns,
    ...input.evidenceLimitations,
  ].filter(uniqueNonEmpty).slice(0, 6);
  const falsifiers = [
    ...(input.parsed?.falsifiers ?? []),
    ...input.falsifiers,
    ...input.recommendations.map((recommendation) => recommendation.falsifier ?? ''),
  ].filter(uniqueNonEmpty).slice(0, 5);

  return {
    situation: input.answer.split(/\n|(?<=[.!?])\s+/)[0]
      || 'The decision requires additional evidence.',
    options,
    criteria: (input.parsed?.criteria?.length
      ? input.parsed.criteria
      : ['Evidence strength', 'Expected impact', 'Effort and timing', 'Reversibility', 'Risk of inaction'])
      .filter(uniqueNonEmpty)
      .slice(0, 6),
    recommendation: input.recommendations[0]?.title
      || input.parsed?.recommendation?.trim()
      || 'Defer the decision until the highest-priority evidence gap is resolved.',
    risks,
    falsifiers,
  };
}

export function buildBoardPack(input: {
  product: string;
  competitor?: string;
  answer: string;
  decisionFrame: DecisionFrame;
  recommendations: Recommendation[];
  outputs: AgentOutput[];
  learningContext?: string;
  generatedAt: string;
}): BoardPack {
  const evidenceBullets = input.outputs
    .flatMap((output) => output.facts)
    .filter(uniqueNonEmpty)
    .slice(0, 6);
  const sources = [...new Map(
    input.outputs
      .flatMap((output) => output.sources)
      .filter((source) => source.url)
      .map((source) => [source.url, source]),
  ).values()];
  const sourceTimeline = sources
    .map((source) => ({
      date: source.timestamp,
      label: source.title || 'Retrieved evidence',
      detail: `Retrieved via ${source.tool}.`,
      sourceUrl: source.url,
    }))
    .filter((item) => !Number.isNaN(Date.parse(item.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 8);
  const entityTerms = [input.product, input.competitor]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const eventTimeline = (input.learningContext ?? '')
    .split('\n')
    .filter((line) => line.startsWith('- EVENT|'))
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 7)
    .filter((parts) => {
      const eventEntities = `${parts[2]} ${parts[3]}`.toLowerCase();
      return entityTerms.length === 0 || entityTerms.some((term) => eventEntities.includes(term));
    })
    .map((parts) => ({
      date: parts[1],
      label: `${parts[4]} · ${parts[5]}`,
      detail: parts[6],
      sourceUrl: parts[7] || undefined,
    }))
    .filter((item) => !Number.isNaN(Date.parse(item.date)));
  const timeline = [...eventTimeline, ...sourceTimeline]
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.date === item.date && candidate.label === item.label,
      ) === index,
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 8);
  const decisionMemory = (input.learningContext ?? '')
    .split('\n')
    .filter((line) => /^-\s*(?:ACCEPT|REJECT|DEFER|Action accepted|Action rejected)/i.test(line.trim()))
    .map((line) => line.replace(/^-\s*/, '').trim())
    .slice(0, 6);
  const top = input.recommendations[0];

  return {
    title: `${input.product}${input.competitor ? ` vs ${input.competitor}` : ''} decision pack`,
    executiveBrief: input.answer,
    decision: input.decisionFrame,
    sections: [
      { id: 'situation', title: 'Situation', bullets: [input.decisionFrame.situation] },
      { id: 'options', title: 'Options', bullets: input.decisionFrame.options.map((option) => `${option.label}: ${option.tradeoff}`) },
      { id: 'criteria', title: 'Decision criteria', bullets: input.decisionFrame.criteria },
      { id: 'recommendation', title: 'Recommendation', bullets: top ? [`#${top.rank} ${top.title}`, top.rationale] : [input.decisionFrame.recommendation] },
      { id: 'risks', title: 'Risks', bullets: input.decisionFrame.risks },
      { id: 'falsifiers', title: 'What would change this', bullets: input.decisionFrame.falsifiers },
      { id: 'evidence', title: 'Evidence', bullets: evidenceBullets },
    ],
    timeline,
    decisionMemory,
    generatedAt: input.generatedAt,
  };
}

export function buildExecutiveContent(input: {
  answer: string;
  recommendations: Recommendation[];
  assumptions: string[];
  unknowns: string[];
  evidenceLimitations: string[];
  whatWouldChangeThis: string[];
  alternativeHypotheses: string[];
  confidenceDrivers: { supports: string[]; weakens: string[] };
}): ExecutiveContentContract {
  return {
    brief: input.answer,
    rankedRecommendationTitles: input.recommendations.map(
      (recommendation) => `#${recommendation.rank ?? '?'} ${recommendation.title}`,
    ),
    decisionAppendix: {
      assumptions: input.assumptions,
      unknowns: input.unknowns,
      evidenceLimitations: input.evidenceLimitations,
      whatWouldChangeThis: input.whatWouldChangeThis,
      alternativeHypotheses: input.alternativeHypotheses,
      confidenceDrivers: input.confidenceDrivers,
    },
  };
}

function inferImpact(recommendation: Recommendation): 'high' | 'medium' | 'low' {
  if (recommendation.evidenceStatus === 'supported' && recommendation.confidence === 'high') return 'high';
  if (recommendation.evidenceStatus === 'unsupported' || recommendation.confidence === 'low') return 'low';
  return 'medium';
}

function inferEffort(recommendation: Recommendation): 'high' | 'medium' | 'low' {
  const text = `${recommendation.title} ${recommendation.rationale}`.toLowerCase();
  if (/\b(verify|validate|test|measure|interview|audit|publish)\b/.test(text)) return 'low';
  if (/\b(build|migrate|platform|architecture|enterprise-wide|restructure)\b/.test(text)) return 'high';
  return 'medium';
}

function timingForPriority(priority: Recommendation['priority']): string {
  if (priority === 'immediate') return '0–30 days';
  if (priority === 'short-term') return '30–90 days';
  return 'Next 2–4 quarters';
}

function ownerForPattern(pattern: RecommendationPattern): string {
  const owners: Record<RecommendationPattern, string> = {
    pricing: 'Finance + Growth',
    product: 'Product + Engineering',
    positioning: 'Marketing + Product',
    customer: 'Customer Success + Sales',
    market: 'Strategy + Growth',
    risk: 'Executive sponsor + Risk owner',
    research: 'Strategy / Research',
    execution: 'Growth / GTM',
    general: 'Executive sponsor',
  };
  return owners[pattern];
}

function dependenciesFor(recommendation: Recommendation): string[] {
  if (recommendation.evidenceStatus === 'unsupported') {
    return ['Resolve the unsupported evidence claim before committing resources.'];
  }
  if (recommendation.evidenceStatus === 'weakly-supported') {
    return ['Validate with one primary source or controlled test.'];
  }
  return [];
}

function learningAdjustment(
  title: string,
  pattern: RecommendationPattern,
  preferences: Preference[],
): { delta: number; reason: string } {
  let delta = 0;
  const reasons: string[] = [];
  for (const preference of preferences) {
    const overlap = tokenOverlap(title, preference.title);
    const samePattern = pattern !== 'general' && pattern === preference.pattern;
    if (overlap < 0.2 && !samePattern) continue;
    const exactWeight = overlap >= 0.5;
    if (preference.direction === 'accepted') {
      delta += exactWeight ? 18 : 8;
      reasons.push(`boosted by accepted ${preference.pattern} pattern`);
    } else {
      delta -= exactWeight ? 28 : 14;
      reasons.push(`downranked by rejected ${preference.pattern} pattern`);
    }
  }
  const bounded = Math.max(-35, Math.min(24, delta));
  return {
    delta: bounded,
    reason: reasons.length > 0
      ? [...new Set(reasons)].join('; ')
      : 'No matching accept/reject preference.',
  };
}

function tokenOverlap(left: string, right: string): number {
  const tokens = (value: string) => new Set(
    value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2),
  );
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.max(a.size, b.size);
}

function uniqueNonEmpty(value: string, index: number, all: string[]): boolean {
  return Boolean(value?.trim()) && all.indexOf(value) === index;
}

