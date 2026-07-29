import type {
  AgentOutput,
  AgentSource,
  CompetitiveOutput,
  ConfidenceLevel,
  MindMapNode,
  MindMapOutput,
  MarketTrendsOutput,
  OutputQualityReport,
  Recommendation,
} from '@/lib/agents/types';
import { scoreToLevel } from '@/lib/agents/types';
import {
  buildEntityTerms,
  filterSourcesByEntityRelevance,
  isPersonOrSchoolBioSource,
  officialDomainsFromUrls,
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

const CONTEXT_ONLY_LABEL = 'Category context only';

const STAGE1_DOMAINS = new Set([
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
]);

function downgradeConfidence(level: ConfidenceLevel): ConfidenceLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip product/competitor name from category noise; prefix as unverified. */
export function sanitizeCategorySignal(
  text: string,
  product: string,
  competitor?: string,
): string {
  let next = text.trim();
  if (!next) return next;

  const names = [product, competitor]
    .filter((n): n is string => Boolean(n && n.trim().length >= 2))
    .filter((n) => !/^(unknown product|relevant competitors)$/i.test(n.trim()));

  for (const name of names) {
    next = next.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'), 'this category');
  }

  // Collapse awkward doubles from replacement
  next = next.replace(/\bthis category(?:\s+this category)+\b/gi, 'this category');

  if (!/^category signal\b/i.test(next)) {
    next = `Category signal (entity unverified): ${next}`;
  }
  return next;
}

function buildIdentityFirstBranches(product: string): MindMapNode[] {
  const name = product.trim() || 'this subject';
  return [
    {
      id: 'branch-1',
      label: 'Confirm official URL',
      detail: `Entity match for "${name}" is weak — resolve the official website before strategy.`,
      sentiment: 'warning',
      confidence: 'low',
      sourceAgent: 'competitive',
      children: [
        {
          id: 'leaf-1-1',
          label: 'Ask for company domain',
          detail: 'A real product URL grounds every later claim.',
          sentiment: 'warning',
        },
        {
          id: 'leaf-1-2',
          label: 'Reject personal profiles',
          detail: 'LinkedIn /in/ and school bios are not product evidence.',
          sentiment: 'negative',
        },
      ],
    },
    {
      id: 'branch-2',
      label: 'Disambiguate entity',
      detail: `Confirm whether "${name}" is a software product, person, or unrelated company.`,
      sentiment: 'warning',
      confidence: 'low',
      sourceAgent: 'positioning',
      children: [
        {
          id: 'leaf-2-1',
          label: 'Person vs product',
          detail: 'Homonyms often pollute competitive searches.',
          sentiment: 'warning',
        },
        {
          id: 'leaf-2-2',
          label: 'Category vs named peer',
          detail: 'Do not score as a SaaS peer until identity is confirmed.',
          sentiment: 'neutral',
        },
      ],
    },
    {
      id: 'branch-3',
      label: 'Gather software evidence',
      detail: 'Need pricing pages, G2/Capterra, or product docs before ICP or pricing work.',
      sentiment: 'neutral',
      confidence: 'low',
      sourceAgent: 'market-trends',
      children: [
        {
          id: 'leaf-3-1',
          label: 'Product docs or pricing',
          detail: 'Software evidence must mention the product by official name.',
          sentiment: 'neutral',
        },
        {
          id: 'leaf-3-2',
          label: 'Buyer / review sites',
          detail: 'Third-party reviews reduce homonym noise.',
          sentiment: 'positive',
        },
      ],
    },
    {
      id: 'branch-4',
      label: 'Defer ICP / pricing',
      detail: 'Specialize ICP and pricing only after identity is resolved — treat current cards as category context.',
      sentiment: 'warning',
      confidence: 'low',
      sourceAgent: 'pricing',
      children: [
        {
          id: 'leaf-4-1',
          label: 'Hold product bets',
          detail: 'ICP and pricing pillars are premature without a confirmed product.',
          sentiment: 'warning',
        },
      ],
    },
    {
      id: 'branch-5',
      label: 'Avoid premature strategy',
      detail: 'Do not ship rebrands, competitive matrices, or hiring narratives tied to an unverified name.',
      sentiment: 'negative',
      confidence: 'low',
      sourceAgent: 'adjacent',
      children: [
        {
          id: 'leaf-5-1',
          label: 'No peer scoring yet',
          detail: 'Matrix scores imply peer status that is not evidenced.',
          sentiment: 'negative',
        },
        {
          id: 'leaf-5-2',
          label: 'Rerun with URL',
          detail: 'Add the official website and rerun for entity-grounded analysis.',
          sentiment: 'positive',
        },
      ],
    },
  ];
}

function rewriteMindMapForIdentity(
  output: MindMapOutput,
  product: string,
): MindMapOutput {
  return {
    ...output,
    contextOnly: true,
    contextOnlyLabel: CONTEXT_ONLY_LABEL,
    confidence: 'low',
    confidenceScore: Math.min(output.confidenceScore, 0.42),
    centralTopic: `Resolve ${product || 'entity'} identity`,
    summary: `Identity for "${product}" is ambiguous — confirm the official URL before ICP, pricing, or competitive strategy.`,
    branches: buildIdentityFirstBranches(product),
    interpretation: [
      `${CONTEXT_ONLY_LABEL}: resolve identity before strategy.`,
      ...(output.interpretation ?? []).slice(0, 2),
    ],
  };
}

function softenCompetitiveOutput(
  output: CompetitiveOutput,
  product: string,
  competitor?: string,
  opts?: { categoryMismatch?: boolean },
): CompetitiveOutput {
  const categoryMismatch = Boolean(opts?.categoryMismatch);

  // Category mismatch: strip peer scorecard noise — keep a short identity note only.
  if (categoryMismatch) {
    return {
      ...output,
      contextOnly: true,
      contextOnlyLabel: CONTEXT_ONLY_LABEL,
      decisionUseSuppressed: true,
      confidence: 'low',
      confidenceScore: Math.min(output.confidenceScore, 0.42),
      matrix: [],
      competitorSummary:
        `${CONTEXT_ONLY_LABEL}: "${product}" is not confirmed as a software product in this category` +
        (competitor ? `, and "${competitor}" may also be the wrong entity` : '') +
        `. Skip competitive scoring until you confirm the official product URL.`,
      hiringSignals: [],
      recentMoves: [],
      facts: [
        `Entity identity for "${product}" is unresolved — competitive matrix hidden.`,
      ],
      interpretation: [
        `${CONTEXT_ONLY_LABEL}: resolve identity before any competitor comparison.`,
      ],
    };
  }

  return {
    ...output,
    contextOnly: true,
    contextOnlyLabel: CONTEXT_ONLY_LABEL,
    decisionUseSuppressed: true,
    confidence: 'low',
    confidenceScore: Math.min(output.confidenceScore, 0.42),
    matrix: [],
    competitorSummary:
      `${CONTEXT_ONLY_LABEL}: "${product}" is not confirmed as a software product in this category. ` +
      `Treat competitor columns as category reference only — not a product-vs-peer scorecard.`,
    hiringSignals: (output.hiringSignals ?? []).map((s) =>
      sanitizeCategorySignal(s, product, competitor),
    ),
    recentMoves: (output.recentMoves ?? []).map((s) =>
      sanitizeCategorySignal(s, product, competitor),
    ),
    interpretation: [
      `${CONTEXT_ONLY_LABEL}: resolve identity before competitive scoring.`,
      ...(output.interpretation ?? []).slice(0, 2),
    ],
  };
}

function softLabelStage1(
  output: AgentOutput,
  opts?: { categoryMismatch?: boolean; product?: string },
): AgentOutput {
  const product = opts?.product?.trim() || 'this subject';
  if (opts?.categoryMismatch) {
    return {
      ...output,
      contextOnly: true,
      contextOnlyLabel: CONTEXT_ONLY_LABEL,
      decisionUseSuppressed: true,
      confidence: 'low',
      confidenceScore: Math.min(output.confidenceScore, 0.42),
      facts: [
        `Identity for "${product}" is unresolved — domain details withheld until the official URL is confirmed.`,
      ],
      interpretation: [
        `${CONTEXT_ONLY_LABEL}: do not use this domain card for product strategy until identity is confirmed.`,
      ],
    };
  }

  return {
    ...output,
    contextOnly: true,
    contextOnlyLabel: CONTEXT_ONLY_LABEL,
    decisionUseSuppressed: true,
    confidence: 'low',
    confidenceScore: Math.min(output.confidenceScore, 0.42),
    interpretation: (output.interpretation ?? []).map((t, i) =>
      i === 0 && !t.startsWith(CONTEXT_ONLY_LABEL)
        ? `${CONTEXT_ONLY_LABEL}: ${t}`
        : t,
    ),
  };
}

/**
 * When the quality gate abstains, rewrite Stage-1 artifacts so UI/export
 * do not present category noise as entity-specific strategy.
 */
export function applyAbstainToArtifacts(
  outputs: AgentOutput[],
  opts: {
    product: string;
    competitor?: string;
    quality: OutputQualityReport;
  },
): AgentOutput[] {
  if (!opts.quality.shouldAbstainFromStrongClaims) return outputs;

  const categoryMismatch = opts.quality.flags.includes('entity_category_mismatch');

  return outputs.map((output) => {
    if (output.artifactType === 'mind-map') {
      return rewriteMindMapForIdentity(output as MindMapOutput, opts.product);
    }
    if (output.artifactType === 'competitive-matrix') {
      return softenCompetitiveOutput(
        output as CompetitiveOutput,
        opts.product,
        opts.competitor,
        { categoryMismatch },
      );
    }
    if (output.artifactType === 'trend-chart') {
      const trend = output as MarketTrendsOutput;
      const softened = softLabelStage1(trend, {
        categoryMismatch,
        product: opts.product,
      });
      return {
        ...trend,
        ...softened,
        decisionUseSuppressed: true,
        trends: [],
        keySignals: [],
      };
    }
    if (STAGE1_DOMAINS.has(output.domain)) {
      return softLabelStage1(output, {
        categoryMismatch,
        product: opts.product,
      });
    }
    return output;
  });
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
 * Synthesis found a name match but wrong kind of business (e.g. real-estate
 * "Lilian" when the query was about an AI SDR). Entity token match alone
 * must not keep Stage-1 competitive cards / ICP mind maps.
 */
export function looksLikeEntityCategoryMismatch(text: string): boolean {
  const lower = text.toLowerCase();

  const deniesSoftwareProduct =
    /\bnot a (competitive )?(ai[\s-]?sdr|software|saas|tech(nology)?)\b/.test(lower) ||
    /\bnot (an? )?(ai[\s-]?sdr|software|saas) (product|platform|company|tool)\b/.test(lower) ||
    /\bno (evidence|presence|sign) of (an? )?(ai|software|saas|tech)/.test(lower) ||
    /\b(no|not) (an? )?(ai[\s-]?sdr|software) (product|platform) under (this|the) name\b/.test(lower) ||
    /\bmisidentified\b/.test(lower) ||
    /\bmismatch between the product name\b/.test(lower) ||
    /\bwrong (company|product|entity|business)\b/.test(lower) ||
    /\bnot a software (company|platform|product|business)\b/.test(lower);

  const nonSoftwareBusiness =
    /\b(local )?real estate\b/.test(lower) ||
    /\bproperty (acquisition|management|listings?)\b/.test(lower) ||
    /\b(dental|law|restaurant|retail) (practice|firm|business)\b/.test(lower);

  const asksIdentityFirst =
    /\b(confirm|verify) (the )?(product|company|entity) (identity|website|url)\b/.test(lower) ||
    /\bofficial website\b/.test(lower);

  // Real-estate (or similar) entity while synthesis denies software / flags mismatch
  if (deniesSoftwareProduct) return true;
  if (nonSoftwareBusiness && (deniesSoftwareProduct || asksIdentityFirst || /\bnot (a |an )?(software|ai|saas|tech)/.test(lower))) {
    return true;
  }
  // Real estate + competitive AI framing in the same writeup
  if (nonSoftwareBusiness && /\b(ai[\s-]?sdr|clay|11x|saas competitor|software platform)\b/.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Assess grounding quality from sources + draft synthesis text.
 */
export function assessOutputQuality(input: {
  product: string;
  competitor?: string;
  productUrl?: string;
  competitorUrl?: string;
  sources: AgentSource[];
  answer: string;
  recommendations: Recommendation[];
  agentConfidenceAvg: number;
}): OutputQualityReport {
  const terms = buildEntityTerms(input.product, input.competitor);
  const officialDomains = officialDomainsFromUrls(input.productUrl, input.competitorUrl);
  const relevance = filterSourcesByEntityRelevance(input.sources, terms, {
    officialDomains,
    rejectPersonBios: true,
  });
  const matchedSourceCount = input.sources.filter((s) =>
    !isPersonOrSchoolBioSource(s) && sourceMatchesEntities(s, terms, officialDomains),
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
  if (looksLikeEntityCategoryMismatch(combinedText)) {
    flags.push('entity_category_mismatch');
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
  // Category mismatch (real-estate name match for an AI SDR query) is never "strong".
  const strongGrounding =
    !flags.includes('entity_category_mismatch') &&
    relevance.matchRatio >= 0.7 &&
    matchedSourceCount >= 6;

  const shouldAbstainFromStrongClaims =
    flags.includes('weak_entity_resolution') ||
    flags.includes('low_entity_source_match') ||
    flags.includes('thin_entity_evidence') ||
    flags.includes('contradictory_strategy_framing') ||
    flags.includes('entity_category_mismatch') ||
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
  productUrl?: string;
  competitorUrl?: string;
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

    const categoryMismatch = quality.flags.includes('entity_category_mismatch');

    if (categoryMismatch) {
      // Do not keep strategy recs that assume the user should "become" a SaaS company.
      recommendations = [
        {
          title: 'Share the official product URL',
          rationale:
            `Sources for "${input.product}" point to a different kind of business than your question implies. ` +
            `Add the real website so we can re-run on the correct entity.`,
          evidence: ['entity_category_mismatch'],
          confidence: 'medium',
          priority: 'short-term',
        },
        {
          title: 'Confirm the software product name',
          rationale:
            `If "${input.product}" is a nickname or typo, tell us the exact product name` +
            (input.competitor ? ` (and confirm competitor "${input.competitor}")` : '') +
            `.`,
          evidence: ['entity_category_mismatch'],
          confidence: 'medium',
          priority: 'short-term',
        },
      ];
    } else {
      recommendations = recommendations.map((r) => ({
        ...r,
        confidence: downgradeConfidence(r.confidence),
        priority: r.priority === 'immediate' ? 'short-term' : r.priority,
        title: r.title,
        rationale: `${r.rationale} Double-check this before acting — evidence for "${input.product}" is limited.`,
      }));
    }

    const caution = categoryMismatch
      ? `Heads up: "${input.product}" looks like a name match to the wrong kind of business` +
        ` (not the software/category in your question). ` +
        `${quality.matchedSourceCount} of ${quality.totalSourceCount} sources matched the name, but that is not enough. ` +
        `Add the official website and rerun before trusting competitive or strategy cards.\n\n`
      : `Heads up: we're not fully sure the sources are about the right "${input.product}"` +
        ` (${quality.matchedSourceCount} of ${quality.totalSourceCount} sources matched the name). ` +
        `Treat this as a draft hypothesis — if this is the wrong company, add the official website and rerun.\n\n`;

    if (!/^heads up:/i.test(answer) && !/evidence quality check/i.test(answer)) {
      answer = caution + answer;
    }

    const needsIdentityClarify =
      quality.flags.includes('person_homonym_noise') ||
      quality.flags.includes('weak_entity_resolution') ||
      quality.flags.includes('thin_entity_evidence') ||
      categoryMismatch;

    if (needsIdentityClarify) {
      const clarifyUps = [
        `What is the official website for ${input.product}?`,
        `Just to confirm: is ${input.product} a software product?`,
      ];
      followUps = [...clarifyUps, ...followUps].slice(0, 3);
    }
  } else if (input.agentConfidenceAvg < 0.6) {
    // Agents disagree / weak even when entity match is fine — don't show "high"
    recommendations = recommendations.map((r) => ({
      ...r,
      confidence: r.confidence === 'high' ? 'medium' : r.confidence,
    }));
    if (confidenceScore > 0.75) {
      confidenceScore = Math.min(confidenceScore, 0.72);
    }
  }

  // Compare / dual-entity queries: clarify decision frame (buyer vs builder)
  const isCompare =
    Boolean(input.competitor?.trim()) &&
    input.competitor!.toLowerCase() !== 'relevant competitors' &&
    input.competitor!.toLowerCase() !== 'unknown product';
  if (isCompare && !quality.shouldAbstainFromStrongClaims) {
    const compareUps = [
      `Are you choosing between ${input.product} and ${input.competitor} as a buyer, or positioning your own product against them?`,
      `What matters more for your decision: price, enterprise features, or developer mindshare?`,
    ];
    followUps = [...compareUps, ...followUps]
      .filter((q, i, arr) => arr.findIndex((x) => x.toLowerCase() === q.toLowerCase()) === i)
      .slice(0, 3);
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
  opts?: {
    productUrl?: string;
    competitorUrl?: string;
  },
): { outputs: AgentOutput[]; aggregateMatchRatio: number } {
  const terms = buildEntityTerms(product, competitor);
  const officialDomains = officialDomainsFromUrls(opts?.productUrl, opts?.competitorUrl);
  let matched = 0;
  let total = 0;

  const next = outputs.map((output) => {
    total += output.sources.length;
    const { kept, matchRatio } = filterSourcesByEntityRelevance(output.sources, terms, {
      officialDomains,
      rejectPersonBios: true,
    });
    matched += Math.round(matchRatio * output.sources.length);
    // Synthesis receives only credible entity matches. Empty is honest and
    // forces the quality gate to abstain instead of reasoning over name noise.
    return { ...output, sources: kept };
  });

  return {
    outputs: next,
    aggregateMatchRatio: total > 0 ? matched / total : 0,
  };
}
