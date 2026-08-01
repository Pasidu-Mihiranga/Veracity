import type { IntelligenceDomain } from '@/lib/agents/types';
import type { MissionStep } from '@/lib/agents/mission-planner';
import {
  MISSION_TEMPLATES,
  type ResearchIntentClass,
} from '@/lib/agents/research-intents';

/** Heuristic cost per agent (mirrors live chat readout). */
export const EST_COST_PER_AGENT_USD =
  2000 * (0.1 / 1_000_000) + 1000 * (0.4 / 1_000_000);

export const EST_SECONDS_PER_AGENT = 12;

export type MissionSummary = {
  steps: Array<{ id: string; label: string; agentId: string }>;
  agentCount: number;
  estimatedSeconds: number;
  estimatedCostUsd: number;
  product?: string;
  competitor?: string;
  intent?: ResearchIntentClass;
  objective?: string;
  deliverables?: string[];
};

export function buildMissionSummary(input: {
  steps: MissionStep[];
  product?: string;
  competitor?: string;
  /** Exclude execution from count when deferred */
  includeExecution?: boolean;
  intent?: ResearchIntentClass;
}): MissionSummary {
  const steps = input.includeExecution === false
    ? input.steps.filter((s) => s.agentId !== 'execution-engine')
    : input.steps;
  const agentCount = steps.length;
  const template = input.intent ? MISSION_TEMPLATES[input.intent] : undefined;
  return {
    steps: steps.map((s) => ({ id: s.id, label: s.label, agentId: s.agentId })),
    agentCount,
    estimatedSeconds: Math.max(8, agentCount * EST_SECONDS_PER_AGENT),
    estimatedCostUsd: Number((agentCount * EST_COST_PER_AGENT_USD).toFixed(4)),
    product: input.product,
    competitor: input.competitor,
    intent: input.intent,
    objective: template?.objective,
    deliverables: template?.deliverables,
  };
}

export function progressFromSteps(
  totalSteps: number,
  completedAgentIds: string[],
  plannedAgentIds: IntelligenceDomain[],
): { pct: number; completedSteps: number; totalSteps: number } {
  const planned = plannedAgentIds.filter((id) => id !== 'mirofish' && id !== 'mirofish-live');
  const total = totalSteps || planned.length || 1;
  const completed = planned.filter((id) => completedAgentIds.includes(id)).length;
  return {
    pct: Math.min(100, Math.round((completed / total) * 100)),
    completedSteps: completed,
    totalSteps: total,
  };
}
