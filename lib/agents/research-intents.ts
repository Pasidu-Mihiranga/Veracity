import type {
  IntelligenceDomain,
  ResearchIntentClass,
} from '@/lib/agents/types';
export type { ResearchIntentClass } from '@/lib/agents/types';

export type MissionTemplate = {
  intent: ResearchIntentClass;
  label: string;
  objective: string;
  defaultDomains: IntelligenceDomain[];
  deliverables: string[];
};

export const RESEARCH_INTENTS: ResearchIntentClass[] = [
  'compare',
  'market',
  'dd_acquisition',
  'risk',
  'tech_assessment',
  'executive_strategy',
  'monitoring',
];

export const MISSION_TEMPLATES: Record<ResearchIntentClass, MissionTemplate> = {
  compare: {
    intent: 'compare',
    label: 'Comparable evidence matrix',
    objective: 'Compare entities on shared buyer-relevant dimensions.',
    defaultDomains: ['competitive', 'pricing', 'positioning', 'win-loss'],
    deliverables: ['shared dimensions', 'evidence per cell', 'switching risks', 'open comparison items'],
  },
  market: {
    intent: 'market',
    label: 'Market investigation',
    objective: 'Establish category direction, demand signals, and adjacent pressure.',
    defaultDomains: ['market-trends', 'adjacent'],
    deliverables: ['market direction', 'leading indicators', 'counter-signals'],
  },
  dd_acquisition: {
    intent: 'dd_acquisition',
    label: 'Acquisition due diligence',
    objective: 'Separate verified target facts from diligence gaps and acquisition risks.',
    defaultDomains: [
      'market-trends',
      'competitive',
      'win-loss',
      'pricing',
      'positioning',
      'adjacent',
    ],
    deliverables: ['identity', 'business model', 'financials/news', 'people', 'risk', 'open items'],
  },
  risk: {
    intent: 'risk',
    label: 'Risk investigation',
    objective: 'Identify material commercial, category, and buyer-side risks.',
    defaultDomains: ['adjacent', 'win-loss', 'competitive'],
    deliverables: ['risk register', 'evidence', 'mitigations', 'falsifiers'],
  },
  tech_assessment: {
    intent: 'tech_assessment',
    label: 'Technology assessment',
    objective: 'Assess product capability, differentiation, integrations, and technical risk.',
    defaultDomains: ['competitive', 'positioning'],
    deliverables: ['capability criteria', 'integration evidence', 'technical gaps'],
  },
  executive_strategy: {
    intent: 'executive_strategy',
    label: 'Executive strategy investigation',
    objective: 'Turn market and competitive evidence into bounded strategic choices.',
    defaultDomains: ['market-trends', 'competitive', 'positioning', 'pricing'],
    deliverables: ['strategic choices', 'trade-offs', 'ranked actions', 'falsifiers'],
  },
  monitoring: {
    intent: 'monitoring',
    label: 'Monitoring sweep',
    objective: 'Detect material market, competitor, and pricing changes.',
    defaultDomains: ['market-trends', 'competitive', 'pricing'],
    deliverables: ['material changes', 'source timestamps', 'next watch probes'],
  },
};

export function isResearchIntentClass(value: unknown): value is ResearchIntentClass {
  return typeof value === 'string' && RESEARCH_INTENTS.includes(value as ResearchIntentClass);
}

/** Deterministic fallback and guardrail around model intent classification. */
export function inferResearchIntent(query: string): ResearchIntentClass {
  const q = query.toLowerCase();
  if (/\b(acquir|acquisition|due diligence|diligence|buying the company|target company|investment committee)\b/.test(q)) {
    return 'dd_acquisition';
  }
  if (/\b(monitor|watchlist|track changes?|since last|alert me|continuous)\b/.test(q)) {
    return 'monitoring';
  }
  if (/\b(technical assessment|technology assessment|architecture|security review|integration|api capability|tech stack)\b/.test(q)) {
    return 'tech_assessment';
  }
  if (/\b(risk|threat|vulnerab|downside|failure mode|churn)\b/.test(q)) {
    return 'risk';
  }
  if (/\b(compare|comparison|versus|vs\.?|compete|against|alternative)\b/.test(q)) {
    return 'compare';
  }
  if (/\b(strategy|roadmap|what should|build next|reposition|prioriti[sz]e|executive)\b/.test(q)) {
    return 'executive_strategy';
  }
  return 'market';
}

export function resolveResearchIntent(query: string, modelValue: unknown): ResearchIntentClass {
  const deterministic = inferResearchIntent(query);
  if (!isResearchIntentClass(modelValue)) return deterministic;

  // High-consequence workflow cues win over a generic model classification.
  if (deterministic === 'dd_acquisition' || deterministic === 'monitoring') {
    return deterministic;
  }
  return modelValue;
}

/**
 * Apply intent defaults without reintroducing domain padding. Narrow Tier-1
 * lookups keep exactly the classifier-selected domain.
 */
export function domainsForMission(input: {
  intent: ResearchIntentClass;
  classifiedDomains: IntelligenceDomain[];
  tier: number;
}): IntelligenceDomain[] {
  const classified = [...new Set(input.classifiedDomains)];
  if (input.tier === 1 && classified.length > 0) return classified;

  const defaults = MISSION_TEMPLATES[input.intent].defaultDomains;
  if (input.intent === 'dd_acquisition') return [...defaults];
  if (input.intent === 'compare') {
    return [...new Set([...classified, ...defaults])];
  }
  return classified.length > 0 ? classified : [...defaults];
}

/** Best-effort ordered entity list for shared-dimension comparison contracts. */
export function resolveComparedEntities(input: {
  query: string;
  product?: string;
  competitor?: string;
  modelEntities?: unknown;
}): string[] {
  const entities: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const cleaned = value
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length < 2 || cleaned.length > 60) return;
    if (/^(?:(?:enterprise|mid-market|b2b)\s+)?(?:knowledge management|api management|software|platform|market|category|buyers?)$/i.test(cleaned)) {
      return;
    }
    if (!entities.some((entity) => entity.toLowerCase() === cleaned.toLowerCase())) {
      entities.push(cleaned);
    }
  };

  if (Array.isArray(input.modelEntities)) input.modelEntities.forEach(add);
  add(input.product);
  add(input.competitor);

  const match = input.query.match(
    /\b(?:compare|comparison of|versus|between)\s+(.+?)(?:\s+for\s+|\s+in\s+|\s+on\s+|\.|$)/i,
  );
  if (match?.[1]) {
    match[1]
      .split(/\s*(?:,| vs\.? | versus | and | with )\s*/i)
      .forEach(add);
  }
  return entities.slice(0, 6);
}

