import type { IntelligenceDomain } from '@/lib/agents/types';

const RESEARCH_PRIORITY: IntelligenceDomain[] = [
  'competitive',
  'market-trends',
  'win-loss',
  'positioning',
  'pricing',
  'adjacent',
];

const FULL_RESEARCH: IntelligenceDomain[] = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
];

/**
 * Cost-aware agent set: UI ∩ classifier domains, padded to ≥3, or full sweep.
 */
export function resolveAgentSet(input: {
  uiSelected: string[];
  classifierDomains: IntelligenceDomain[];
  forceFullSweep?: boolean;
  minAgents?: number;
}): {
  researchIds: IntelligenceDomain[];
  executionSelected: boolean;
  mirofish: boolean;
  mirofishLive: boolean;
  savedVsFull: number;
  mode: 'full' | 'adaptive';
} {
  const ui = new Set(input.uiSelected);
  const executionSelected = ui.has('execution-engine');
  const mirofish = ui.has('mirofish');
  const mirofishLive = ui.has('mirofish-live');
  const minAgents = input.minAgents !== undefined ? input.minAgents : 3;

  if (input.forceFullSweep) {
    const researchIds = FULL_RESEARCH.filter((id) => ui.has(id) || ui.size === 0);
    const finalIds = researchIds.length >= Math.max(1, minAgents) ? researchIds : FULL_RESEARCH;
    return {
      researchIds: finalIds,
      executionSelected,
      mirofish,
      mirofishLive,
      savedVsFull: Math.max(0, FULL_RESEARCH.length - finalIds.length),
      mode: 'full',
    };
  }

  const classified = (input.classifierDomains ?? []).filter((d) =>
    FULL_RESEARCH.includes(d),
  );
  const uiResearch = FULL_RESEARCH.filter((id) => ui.has(id));
  const basePool = uiResearch.length > 0 ? uiResearch : FULL_RESEARCH;

  let researchIds = classified.length > 0
    ? basePool.filter((id) => classified.includes(id))
    : (minAgents === 0 ? [] : basePool.slice(0, minAgents));

  // If minAgents is 0 (Tier 0 direct response), return empty researchIds
  if (minAgents === 0) {
    return {
      researchIds: [],
      executionSelected,
      mirofish,
      mirofishLive,
      savedVsFull: FULL_RESEARCH.length,
      mode: 'adaptive',
    };
  }

  // Pad to minimum from classifier priority, then full list
  if (researchIds.length < minAgents) {
    for (const id of [...classified, ...RESEARCH_PRIORITY, ...FULL_RESEARCH]) {
      if (researchIds.length >= minAgents) break;
      if (!researchIds.includes(id) && basePool.includes(id)) {
        researchIds.push(id);
      }
    }
  }

  // Still short — pad from RESEARCH_PRIORITY up to minAgents
  if (researchIds.length < minAgents) {
    for (const id of RESEARCH_PRIORITY) {
      if (researchIds.length >= minAgents) break;
      if (!researchIds.includes(id)) researchIds.push(id);
    }
  }

  researchIds = researchIds.slice(0, Math.max(minAgents, researchIds.length));

  return {
    researchIds,
    executionSelected,
    mirofish,
    mirofishLive,
    savedVsFull: Math.max(0, FULL_RESEARCH.length - researchIds.length),
    mode: researchIds.length < FULL_RESEARCH.length ? 'adaptive' : 'full',
  };
}
