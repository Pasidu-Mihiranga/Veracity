import type {
  AgentOutput,
  AdaptiveReplan,
  ComparisonContract,
  DueDiligencePack,
  DueDiligenceSectionId,
  EvidenceCoverageAxis,
  IntelligenceDomain,
  InvestigationPlan,
  InvestigationProbe,
  Recommendation,
  ResearchIntentClass,
} from '@/lib/agents/types';
export type {
  AdaptiveReplan,
  ComparisonContract,
  DueDiligencePack,
  DueDiligenceSectionId,
  InvestigationPlan,
  InvestigationProbe,
} from '@/lib/agents/types';
import { buildEntityTerms, sourceMatchesEntities } from '@/lib/tools/source-relevance';

const DOMAIN_FALLBACKS: Record<IntelligenceDomain, IntelligenceDomain[]> = {
  'market-trends': ['adjacent', 'competitive'],
  competitive: ['positioning', 'market-trends'],
  'win-loss': ['positioning', 'competitive'],
  pricing: ['competitive', 'market-trends'],
  positioning: ['competitive', 'win-loss'],
  adjacent: ['market-trends', 'competitive'],
  'execution-engine': [],
  mirofish: [],
  'mirofish-live': [],
};

export function domainsFromInvestigationQuery(query: string): IntelligenceDomain[] {
  const q = query.toLowerCase();
  const matches: IntelligenceDomain[] = [];
  const aliases: Array<[IntelligenceDomain, RegExp]> = [
    ['market-trends', /\b(?:run|deepen|investigate)\s+market trends?\b/],
    ['competitive', /\b(?:run|deepen|investigate)\s+competitive\b/],
    ['win-loss', /\b(?:run|deepen|investigate)\s+win loss\b/],
    ['pricing', /\b(?:run|deepen|investigate)\s+pricing\b/],
    ['positioning', /\b(?:run|deepen|investigate)\s+positioning\b/],
    ['adjacent', /\b(?:run|deepen|investigate)\s+adjacent\b/],
  ];
  for (const [domain, pattern] of aliases) {
    if (pattern.test(q)) matches.push(domain);
  }
  return matches;
}

export function collectPriorOpenQuestions(
  history: Array<{
    role?: 'user' | 'assistant';
    content?: string;
    timestamp?: string;
    investigationOpenQuestions?: string[];
    agentOutput?: { investigationPlan?: { openQuestions: string[] } };
  }>,
  limit = 6,
): string[] {
  return history
    .flatMap((message) => [
      ...(message.investigationOpenQuestions ?? []),
      ...(message.agentOutput?.investigationPlan?.openQuestions ?? []),
    ])
    .filter((value, index, all) => value.trim() && all.indexOf(value) === index)
    .slice(0, limit);
}

export function planAdaptiveReplan(input: {
  outputs: AgentOutput[];
  selectedDomains: IntelligenceDomain[];
  availableDomains: IntelligenceDomain[];
  openQuestions: string[];
  intent: ResearchIntentClass;
  maxAddedDomains?: number;
}): AdaptiveReplan {
  const thinOutputs = input.outputs.filter(
    (output) => output.sources.length < 2 || output.confidenceScore < 0.45,
  );
  const returnedDomains = new Set(input.outputs.map((output) => output.domain));
  const missingDomains = input.selectedDomains.filter(
    (domain) => !returnedDomains.has(domain),
  );
  const reasons = thinOutputs.map(
    (output) =>
      `${output.domain} evidence is thin (${output.sources.length} source${output.sources.length === 1 ? '' : 's'}, confidence ${output.confidenceScore.toFixed(2)}).`,
  );
  if (input.outputs.length === 0) reasons.push('No research agent returned usable output.');
  for (const domain of missingDomains) {
    reasons.push(`${domain} returned no usable output.`);
  }
  if (input.openQuestions.length > 0) {
    reasons.push(`${input.openQuestions.length} unresolved research question(s) remain.`);
  }

  const selected = new Set(input.selectedDomains);
  const available = new Set(input.availableDomains);
  const candidates: IntelligenceDomain[] = [];
  for (const output of thinOutputs) {
    for (const domain of DOMAIN_FALLBACKS[output.domain] ?? []) {
      if (!selected.has(domain) && available.has(domain) && !candidates.includes(domain)) {
        candidates.push(domain);
      }
    }
  }
  for (const domain of missingDomains) {
    for (const fallback of DOMAIN_FALLBACKS[domain] ?? []) {
      if (!selected.has(fallback) && available.has(fallback) && !candidates.includes(fallback)) {
        candidates.push(fallback);
      }
    }
  }
  if (input.intent === 'dd_acquisition') {
    for (const domain of ['competitive', 'pricing', 'win-loss', 'adjacent'] as IntelligenceDomain[]) {
      if (!selected.has(domain) && available.has(domain) && !candidates.includes(domain)) {
        candidates.push(domain);
      }
    }
  }

  const addedDomains = candidates.slice(0, input.maxAddedDomains ?? 2);
  return {
    triggered: reasons.length > 0,
    reasons,
    addedDomains,
    deepenDomains: [...new Set([
      ...thinOutputs.map((output) => output.domain),
      ...missingDomains,
    ])],
  };
}

export function buildInvestigationPlan(input: {
  intent: ResearchIntentClass;
  product: string;
  openQuestions: string[];
  coverage: EvidenceCoverageAxis[];
  outputs: AgentOutput[];
  replan: AdaptiveReplan;
}): InvestigationPlan {
  const probes: InvestigationProbe[] = [];
  const addProbe = (
    question: string,
    domain: IntelligenceDomain,
    sourceType: string,
    reason: string,
    status: InvestigationProbe['status'] = 'recommended',
  ) => {
    if (probes.some((probe) => probe.question.toLowerCase() === question.toLowerCase())) return;
    probes.push({
      id: `probe-${probes.length + 1}`,
      question,
      domain,
      sourceType,
      reason,
      status,
    });
  };

  for (const question of input.openQuestions.slice(0, 5)) {
    addProbe(
      question,
      inferProbeDomain(question),
      inferSourceType(question),
      'Raised by a specialist agent and not resolved by current evidence.',
    );
  }
  for (const axis of input.coverage.filter((item) => item.score < 0.35)) {
    const domain = axis.agentIds[0] as IntelligenceDomain;
    addProbe(
      `What primary evidence would close the ${axis.label.toLowerCase()} gap for ${input.product}?`,
      domain,
      sourceTypeForAxis(axis.id),
      `${axis.label} coverage is ${Math.round(axis.score * 100)}%.`,
    );
  }
  for (const domain of input.replan.addedDomains) {
    addProbe(
      `What additional ${domain.replace(/-/g, ' ')} evidence changes the current conclusion?`,
      domain,
      'targeted collector',
      'Adaptive replanning added this collector.',
      'completed',
    );
  }

  return {
    intent: input.intent,
    openQuestions: [...new Set(input.openQuestions)].slice(0, 8),
    proposedNextProbes: probes.slice(0, 8),
    targetedFollowUpPlan: probes
      .filter((probe) => probe.status === 'recommended')
      .slice(0, 4)
      .map((probe) => `Run ${probe.domain.replace(/-/g, ' ')}: ${probe.question}`),
  };
}

export function buildDueDiligencePack(
  target: string,
  outputs: AgentOutput[],
  openQuestions: string[],
): DueDiligencePack {
  const specs: Array<{
    id: DueDiligenceSectionId;
    label: string;
    domains: IntelligenceDomain[];
    defaultOpen: string;
  }> = [
    { id: 'identity', label: 'Identity', domains: ['positioning', 'competitive'], defaultOpen: 'Confirm the legal entity and canonical product URL.' },
    { id: 'business_model', label: 'Business model', domains: ['competitive', 'pricing'], defaultOpen: 'Verify customer segments, revenue model, and commercial packaging.' },
    { id: 'financials_news', label: 'Financials and news', domains: ['market-trends', 'pricing'], defaultOpen: 'Obtain audited financials, ARR, retention, burn, and financing history.' },
    { id: 'people', label: 'People', domains: ['win-loss', 'positioning'], defaultOpen: 'Verify leadership, key-person dependencies, and retention risk.' },
    { id: 'risk', label: 'Risk', domains: ['adjacent', 'win-loss', 'competitive'], defaultOpen: 'Validate legal, security, concentration, and product-obsolescence risks.' },
    { id: 'open_items', label: 'Open items', domains: [], defaultOpen: 'Resolve the prioritized diligence questions before an investment decision.' },
  ];

  return {
    target,
    sections: specs.map((spec) => {
      const relevant = outputs.filter((output) => spec.domains.includes(output.domain));
      const findings = spec.id === 'open_items'
        ? []
        : relevant
            .flatMap((output) => output.facts)
            .filter((finding) => findingMatchesDiligenceSection(finding, spec.id))
            .slice(0, 4);
      const evidenceUrls = [...new Set(relevant.flatMap((output) => output.sources.map((source) => source.url)))].slice(0, 5);
      const matchingQuestions = openQuestions.filter((question) =>
        spec.domains.some((domain) => question.toLowerCase().includes(domain.replace(/-/g, ' '))),
      );
      const openItems = spec.id === 'open_items'
        ? [...new Set(openQuestions)].slice(0, 8)
        : [...matchingQuestions, spec.defaultOpen].slice(0, 3);
      const status: DueDiligencePack['sections'][number]['status'] = findings.length >= 2 && evidenceUrls.length >= 2
        ? 'verified'
        : findings.length > 0 || evidenceUrls.length > 0
          ? 'partial'
          : 'open';
      return {
        id: spec.id,
        label: spec.label,
        status,
        findings,
        evidenceUrls,
        openItems,
      };
    }),
  };
}

export function buildDiligenceExecutiveAnswer(pack: DueDiligencePack): string {
  const verified = pack.sections.filter((section) => section.status === 'verified');
  const partial = pack.sections.filter((section) => section.status === 'partial');
  const evidencedFindings = pack.sections
    .filter((section) => section.evidenceUrls.length > 0)
    .flatMap((section) => section.findings)
    .slice(0, 2);
  const criticalOpen = pack.sections
    .filter((section) =>
      ['identity', 'financials_news', 'people', 'risk'].includes(section.id),
    )
    .flatMap((section) => section.openItems)
    .slice(0, 4);

  return [
    `Do not make an acquisition decision from the current evidence on ${pack.target}.`,
    `${verified.length} diligence section${verified.length === 1 ? ' is' : 's are'} verified and ${partial.length} ${partial.length === 1 ? 'is' : 'are'} only partial.`,
    evidencedFindings.length > 0
      ? `Evidence-backed starting points: ${evidencedFindings.join(' ')}`
      : 'No section has both a concrete finding and enough primary evidence to treat it as verified.',
    `Confirm that ${pack.target} is the intended legal target rather than only a reference product.`,
    criticalOpen.length > 0
      ? `Before proceeding, resolve: ${criticalOpen.join(' ')}`
      : 'Before proceeding, obtain identity, audited financials, customer retention, leadership, and risk evidence.',
  ].join(' ');
}

export function sanitizeDiligenceRecommendations(
  recommendations: Recommendation[],
): Recommendation[] {
  const fabricatedFinancial =
    /\b(arr|revenue|valuation|margin|profit|ebitda|burn|retention|nrr)\b[^.\n]{0,40}\b\d+(?:\.\d+)?\s*(?:%|m|b|million|billion)\b/i;
  const strategyPivot = /\b(ship|build|pivot|reposition|launch|raise prices?|expand into)\b/i;
  const safe = recommendations.filter((recommendation) => {
    const text = [
      recommendation.title,
      recommendation.rationale,
      ...recommendation.evidence,
    ].join(' ');
    return !fabricatedFinancial.test(text) && !strategyPivot.test(recommendation.title);
  });
  if (safe.length > 0) return safe.slice(0, 3);
  return [
    {
      title: 'Verify target financials',
      rationale: 'Obtain audited revenue, retention, margin, burn, and financing evidence before valuation work.',
      evidence: ['not enough evidence'],
      confidence: 'low',
      priority: 'short-term',
    },
    {
      title: 'Validate customer retention',
      rationale: 'Use customer references, cohort data, and contract records to test durability.',
      evidence: ['not enough evidence'],
      confidence: 'low',
      priority: 'short-term',
    },
  ];
}

function findingMatchesDiligenceSection(
  finding: string,
  section: DueDiligenceSectionId,
): boolean {
  const patterns: Record<DueDiligenceSectionId, RegExp> = {
    identity: /\b(company|product|vendor|founded|headquarter|official|subsidiary|legal entit|operates as)\b/i,
    business_model: /\b(business model|pricing|subscription|contract|customer|segment|enterprise|commercial|sells|revenue model)\b/i,
    financials_news: /\b(arr|revenue|valuation|funding|raised|investor|profit|loss|margin|cash|financial|acqui(?:red|sition)|bankrupt)\b/i,
    people: /\b(founder|ceo|chief|leadership|executive|employee|headcount|hiring|team|key person)\b/i,
    risk: /\b(risk|threat|security|legal|regulat|concentration|churn|dependency|obsolete|litigation|vulnerab)\b/i,
    open_items: /$^/,
  };
  return patterns[section].test(finding);
}

export function buildComparisonContract(
  entities: string[],
  outputs: AgentOutput[],
): ComparisonContract {
  const uniqueEntities = [...new Set(entities.filter(Boolean))];
  const specs: Array<{
    id: ComparisonContract['dimensions'][number]['id'];
    label: string;
    domains: IntelligenceDomain[];
  }> = [
    { id: 'positioning', label: 'Positioning', domains: ['positioning', 'competitive'] },
    { id: 'pricing', label: 'Pricing', domains: ['pricing'] },
    { id: 'buyer_evidence', label: 'Buyer evidence', domains: ['win-loss'] },
    { id: 'market', label: 'Market signals', domains: ['market-trends'] },
    { id: 'risk', label: 'Risks and adjacency', domains: ['adjacent', 'competitive'] },
  ];

  return {
    entities: uniqueEntities,
    dimensions: specs.map((spec) => ({
      id: spec.id,
      label: spec.label,
      cells: uniqueEntities.map((entity) => {
        const relevant = outputs.filter((output) => spec.domains.includes(output.domain));
        const terms = buildEntityTerms(entity);
        const finding = relevant
          .flatMap((output) => output.facts)
          .find((fact) =>
            terms.some((term) => fact.toLowerCase().includes(term))
            && findingMatchesComparisonDimension(fact, spec.id),
          )
          ?? 'Not established by retrieved evidence.';
        const evidenceUrls = finding === 'Not established by retrieved evidence.'
          ? []
          : [...new Set(
          relevant.flatMap((output) =>
            output.sources
              .filter((source) => sourceMatchesEntities(source, terms))
              .map((source) => source.url),
          ),
        )].slice(0, 3);
        return {
          entity,
          finding,
          confidence: evidenceUrls.length >= 2
            ? 'supported' as const
            : evidenceUrls.length === 1
              ? 'weakly-supported' as const
              : 'unsupported' as const,
          evidenceUrls,
        };
      }),
    })),
  };
}

export function buildComparisonExecutiveAnswer(contract: ComparisonContract): string {
  const entityLabel = contract.entities.join(' vs ');
  const established = contract.dimensions.flatMap((dimension) => {
    const cells = dimension.cells;
    if (
      cells.length !== contract.entities.length
      || cells.some((cell) => cell.confidence === 'unsupported')
    ) return [];
    return [
      `${dimension.label}: ${cells.map((cell) => `${cell.entity} — ${cell.finding}`).join(' ')}`,
    ];
  }).slice(0, 2);
  const peerRelationshipUnverified = established.length < 2;
  const incomplete = contract.dimensions
    .filter((dimension) =>
      dimension.cells.some((cell) => cell.confidence === 'unsupported'),
    )
    .map((dimension) => dimension.label.toLowerCase());

  return [
    `The current evidence supports only a partial ${entityLabel} comparison, not a final purchase decision.`,
    peerRelationshipUnverified
      ? `Retrieved evidence does not establish that ${entityLabel} are comparable product peers; do not treat this as a peer matrix.`
      : `Retrieved evidence supports comparison across ${established.length} shared dimensions.`,
    established.length > 0
      ? established.join(' ')
      : 'No shared comparison dimension has enough evidence yet.',
    incomplete.length > 0
      ? `Evidence remains incomplete for: ${incomplete.join(', ')}.`
      : 'All shared dimensions have at least directional evidence.',
    peerRelationshipUnverified
      ? 'Provide both official product URLs and clarify the buyer intent, use case, and procurement criteria before continuing.'
      : 'Resolve the unsupported cells with primary pricing, customer, migration, and risk evidence before choosing.',
  ].join(' ');
}

function findingMatchesComparisonDimension(
  finding: string,
  dimension: ComparisonContract['dimensions'][number]['id'],
): boolean {
  const patterns: Record<ComparisonContract['dimensions'][number]['id'], RegExp> = {
    positioning: /\b(position|message|category|all-in-one|workspace|brand|narrative)\b/i,
    pricing: /\b(price|pricing|tier|plans?|cost|discount|contract|per user|per seat)\b/i,
    buyer_evidence: /\b(buyer|customer|review|adopt|switch|migration|churn|retention|satisfaction)\b/i,
    market: /\b(market|trend|growth|interest|engagement|posts?|demand|mindshare)\b/i,
    risk: /\b(risk|threat|switch|migration|lock-in|dependency|limitation|disadvantage|vulnerab)\b/i,
  };
  return patterns[dimension].test(finding);
}

function inferProbeDomain(question: string): IntelligenceDomain {
  const q = question.toLowerCase();
  if (/\b(price|pricing|arr|revenue|financial|contract)\b/.test(q)) return 'pricing';
  if (/\b(customer|buyer|churn|retention|people|leadership)\b/.test(q)) return 'win-loss';
  if (/\b(competitor|feature|peer|alternative)\b/.test(q)) return 'competitive';
  if (/\b(position|message|category|identity|website)\b/.test(q)) return 'positioning';
  if (/\b(risk|threat|regulation|security)\b/.test(q)) return 'adjacent';
  return 'market-trends';
}

function inferSourceType(question: string): string {
  const q = question.toLowerCase();
  if (/\b(price|pricing|contract)\b/.test(q)) return 'official pricing or contract evidence';
  if (/\b(customer|buyer|churn|retention)\b/.test(q)) return 'customer references or review evidence';
  if (/\b(financial|arr|revenue)\b/.test(q)) return 'audited financials or management data room';
  if (/\b(people|leadership)\b/.test(q)) return 'official leadership and employment records';
  return 'primary source';
}

function sourceTypeForAxis(axis: EvidenceCoverageAxis['id']): string {
  const types: Record<EvidenceCoverageAxis['id'], string> = {
    market: 'market data and recent news',
    competition: 'official competitor pages and independent comparisons',
    customers: 'customer references and reviews',
    technology: 'product documentation and security materials',
    pricing: 'official pricing and commercial terms',
  };
  return types[axis];
}

