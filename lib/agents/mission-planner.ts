import type { IntelligenceDomain } from '@/lib/agents/types';
import {
  MISSION_TEMPLATES,
  type ResearchIntentClass,
} from '@/lib/agents/research-intents';

export type MissionResearchDomain =
  | 'market-trends'
  | 'competitive'
  | 'win-loss'
  | 'pricing'
  | 'positioning'
  | 'adjacent'
  | 'execution-engine';

export type MissionStep = {
  id: string;
  agentId: MissionResearchDomain;
  label: string;
  dependsOn: string[];
  rationale: string;
  stage: 'scope' | 'collect' | 'cross-reference' | 'act';
  objective: string;
  deliverables: string[];
};

const LABELS: Record<MissionResearchDomain, string> = {
  'market-trends': 'Research market',
  competitive: 'Analyze competitors',
  'win-loss': 'Map win / loss drivers',
  pricing: 'Compare pricing',
  positioning: 'Compare positioning',
  adjacent: 'Scan adjacent threats',
  'execution-engine': 'Generate recommendations / copy',
};

const RESEARCH: MissionResearchDomain[] = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
  'execution-engine',
];

/**
 * Deterministic mission DAG from selected research domains.
 */
export function planMission(
  agentIds: IntelligenceDomain[],
  intent: ResearchIntentClass = 'market',
): MissionStep[] {
  const set = new Set(
    agentIds.filter((id): id is MissionResearchDomain =>
      (RESEARCH as string[]).includes(id),
    ),
  );
  const steps: MissionStep[] = [];
  const template = MISSION_TEMPLATES[intent];

  const add = (
    agentId: MissionResearchDomain,
    dependsOn: string[],
    rationale: string,
    stage: MissionStep['stage'],
  ) => {
    if (!set.has(agentId)) return;
    const id = `step-${agentId}`;
    steps.push({
      id,
      agentId,
      label: missionStepLabel(intent, agentId),
      dependsOn,
      rationale: `${template.label}: ${rationale}`,
      stage,
      objective: template.objective,
      deliverables: template.deliverables,
    });
  };

  add('market-trends', [], 'Category direction and leading indicators', 'collect');
  add('competitive', [], 'Feature bets and competitive landscape', 'collect');
  const competitiveId = set.has('competitive') ? 'step-competitive' : undefined;
  add(
    'win-loss',
    competitiveId ? [competitiveId] : [],
    'Buyer-side win/loss grounded in competitor context',
    'cross-reference',
  );
  add(
    'positioning',
    competitiveId ? [competitiveId] : [],
    'Messaging gaps vs competitor framing',
    'cross-reference',
  );
  add('pricing', [], 'Packaging and willingness-to-pay signals', 'collect');
  add(
    'adjacent',
    competitiveId ? [competitiveId] : [],
    'External category collision threats',
    'cross-reference',
  );
  add(
    'execution-engine',
    steps.filter((s) => s.agentId !== 'execution-engine').map((s) => s.id),
    'Action artifacts grounded in Stage-1 research',
    'act',
  );

  return steps;
}

function missionStepLabel(
  intent: ResearchIntentClass,
  agentId: MissionResearchDomain,
): string {
  if (intent === 'dd_acquisition') {
    const labels: Partial<Record<MissionResearchDomain, string>> = {
      'market-trends': 'Verify target and market',
      competitive: 'Map business model and peers',
      'win-loss': 'Investigate customers and people',
      pricing: 'Check financial and pricing signals',
      positioning: 'Assess product and claims',
      adjacent: 'Build acquisition risk register',
    };
    return labels[agentId] ?? LABELS[agentId];
  }
  if (intent === 'compare') {
    const labels: Partial<Record<MissionResearchDomain, string>> = {
      competitive: 'Define shared comparison dimensions',
      pricing: 'Compare commercial evidence',
      positioning: 'Compare positioning evidence',
      'win-loss': 'Compare buyer and switching evidence',
    };
    return labels[agentId] ?? LABELS[agentId];
  }
  return LABELS[agentId];
}

/** Group steps into parallel waves by dependency order. */
export function missionWaves(steps: MissionStep[]): MissionStep[][] {
  const remaining = new Map(steps.map((s) => [s.id, s]));
  const done = new Set<string>();
  const waves: MissionStep[][] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((s) =>
      s.dependsOn.every((dep) => done.has(dep) || !steps.some((x) => x.id === dep)),
    );
    const batch = ready.length > 0 ? ready : [[...remaining.values()][0]];
    waves.push(batch);
    for (const s of batch) {
      remaining.delete(s.id);
      done.add(s.id);
    }
  }

  return waves;
}
