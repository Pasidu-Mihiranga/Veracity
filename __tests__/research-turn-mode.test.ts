import { describe, expect, it } from 'vitest';
import {
  isResearchTurnMode,
  RESEARCH_TURN_MODE_COPY,
  type ResearchTurnMode,
} from '@/lib/research-turn-mode';

describe('research turn modes', () => {
  it('accepts only the five supported modes', () => {
    const modes: ResearchTurnMode[] = ['explain', 'verify', 'compare', 'swarm', 'refresh'];
    expect(modes.every(isResearchTurnMode)).toBe(true);
    expect(isResearchTurnMode('forecast')).toBe(false);
    expect(isResearchTurnMode(undefined)).toBe(false);
  });

  it('gives each mode a visible label and bounded instruction', () => {
    for (const entry of Object.values(RESEARCH_TURN_MODE_COPY)) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.instruction).toContain('Turn mode:');
    }
    expect(RESEARCH_TURN_MODE_COPY.swarm.instruction).toContain('synthetic stakeholder scenario');
    expect(RESEARCH_TURN_MODE_COPY.refresh.instruction).toContain('complete evidence refresh');
  });
});
