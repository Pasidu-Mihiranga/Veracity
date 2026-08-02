/**
 * ScenarioBrief contract.
 *
 * The risk this feature carries is a user reading synthetic persona output as
 * market research. Everything tested here exists to keep those two things
 * distinguishable: facts separated from assumptions, limitations attached
 * unconditionally, branches versioned rather than overwritten, and round 1 kept
 * free of cross-persona influence.
 */

import { describe, it, expect } from 'vitest';
import {
  validateScenarioBrief,
  branchScenario,
  scenarioCacheKey,
  buildRoundPrompt,
  scenarioLimitations,
  ROUND_PURPOSE,
  type ScenarioBrief,
} from '@/lib/intelligence/scenario-brief';

function brief(over: Partial<ScenarioBrief> = {}): ScenarioBrief {
  return {
    id: 'scenario-1',
    version: 1,
    parentVersion: null,
    branchReason: null,
    projectId: 'proj-1',
    decisionQuestion: 'Should we hold pricing or match the competitor’s cut?',
    alternatives: [
      { id: 'A', label: 'Hold pricing', description: 'Keep the current entry tier at $59.' },
      { id: 'B', label: 'Match the cut', description: 'Reduce the entry tier to $49.' },
    ],
    targetSegments: [
      { id: 'econ', label: 'Economic buyer', description: 'Signs the contract.', panelSize: 6 },
      { id: 'user', label: 'Daily operator', description: 'Uses the product.', panelSize: 6 },
    ],
    observedFacts: [
      {
        claimId: 'claim-1',
        statement: 'The competitor reduced its entry tier from $59 to $49 in March.',
        evidenceSpanIds: ['span-1'],
      },
    ],
    assumptions: ['Our churn is price-sensitive below $60'],
    uncertainties: ['Whether the competitor’s cut is permanent'],
    exclusions: ['Enterprise contracts already signed'],
    timeHorizon: '2 quarters',
    createdAt: '2026-08-02T00:00:00.000Z',
    ...over,
  } as ScenarioBrief;
}

describe('validation', () => {
  it('accepts a well-formed brief', () => {
    const result = validateScenarioBrief(brief());
    expect(result.ok).toBe(true);
  });

  it('rejects a decision with fewer than two alternatives', () => {
    const result = validateScenarioBrief(
      brief({ alternatives: [{ id: 'A', label: 'Hold', description: 'Keep pricing.' }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('not a decision');
  });

  it('rejects a fact with no evidence span', () => {
    // A "fact" with no evidence is an assumption wearing a disguise, and the
    // panel would be told it is established.
    const result = validateScenarioBrief(
      brief({
        observedFacts: [{ claimId: 'c1', statement: 'They will cut again', evidenceSpanIds: [] }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate alternative or segment ids', () => {
    expect(
      validateScenarioBrief(
        brief({
          alternatives: [
            { id: 'A', label: 'One', description: 'x' },
            { id: 'A', label: 'Two', description: 'y' },
          ],
        }),
      ).ok,
    ).toBe(false);

    expect(
      validateScenarioBrief(
        brief({
          targetSegments: [
            { id: 's', label: 'One', description: 'x', panelSize: 3 },
            { id: 's', label: 'Two', description: 'y', panelSize: 3 },
          ],
        }),
      ).ok,
    ).toBe(false);
  });

  it('warns without blocking when a scenario rests only on assumptions', () => {
    // A pure thought experiment is legitimate — it just has to be labelled.
    const result = validateScenarioBrief(brief({ observedFacts: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.join(' ')).toContain('thought experiment');
    }
  });

  it('warns when no assumptions are stated alongside facts', () => {
    // Usually means an unproven premise is hiding inside the question.
    const result = validateScenarioBrief(brief({ assumptions: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(' ')).toContain('unproven premise');
  });

  it('warns about a panel too small for segment comparison', () => {
    const result = validateScenarioBrief(
      brief({
        targetSegments: [
          { id: 'a', label: 'A', description: 'x', panelSize: 1 },
          { id: 'b', label: 'B', description: 'y', panelSize: 1 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(' ')).toContain('small');
  });
});

describe('branching', () => {
  it('creates a new version instead of overwriting the base', () => {
    // Overwriting destroys the only thing that makes the branch interesting.
    const base = brief();
    const branched = branchScenario(base, {
      assumptions: ['Our churn is NOT price-sensitive'],
      reason: 'Test the opposite price-sensitivity assumption',
    });

    expect(branched.version).toBe(2);
    expect(branched.parentVersion).toBe(1);
    expect(branched.branchReason).toContain('opposite');
    expect(branched.assumptions).toEqual(['Our churn is NOT price-sensitive']);

    // Base is untouched and still comparable.
    expect(base.version).toBe(1);
    expect(base.assumptions).toEqual(['Our churn is price-sensitive below $60']);
  });

  it('carries forward everything not explicitly changed', () => {
    const branched = branchScenario(brief(), { reason: 'r' });
    expect(branched.decisionQuestion).toBe(brief().decisionQuestion);
    expect(branched.observedFacts).toEqual(brief().observedFacts);
  });
});

describe('cache key', () => {
  const args = { modelVersion: 'gemini-x', panelVersion: 'panel-1' };

  it('is stable for the same brief, evidence, and model', () => {
    expect(scenarioCacheKey({ brief: brief(), ...args }))
      .toBe(scenarioCacheKey({ brief: brief(), ...args }));
  });

  it('changes when the evidence changes', () => {
    // Two runs of "the same" scenario against different evidence are different
    // runs. Colliding them serves a stale panel result as current.
    const other = brief({
      observedFacts: [
        { claimId: 'claim-1', statement: 'x', evidenceSpanIds: ['span-99'] },
      ],
    });
    expect(scenarioCacheKey({ brief: other, ...args }))
      .not.toBe(scenarioCacheKey({ brief: brief(), ...args }));
  });

  it('changes when the version, panel, or model changes', () => {
    const baseKey = scenarioCacheKey({ brief: brief(), ...args });
    expect(scenarioCacheKey({ brief: brief({ version: 2 }), ...args })).not.toBe(baseKey);
    expect(scenarioCacheKey({ brief: brief(), ...args, panelVersion: 'panel-2' })).not.toBe(baseKey);
    expect(scenarioCacheKey({ brief: brief(), ...args, modelVersion: 'gemini-y' })).not.toBe(baseKey);
  });
});

describe('round prompts', () => {
  const segment = brief().targetSegments[0];

  it('labels assumptions as unestablished', () => {
    // Otherwise a persona treats the premise as fact and its answer reads as
    // evidence for it.
    const prompt = buildRoundPrompt({ brief: brief(), round: 1, segment });
    expect(prompt).toContain('NOT established');
    expect(prompt).toContain('price-sensitive below $60');
  });

  it('separates verified facts from assumptions', () => {
    const prompt = buildRoundPrompt({ brief: brief(), round: 1, segment });
    const factsAt = prompt.indexOf('Verified facts');
    const assumptionsAt = prompt.indexOf('Assumptions');
    expect(factsAt).toBeGreaterThan(-1);
    expect(assumptionsAt).toBeGreaterThan(factsAt);
  });

  it('withholds other personas in round 1', () => {
    // Showing them produces artificial consensus: personas converge on whatever
    // they read first, and the agreement measures the prompt, not the segments.
    const prompt = buildRoundPrompt({ brief: brief(), round: 1, segment });
    expect(prompt).toContain('have not seen anyone else');
    expect(prompt).toContain(ROUND_PURPOSE[1]);
  });

  it('includes only this persona’s own prior rounds', () => {
    const prompt = buildRoundPrompt({
      brief: brief(),
      round: 2,
      segment,
      priorResponses: [{ round: 1, response: 'I would hold pricing.' }],
      challenge: 'The competitor has now cut a second time.',
    });
    expect(prompt).toContain('your own earlier responses'.replace('your', 'Your'));
    expect(prompt).toContain('I would hold pricing.');
    expect(prompt).toContain('second time');
  });

  it('asks for a structured choice in round 3', () => {
    const prompt = buildRoundPrompt({ brief: brief(), round: 3, segment });
    expect(prompt).toContain('alternative id you choose');
    expect(prompt).toContain('blocking');
    expect(prompt).toContain('information you would need');
  });

  it('states what is out of scope', () => {
    const prompt = buildRoundPrompt({ brief: brief(), round: 1, segment });
    expect(prompt).toContain('Out of scope');
    expect(prompt).toContain('Enterprise contracts');
  });
});

describe('limitations', () => {
  it('always says the output is synthetic and not survey data', () => {
    const limitations = scenarioLimitations(brief());
    const joined = limitations.join(' ');
    expect(joined).toContain('not survey data');
    expect(joined).toContain('not real customers');
  });

  it('always denies statistical weight to persona agreement', () => {
    // The single most dangerous misreading: many agents agreeing looks like
    // evidence and is not.
    expect(scenarioLimitations(brief()).join(' ')).toContain('no statistical weight');
  });

  it('always denies that the result is a prediction', () => {
    expect(scenarioLimitations(brief()).join(' ')).toContain('not calibrated');
  });

  it('reports the real panel size', () => {
    expect(scenarioLimitations(brief()).join(' ')).toContain('12 synthetic persona');
  });

  it('flags assumption dependence and pure thought experiments', () => {
    expect(scenarioLimitations(brief()).join(' ')).toContain('1 stated assumption');
    expect(scenarioLimitations(brief({ observedFacts: [] })).join(' '))
      .toContain('thought experiment');
  });
});
