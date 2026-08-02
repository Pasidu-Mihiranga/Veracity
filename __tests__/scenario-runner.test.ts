/**
 * Scenario runner.
 *
 * Aggregation is where a synthetic panel is most likely to mislead. These tests
 * hold the rules that prevent it: failures are counted rather than dropped,
 * a distribution that does not reconcile is withheld, dissent is surfaced, and
 * no probability is ever emitted.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runScenario,
  type ScenarioPorts,
  type PersonaRef,
} from '@/lib/intelligence/scenario-runner';
import type { ScenarioBrief } from '@/lib/intelligence/scenario-brief';

function brief(over: Partial<ScenarioBrief> = {}): ScenarioBrief {
  return {
    id: 'scenario-1',
    version: 1,
    parentVersion: null,
    branchReason: null,
    projectId: 'proj-1',
    decisionQuestion: 'Hold pricing or match the cut?',
    alternatives: [
      { id: 'A', label: 'Hold', description: 'Keep $59.' },
      { id: 'B', label: 'Match', description: 'Drop to $49.' },
    ],
    targetSegments: [
      { id: 'econ', label: 'Economic buyer', description: 'Signs.', panelSize: 2 },
      { id: 'user', label: 'Operator', description: 'Uses it.', panelSize: 2 },
    ],
    observedFacts: [
      { claimId: 'c1', statement: 'Competitor cut to $49.', evidenceSpanIds: ['s1'] },
    ],
    assumptions: ['Churn is price-sensitive'],
    uncertainties: ['Whether the cut is permanent'],
    exclusions: [],
    timeHorizon: '2 quarters',
    createdAt: '2026-08-02T00:00:00.000Z',
    ...over,
  } as ScenarioBrief;
}

const PANEL: PersonaRef[] = [
  { personaId: 'p1', segmentId: 'econ' },
  { personaId: 'p2', segmentId: 'econ' },
  { personaId: 'p3', segmentId: 'user' },
  { personaId: 'p4', segmentId: 'user' },
];

/** Ports where each persona answers with a scripted choice. */
function ports(
  choices: Record<string, string | null>,
  overrides: Partial<ScenarioPorts> = {},
): ScenarioPorts {
  return {
    buildPanel: vi.fn(async () => PANEL),
    ask: vi.fn(async ({ persona, round }) => ({
      response: `persona ${persona.personaId} round ${round}`,
      chosenAlternativeId: round === 3 ? choices[persona.personaId] : null,
      blockingObjection: round === 3 ? `objection from ${persona.personaId}` : null,
      missingInformation: round === 3 ? 'competitor churn data' : null,
    })),
    ...overrides,
  };
}

describe('running the rounds', () => {
  it('asks every persona in all three rounds', async () => {
    const p = ports({ p1: 'A', p2: 'A', p3: 'B', p4: 'A' });
    const outcome = await runScenario(brief(), p);

    expect(p.ask).toHaveBeenCalledTimes(12); // 4 personas x 3 rounds
    expect(outcome.status).toBe('complete');
    expect(outcome.responses.filter((r) => r.round === 1)).toHaveLength(4);
  });

  it('gives a persona only its own history', async () => {
    // Sharing other personas' answers manufactures the consensus the round
    // structure exists to avoid.
    const seen: string[] = [];
    const p = ports(
      { p1: 'A', p2: 'A', p3: 'B', p4: 'A' },
      {
        ask: vi.fn(async ({ persona, prompt, round }) => {
          if (round === 3) seen.push(prompt);
          return { response: `r${round} from ${persona.personaId}`, chosenAlternativeId: 'A' };
        }),
      },
    );

    await runScenario(brief(), p);

    const p1Prompt = seen[0];
    expect(p1Prompt).toContain('from p1');
    expect(p1Prompt).not.toContain('from p2');
  });

  it('never emits a probability', async () => {
    // Persona counts are counts. A percentage implies a sampling frame that
    // does not exist.
    const outcome = await runScenario(brief(), ports({ p1: 'A', p2: 'A', p3: 'B', p4: 'A' }));
    const serialised = JSON.stringify(outcome);
    expect(serialised).not.toMatch(/"probability"/);
    expect(serialised).not.toMatch(/"confidenceInterval"/);
    expect(outcome.label).toBe('synthetic-scenario');
  });
});

describe('distribution reconciliation', () => {
  it('reports counts that reconcile to the panel', async () => {
    const outcome = await runScenario(brief(), ports({ p1: 'A', p2: 'A', p3: 'B', p4: 'A' }));

    expect(outcome.distribution).toEqual([
      { alternativeId: 'A', count: 3 },
      { alternativeId: 'B', count: 1 },
    ]);
    const total = outcome.distribution!.reduce((sum, d) => sum + d.count, 0);
    expect(total + outcome.failedCount).toBe(outcome.panelSize);
  });

  it('withholds a distribution that does not sum to the panel', async () => {
    // A chart whose bars do not reach the stated total invites the reader to
    // infer a total that is not there.
    const outcome = await runScenario(
      brief(),
      ports({ p1: 'A', p2: null, p3: null, p4: null }),
    );

    expect(outcome.distribution).toBeNull();
    expect(outcome.distributionWithheldReason).toContain('withheld');
    expect(outcome.limitations.join(' ')).toContain('Distribution withheld');
  });

  it('ignores an alternative the persona invented', async () => {
    const outcome = await runScenario(
      brief(),
      ports({ p1: 'A', p2: 'A', p3: 'Z', p4: 'A' }),
    );
    // 'Z' is not in the brief, so it is not counted — and the totals then fail
    // to reconcile, which is correctly surfaced rather than hidden.
    expect(outcome.distribution).toBeNull();
  });

  it('breaks the result down by segment', async () => {
    const outcome = await runScenario(brief(), ports({ p1: 'A', p2: 'B', p3: 'B', p4: 'B' }));
    const econ = outcome.segmentBreakdown.filter((s) => s.segmentId === 'econ');
    expect(econ).toHaveLength(2);
    expect(econ.reduce((sum, s) => sum + s.count, 0)).toBe(2);
  });
});

describe('failures', () => {
  it('counts a failed persona rather than dropping it', async () => {
    // Dropping failures turns a half-broken run into a smaller panel that looks
    // complete, and the distribution then reads as consensus among survivors.
    const p = ports(
      { p1: 'A', p2: 'A', p3: 'B', p4: 'A' },
      {
        ask: vi.fn(async ({ persona, round }) => {
          if (persona.personaId === 'p4') throw new Error('model unavailable');
          return {
            response: `ok ${round}`,
            chosenAlternativeId: round === 3 ? (persona.personaId === 'p3' ? 'B' : 'A') : null,
          };
        }),
      },
    );

    const outcome = await runScenario(brief(), p);

    expect(outcome.failedCount).toBe(1);
    expect(outcome.respondedCount).toBe(3);
    expect(outcome.status).toBe('partial');
    expect(outcome.limitations.join(' ')).toContain('partial panel');
    // Still reconciles: 3 answered + 1 failed = 4.
    expect(outcome.distribution).not.toBeNull();
  });

  it('keeps asking a persona that failed an earlier round', async () => {
    // A transient error in round 2 must not silently shrink the decision round.
    let round2Failures = 0;
    const p = ports(
      { p1: 'A', p2: 'A', p3: 'A', p4: 'A' },
      {
        ask: vi.fn(async ({ persona, round }) => {
          if (round === 2 && persona.personaId === 'p1') {
            round2Failures += 1;
            throw new Error('transient');
          }
          return { response: `ok ${round}`, chosenAlternativeId: round === 3 ? 'A' : null };
        }),
      },
    );

    const outcome = await runScenario(brief(), p);

    expect(round2Failures).toBe(1);
    expect(outcome.respondedCount).toBe(4);
    expect(outcome.status).toBe('complete');
  });

  it('treats an empty response as a failure, not as an answer', async () => {
    const p = ports(
      {},
      { ask: vi.fn(async () => ({ response: '   ', chosenAlternativeId: 'A' })) },
    );
    const outcome = await runScenario(brief(), p);
    expect(outcome.status).toBe('failed');
    expect(outcome.failedCount).toBe(4);
  });

  it('fails the run rather than fabricating a panel', async () => {
    const p = ports({}, { buildPanel: vi.fn(async () => { throw new Error('no personas'); }) });
    const outcome = await runScenario(brief(), p);

    expect(outcome.status).toBe('failed');
    expect(outcome.responses).toEqual([]);
    expect(outcome.distribution).toBeNull();
    // Limitations survive even on the failure path, so a rendered failure is
    // still labelled synthetic.
    expect(outcome.limitations.join(' ')).toContain('not survey data');
  });

  it('fails on an empty panel', async () => {
    const p = ports({}, { buildPanel: vi.fn(async () => []) });
    expect((await runScenario(brief(), p)).status).toBe('failed');
  });
});

describe('dissent and movement', () => {
  it('surfaces minority positions', async () => {
    // A 3-1 split and a 4-0 split mean different things, and a bar chart alone
    // hides which happened.
    const outcome = await runScenario(brief(), ports({ p1: 'A', p2: 'A', p3: 'B', p4: 'A' }));
    expect(outcome.dissent).toHaveLength(1);
    expect(outcome.dissent[0].personaId).toBe('p3');
    expect(outcome.dissent[0].segmentId).toBe('user');
  });

  it('reports no dissent on unanimity', async () => {
    const outcome = await runScenario(brief(), ports({ p1: 'A', p2: 'A', p3: 'A', p4: 'A' }));
    expect(outcome.dissent).toEqual([]);
  });

  it('groups objections by frequency', async () => {
    const p = ports(
      {},
      {
        ask: vi.fn(async ({ persona, round }) => ({
          response: 'x',
          chosenAlternativeId: round === 3 ? 'A' : null,
          blockingObjection:
            round === 3
              ? persona.personaId === 'p4'
                ? 'Migration cost'
                : 'Contract lock-in.'
              : null,
        })),
      },
    );

    const outcome = await runScenario(brief(), p);

    expect(outcome.objections[0].personaIds).toHaveLength(3);
    expect(outcome.objections[0].text).toContain('Contract lock-in');
    expect(outcome.objections[1].personaIds).toEqual(['p4']);
  });

  it('records a persona changing position between rounds', async () => {
    const p = ports(
      {},
      {
        ask: vi.fn(async ({ persona, round }) => ({
          response: 'x',
          chosenAlternativeId:
            round === 2
              ? 'A'
              : round === 3
                ? persona.personaId === 'p1'
                  ? 'B'
                  : 'A'
                : null,
        })),
      },
    );

    const outcome = await runScenario(brief(), p, { challenge: 'They cut again.' });

    expect(outcome.positionChanges).toEqual([{ personaId: 'p1', from: 'A', to: 'B' }]);
  });

  it('collects information gaps without duplicating them', async () => {
    const outcome = await runScenario(brief(), ports({ p1: 'A', p2: 'A', p3: 'A', p4: 'A' }));
    expect(outcome.informationGaps).toEqual(['competitor churn data']);
  });
});
