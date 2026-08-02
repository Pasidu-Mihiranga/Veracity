/**
 * Adapts the MiroFish worker to the scenario runner's ports.
 *
 * The worker interviews a whole panel per call and returns one response per
 * agent. The runner asks per persona per round, which is what makes round 1's
 * independence real — each persona is prompted without seeing anyone else's
 * answer. Bridging the two means one worker call per round, with responses
 * demultiplexed back to the personas that produced them.
 *
 * The rule this module must not break: **no fabrication on failure.** If the
 * worker is unconfigured, unreachable, or returns fewer responses than the
 * panel has personas, the missing personas fail individually. They are never
 * filled in with a plausible answer, and the panel is never quietly shrunk to
 * whatever came back — the runner counts those failures and reports a partial
 * panel.
 */

import { getConfig } from '@/lib/config';
import {
  getLiveSimulationIdForProduct,
  isLiveSimulationReady,
  interviewLiveSwarm,
} from '@/lib/tools/mirofish-live';
import type { ScenarioPorts, PersonaRef, PersonaAnswer } from './scenario-runner';
import type { ScenarioSegment } from './scenario-brief';

export class MirofishUnavailableError extends Error {
  constructor(reason: string) {
    super(`The synthetic panel is unavailable: ${reason}`);
    this.name = 'MirofishUnavailableError';
  }
}

/**
 * Check the worker is usable before a run starts.
 *
 * Deliberately eager. Discovering the service is down after two rounds have
 * been billed is worse than refusing at the door, and the user gets a specific
 * reason rather than a panel that mysteriously produced nothing.
 */
export async function checkPanelAvailable(product: string): Promise<
  { ok: true; simulationId: string } | { ok: false; reason: string }
> {
  const config = getConfig();

  if (!config.MIROFISH_LIVE_BASE_URL) {
    return { ok: false, reason: 'MIROFISH_LIVE_BASE_URL is not configured' };
  }
  if (!config.MIROFISH_SERVICE_TOKEN) {
    // Named explicitly: without it every worker call returns 503, and the
    // resulting failure looks like an outage rather than a missing setting.
    return { ok: false, reason: 'MIROFISH_SERVICE_TOKEN is not configured' };
  }

  const simulationId = getLiveSimulationIdForProduct(product);
  if (!simulationId) {
    return {
      ok: false,
      reason: `no configured simulation matches "${product}" — add one to MIROFISH_LIVE_SIMULATIONS`,
    };
  }

  const ready = await isLiveSimulationReady(simulationId);
  if (!ready) {
    return { ok: false, reason: `simulation ${simulationId} is not prepared` };
  }

  return { ok: true, simulationId };
}

/**
 * Build ports backed by the MiroFish worker.
 *
 * One worker call per round is cached and demultiplexed, rather than one call
 * per persona: the worker interviews the whole panel at once, so calling it per
 * persona would multiply cost by the panel size for identical work.
 */
export function createMirofishPorts(params: {
  simulationId: string;
  maxAgents?: number;
  timeoutSec?: number;
}): ScenarioPorts {
  const { simulationId, maxAgents = 5, timeoutSec = 180 } = params;

  /** round -> personaId -> response text, filled on the first ask of a round. */
  const roundResponses = new Map<number, Map<string, string>>();
  /** round -> the failure that prevented that round entirely, if any. */
  const roundFailures = new Map<number, string>();
  const inFlight = new Map<number, Promise<void>>();

  let panel: PersonaRef[] = [];

  async function runRound(round: number, prompt: string): Promise<void> {
    const existing = inFlight.get(round);
    if (existing) return existing;

    const work = (async () => {
      const result = await interviewLiveSwarm(simulationId, prompt, {
        maxAgents,
        timeoutSec,
      });

      if (result.status === 'failed' || result.data.responses.length === 0) {
        roundFailures.set(
          round,
          result.status === 'failed'
            ? 'the worker reported the interview failed'
            : 'the worker returned no responses',
        );
        return;
      }

      // Map worker agents back onto the personas the runner knows about, in
      // panel order. Extra responses are ignored rather than invented into
      // personas that do not exist.
      const byPersona = new Map<string, string>();
      result.data.responses.forEach((response, index) => {
        const persona = panel[index];
        if (!persona) return;
        const text = response.response?.trim();
        if (text) byPersona.set(persona.personaId, text);
      });

      roundResponses.set(round, byPersona);
    })();

    inFlight.set(round, work);
    return work;
  }

  return {
    async buildPanel(segments: ScenarioSegment[]): Promise<PersonaRef[]> {
      // Personas are derived from the brief's segments rather than from the
      // worker, so the runner's segment breakdown stays meaningful. The worker
      // supplies the voices; the brief supplies who they are meant to be.
      panel = segments.flatMap((segment) =>
        Array.from({ length: segment.panelSize }, (_, i) => ({
          personaId: `${segment.id}-${i + 1}`,
          segmentId: segment.id,
        })),
      );

      if (panel.length === 0) {
        throw new MirofishUnavailableError('the brief defines no personas');
      }

      return panel;
    },

    async ask({ persona, prompt, round }): Promise<PersonaAnswer> {
      await runRound(round, prompt);

      const failure = roundFailures.get(round);
      if (failure) throw new MirofishUnavailableError(failure);

      const response = roundResponses.get(round)?.get(persona.personaId);
      if (!response) {
        // This persona specifically got nothing back. Throwing marks it failed
        // in the runner, which counts it against the panel — the alternative,
        // returning empty text, would silently shrink the panel.
        throw new Error('the worker returned no response for this persona');
      }

      return {
        response,
        // The worker returns prose, not structured choices. Parsing the chosen
        // alternative out of round 3 is done here rather than trusting the
        // model to have emitted an id.
        ...(round === 3 ? parseDecision(response) : {}),
      };
    },
  };
}

/**
 * Pull a structured decision out of a prose answer.
 *
 * Conservative on purpose: an unparseable answer yields no choice rather than a
 * guessed one. The runner then fails to reconcile the distribution and withholds
 * it, which is the correct outcome — better than attributing a position to a
 * persona that never clearly took it.
 */
export function parseDecision(response: string): Partial<PersonaAnswer> {
  const out: Partial<PersonaAnswer> = {};

  // "I choose A", "Option B", "Alternative: C" — a bare capital letter is not
  // enough on its own, since prose is full of them.
  //
  // The keyword match is case-insensitive ("Option" opens a sentence as often
  // as "option" sits inside one), but the captured id must still start
  // uppercase. Applying the `i` flag to the whole pattern would let "go with
  // the cheaper plan" capture "the", so the case check is re-applied after the
  // match rather than being dropped.
  const choice = response.match(
    /\b(?:choose|choosing|select|selecting|pick|prefer|go with|option|alternative)\b[:\s]*"?([A-Za-z0-9][A-Za-z0-9_-]{0,15})"?/i,
  );
  if (choice && /^[A-Z0-9]/.test(choice[1])) out.chosenAlternativeId = choice[1];

  const objection = response.match(
    /\b(?:blocking objection|blocker|would block|deal[- ]?breaker|my objection)\b[:\s]*(.{5,240}?)(?:[.\n]|$)/i,
  );
  if (objection) out.blockingObjection = objection[1].trim();

  const missing = response.match(
    /\b(?:missing information|i would need|need to know|information i need|what i need)\b[:\s]*(.{5,240}?)(?:[.\n]|$)/i,
  );
  if (missing) out.missingInformation = missing[1].trim();

  return out;
}
