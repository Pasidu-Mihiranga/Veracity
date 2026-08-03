/**
 * MiroFish adapter.
 *
 * The rule under test throughout: no fabrication on failure. An unreachable
 * worker, a short response list, or an unparseable answer must all produce
 * *fewer counted responses*, never a plausible substitute. The runner then
 * reports a partial panel and withholds a distribution it cannot reconcile,
 * which is the honest outcome.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const interviewLiveSwarm = vi.fn();
const isLiveSimulationReady = vi.fn();
const getLiveSimulationIdForProduct = vi.fn();
const getConfig = vi.fn();

vi.mock('@/lib/tools/mirofish-live', () => ({
  interviewLiveSwarm: (...args: unknown[]) => interviewLiveSwarm(...args),
  isLiveSimulationReady: (...args: unknown[]) => isLiveSimulationReady(...args),
  getLiveSimulationIdForProduct: (...args: unknown[]) => getLiveSimulationIdForProduct(...args),
}));
vi.mock('@/lib/config', () => ({ getConfig: () => getConfig() }));

import {
  createMirofishPorts,
  checkPanelAvailable,
  parseDecision,
} from '@/lib/intelligence/mirofish-adapter';
import { runScenario } from '@/lib/intelligence/scenario-runner';
import type { ScenarioBrief } from '@/lib/intelligence/scenario-brief';

const SEGMENTS = [
  { id: 'econ', label: 'Economic buyer', description: 'Signs.', panelSize: 2 },
  { id: 'user', label: 'Operator', description: 'Uses it.', panelSize: 1 },
];

function brief(): ScenarioBrief {
  return {
    id: 's1', version: 1, parentVersion: null, branchReason: null, projectId: 'p1',
    decisionQuestion: 'Hold or match?',
    alternatives: [
      { id: 'A', label: 'Hold', description: 'Keep $59.' },
      { id: 'B', label: 'Match', description: 'Drop to $49.' },
    ],
    targetSegments: SEGMENTS,
    observedFacts: [], assumptions: [], uncertainties: [], exclusions: [],
    timeHorizon: null, createdAt: '2026-08-02T00:00:00.000Z',
  } as ScenarioBrief;
}

function swarmResult(texts: string[], status: 'ok' | 'failed' = 'ok') {
  return {
    status,
    data: {
      simulationId: 'sim_x',
      prompt: 'p',
      responses: texts.map((response, i) => ({
        agent_id: i, response, platform: 'reddit' as const,
      })),
      totalCount: texts.length,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getConfig.mockReturnValue({
    MIROFISH_LIVE_BASE_URL: 'http://127.0.0.1:5001',
    MIROFISH_SERVICE_TOKEN: 'secret',
  });
});

describe('availability check', () => {
  it('refuses at the door when the base URL is missing', async () => {
    getConfig.mockReturnValue({ MIROFISH_SERVICE_TOKEN: 'secret' });
    const result = await checkPanelAvailable('Vector Agents');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('MIROFISH_LIVE_BASE_URL');
  });

  it('names the missing token specifically', async () => {
    // Without it every worker call returns 503, and the failure looks like an
    // outage rather than a missing setting.
    getConfig.mockReturnValue({ MIROFISH_LIVE_BASE_URL: 'http://127.0.0.1:5001' });
    const result = await checkPanelAvailable('Vector Agents');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('MIROFISH_SERVICE_TOKEN');
  });

  it('reports an unmatched product rather than guessing a simulation', async () => {
    getLiveSimulationIdForProduct.mockReturnValue(undefined);
    const result = await checkPanelAvailable('Unknown Co');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('no configured simulation');
  });

  it('reports an unprepared simulation', async () => {
    getLiveSimulationIdForProduct.mockReturnValue('sim_x');
    isLiveSimulationReady.mockResolvedValue(false);
    const result = await checkPanelAvailable('Vector Agents');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('not prepared');
  });

  it('passes when everything is configured and ready', async () => {
    getLiveSimulationIdForProduct.mockReturnValue('sim_x');
    isLiveSimulationReady.mockResolvedValue(true);
    const result = await checkPanelAvailable('Vector Agents');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.simulationId).toBe('sim_x');
  });
});

describe('panel construction', () => {
  it('derives personas from the brief, not from the worker', async () => {
    // The worker supplies voices; the brief supplies who they are meant to be.
    // Without this the runner's segment breakdown would be meaningless.
    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    const panel = await ports.buildPanel(SEGMENTS);

    expect(panel).toHaveLength(3);
    expect(panel.filter((p) => p.segmentId === 'econ')).toHaveLength(2);
    expect(panel.map((p) => p.personaId)).toEqual(['econ-1', 'econ-2', 'user-1']);
  });

  it('refuses a brief with no personas', async () => {
    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    await expect(ports.buildPanel([])).rejects.toThrow(/no personas/);
  });
});

describe('round execution', () => {
  it('calls the worker once per round, not once per persona', async () => {
    // The worker interviews the whole panel at once; per-persona calls would
    // multiply cost by the panel size for identical work.
    interviewLiveSwarm.mockResolvedValue(swarmResult(['a', 'b', 'c']));

    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    await runScenario(brief(), ports);

    expect(interviewLiveSwarm).toHaveBeenCalledTimes(3); // one per round
  });

  it('demultiplexes responses back to the right personas', async () => {
    interviewLiveSwarm.mockResolvedValue(swarmResult(['from econ 1', 'from econ 2', 'from user 1']));

    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    const outcome = await runScenario(brief(), ports);

    const round1 = outcome.responses.filter((r) => r.round === 1);
    expect(round1.find((r) => r.personaId === 'econ-1')?.response).toBe('from econ 1');
    expect(round1.find((r) => r.personaId === 'user-1')?.response).toBe('from user 1');
  });
});

describe('no fabrication on failure', () => {
  it('fails every persona when the worker is unreachable', async () => {
    interviewLiveSwarm.mockResolvedValue(swarmResult([], 'failed'));

    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    const outcome = await runScenario(brief(), ports);

    expect(outcome.status).toBe('failed');
    expect(outcome.distribution).toBeNull();
    // Nothing invented: every stored response is an explicit failure.
    expect(outcome.responses.every((r) => r.status === 'failed')).toBe(true);
    expect(outcome.responses.every((r) => r.response === '')).toBe(true);
  });

  it('fails the personas a short response list did not cover', async () => {
    // The panel is three; the worker returns two. The third must be counted as
    // failed rather than the panel being quietly shrunk to two.
    interviewLiveSwarm.mockResolvedValue(swarmResult(['one', 'two']));

    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    const outcome = await runScenario(brief(), ports);

    const round1 = outcome.responses.filter((r) => r.round === 1);
    expect(round1).toHaveLength(3);
    expect(round1.filter((r) => r.status === 'failed')).toHaveLength(1);
    expect(round1.find((r) => r.personaId === 'user-1')?.status).toBe('failed');
  });

  it('ignores extra responses rather than inventing personas', async () => {
    interviewLiveSwarm.mockResolvedValue(swarmResult(['a', 'b', 'c', 'd', 'e']));

    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    const outcome = await runScenario(brief(), ports);

    expect(outcome.panelSize).toBe(3);
    expect(outcome.responses.filter((r) => r.round === 1)).toHaveLength(3);
  });

  it('treats a blank worker response as a failure', async () => {
    interviewLiveSwarm.mockResolvedValue(swarmResult(['real', '   ', 'also real']));

    const ports = createMirofishPorts({ simulationId: 'sim_x' });
    const outcome = await runScenario(brief(), ports);

    const round1 = outcome.responses.filter((r) => r.round === 1);
    expect(round1.filter((r) => r.status === 'failed')).toHaveLength(1);
  });
});

describe('decision parsing', () => {
  it('extracts an explicit choice', () => {
    expect(parseDecision('After weighing both, I choose B because churn matters.')
      .chosenAlternativeId).toBe('B');
    expect(parseDecision('I would go with A.').chosenAlternativeId).toBe('A');
    expect(parseDecision('Option A is the safer path.').chosenAlternativeId).toBe('A');
  });

  it('returns no choice when the answer is unclear', () => {
    // A guessed position is worse than none: the runner then withholds the
    // distribution instead of attributing a stance nobody took.
    expect(parseDecision('Both options have merit and it depends on the quarter.')
      .chosenAlternativeId).toBeUndefined();
  });

  it('does not mistake a capital letter in prose for a choice', () => {
    expect(parseDecision('I think Acme has the stronger brand here.')
      .chosenAlternativeId).toBeUndefined();
  });

  it('extracts a blocking objection', () => {
    expect(parseDecision('My objection: migration cost is too high this quarter.')
      .blockingObjection).toContain('migration cost');
  });

  it('extracts missing information', () => {
    expect(parseDecision('I would need to know their renewal terms first.')
      .missingInformation).toContain('renewal terms');
  });

  it('returns an empty object for prose with none of these', () => {
    expect(parseDecision('Interesting question.')).toEqual({});
  });
});
