import type { IntelligenceDomain } from '@/lib/agents/types';

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
export function planMission(agentIds: IntelligenceDomain[]): MissionStep[] {
  const set = new Set(
    agentIds.filter((id): id is MissionResearchDomain =>
      (RESEARCH as string[]).includes(id),
    ),
  );
  const steps: MissionStep[] = [];

  const add = (agentId: MissionResearchDomain, dependsOn: string[], rationale: string) => {
    if (!set.has(agentId)) return;
    const id = `step-${agentId}`;
    steps.push({
      id,
      agentId,
      label: LABELS[agentId],
      dependsOn,
      rationale,
    });
  };

  add('market-trends', [], 'Category direction and leading indicators');
  add('competitive', [], 'Feature bets and competitive landscape');
  const competitiveId = set.has('competitive') ? 'step-competitive' : undefined;
  add(
    'win-loss',
    competitiveId ? [competitiveId] : [],
    'Buyer-side win/loss grounded in competitor context',
  );
  add(
    'positioning',
    competitiveId ? [competitiveId] : [],
    'Messaging gaps vs competitor framing',
  );
  add('pricing', [], 'Packaging and willingness-to-pay signals');
  add(
    'adjacent',
    competitiveId ? [competitiveId] : [],
    'External category collision threats',
  );
  add(
    'execution-engine',
    steps.filter((s) => s.agentId !== 'execution-engine').map((s) => s.id),
    'Action artifacts grounded in Stage-1 research',
  );

  return steps;
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
