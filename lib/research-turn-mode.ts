export type ResearchTurnMode = 'explain' | 'verify' | 'compare' | 'swarm' | 'refresh';

export const RESEARCH_TURN_MODE_COPY: Record<ResearchTurnMode, { label: string; instruction: string }> = {
  explain: {
    label: 'Explain saved research',
    instruction: 'Turn mode: Explain. Prioritize saved project/session evidence and clearly state when no fresh collection was performed.',
  },
  verify: {
    label: 'Verify or update',
    instruction: 'Turn mode: Verify/update. Re-check only the claims needed to answer, use fresh sources where time-sensitive, and identify what changed versus saved evidence.',
  },
  compare: {
    label: 'Compare or branch',
    instruction: 'Turn mode: Compare/branch. Compare the requested alternatives on the same criteria and preserve the prior branch as context.',
  },
  swarm: {
    label: 'Ask synthetic panel',
    instruction: 'Turn mode: Ask swarm. Treat panel output as a synthetic stakeholder scenario, never observed customer evidence or calibrated prediction.',
  },
  refresh: {
    label: 'Full refresh',
    instruction: 'Turn mode: Full refresh. Run a complete evidence refresh and explicitly distinguish new findings from prior saved research.',
  },
};

export function isResearchTurnMode(value: unknown): value is ResearchTurnMode {
  return typeof value === 'string' && value in RESEARCH_TURN_MODE_COPY;
}
