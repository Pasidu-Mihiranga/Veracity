/**
 * Scenario runner — executes the three rounds and aggregates the result.
 *
 * The aggregation is where a synthetic panel is most likely to mislead, so the
 * rules are strict:
 *
 *  - **Failed personas are counted as failures, never dropped.** Silently
 *    excluding them turns a half-broken run into a smaller panel that looks
 *    complete, and the distribution then reads as consensus among the survivors.
 *  - **Counts must reconcile to the panel size.** If they do not, the
 *    distribution is withheld rather than rendered — a chart whose bars do not
 *    sum to the panel is worse than no chart.
 *  - **Dissent is surfaced, not smoothed.** A 7–5 split and a 12–0 split mean
 *    entirely different things, and a bar chart alone hides which one happened.
 *  - **No probability is emitted.** Persona counts are counts. Converting them
 *    to a percentage implies a sampling frame that does not exist.
 */

import {
  buildRoundPrompt,
  scenarioLimitations,
  type ScenarioBrief,
  type ScenarioRound,
  type ScenarioSegment,
} from './scenario-brief';

// ── Ports ───────────────────────────────────────────────────────────────────

export interface PersonaRef {
  personaId: string;
  segmentId: string;
}

export interface PersonaAnswer {
  response: string;
  chosenAlternativeId?: string | null;
  blockingObjection?: string | null;
  missingInformation?: string | null;
}

export interface ScenarioPorts {
  /**
   * Materialise the panel. Returning fewer personas than requested is reported
   * as a partial panel rather than quietly accepted.
   */
  buildPanel: (segments: ScenarioSegment[]) => Promise<PersonaRef[]>;
  /** Ask one persona one round. Throwing marks that persona failed. */
  ask: (params: {
    persona: PersonaRef;
    prompt: string;
    round: ScenarioRound;
  }) => Promise<PersonaAnswer>;
}

// ── Result ──────────────────────────────────────────────────────────────────

export interface PersonaResponseRecord extends PersonaRef {
  round: ScenarioRound;
  response: string;
  chosenAlternativeId: string | null;
  blockingObjection: string | null;
  missingInformation: string | null;
  status: 'ok' | 'failed';
  failureReason?: string;
}

export interface ScenarioOutcome {
  scenarioId: string;
  scenarioVersion: number;
  label: 'synthetic-scenario';

  /** Personas the panel was supposed to contain. */
  panelSize: number;
  /** Personas that answered the decision round. */
  respondedCount: number;
  failedCount: number;

  responses: PersonaResponseRecord[];

  /** Counts per alternative. Null when they cannot be reconciled to the panel. */
  distribution: Array<{ alternativeId: string; count: number }> | null;
  distributionWithheldReason?: string;

  segmentBreakdown: Array<{ segmentId: string; alternativeId: string; count: number }>;
  objections: Array<{ text: string; personaIds: string[] }>;
  dissent: Array<{ personaId: string; segmentId: string; summary: string }>;
  positionChanges: Array<{ personaId: string; from: string; to: string }>;
  informationGaps: string[];

  limitations: string[];
  status: 'complete' | 'partial' | 'failed';
}

/**
 * Run a full three-round scenario.
 *
 * A persona that fails one round is still asked the next: a transient model
 * error in round 2 should not silently remove someone from the decision round
 * and shrink the panel.
 */
export async function runScenario(
  brief: ScenarioBrief,
  ports: ScenarioPorts,
  options: { challenge?: string } = {},
): Promise<ScenarioOutcome> {
  const expectedPanelSize = brief.targetSegments.reduce((sum, s) => sum + s.panelSize, 0);
  const segmentsById = new Map(brief.targetSegments.map((s) => [s.id, s]));

  let panel: PersonaRef[];
  try {
    panel = await ports.buildPanel(brief.targetSegments);
  } catch (err) {
    // No fabricated panel. A panel that could not be built is a failed run.
    return failedOutcome(brief, expectedPanelSize, err);
  }

  if (panel.length === 0) return failedOutcome(brief, expectedPanelSize, 'the panel was empty');

  const responses: PersonaResponseRecord[] = [];
  const priorByPersona = new Map<string, Array<{ round: number; response: string }>>();

  for (const round of [1, 2, 3] as ScenarioRound[]) {
    const asked = panel.map(async (persona) => {
      const segment = segmentsById.get(persona.segmentId);
      if (!segment) {
        return record(persona, round, null, 'persona belongs to an unknown segment');
      }

      const prompt = buildRoundPrompt({
        brief,
        round,
        segment,
        // Only this persona's own history. Sharing others' answers would
        // manufacture the consensus the round structure exists to avoid.
        priorResponses: priorByPersona.get(persona.personaId) ?? [],
        challenge: round === 2 ? options.challenge : undefined,
      });

      try {
        const answer = await ports.ask({ persona, prompt, round });
        if (!answer?.response?.trim()) {
          return record(persona, round, null, 'the persona returned an empty response');
        }
        return record(persona, round, answer);
      } catch (err) {
        return record(persona, round, null, err instanceof Error ? err.message : String(err));
      }
    });

    const settled = await Promise.all(asked);
    for (const entry of settled) {
      responses.push(entry);
      if (entry.status === 'ok') {
        const history = priorByPersona.get(entry.personaId) ?? [];
        history.push({ round: entry.round, response: entry.response });
        priorByPersona.set(entry.personaId, history);
      }
    }
  }

  return aggregate(brief, expectedPanelSize, responses);
}

function record(
  persona: PersonaRef,
  round: ScenarioRound,
  answer: PersonaAnswer | null,
  failureReason?: string,
): PersonaResponseRecord {
  if (!answer) {
    return {
      ...persona,
      round,
      response: '',
      chosenAlternativeId: null,
      blockingObjection: null,
      missingInformation: null,
      status: 'failed',
      failureReason,
    };
  }

  return {
    ...persona,
    round,
    response: answer.response,
    chosenAlternativeId: answer.chosenAlternativeId ?? null,
    blockingObjection: answer.blockingObjection ?? null,
    missingInformation: answer.missingInformation ?? null,
    status: 'ok',
  };
}

function failedOutcome(
  brief: ScenarioBrief,
  panelSize: number,
  reason: unknown,
): ScenarioOutcome {
  return {
    scenarioId: brief.id,
    scenarioVersion: brief.version,
    label: 'synthetic-scenario',
    panelSize,
    respondedCount: 0,
    failedCount: panelSize,
    responses: [],
    distribution: null,
    distributionWithheldReason:
      reason instanceof Error ? reason.message : String(reason ?? 'the panel could not be built'),
    segmentBreakdown: [],
    objections: [],
    dissent: [],
    positionChanges: [],
    informationGaps: [],
    limitations: scenarioLimitations(brief),
    status: 'failed',
  };
}

/** Normalise objection text so near-identical wording groups together. */
function objectionKey(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function aggregate(
  brief: ScenarioBrief,
  expectedPanelSize: number,
  responses: PersonaResponseRecord[],
): ScenarioOutcome {
  const decisionRound = responses.filter((r) => r.round === 3);
  const answered = decisionRound.filter((r) => r.status === 'ok' && r.chosenAlternativeId);
  const failed = decisionRound.filter((r) => r.status === 'failed');

  const validAlternatives = new Set(brief.alternatives.map((a) => a.id));

  // Counts per alternative, ignoring anything the persona invented.
  const counts = new Map<string, number>();
  const bySegment = new Map<string, Map<string, number>>();

  for (const response of answered) {
    const choice = response.chosenAlternativeId!;
    if (!validAlternatives.has(choice)) continue;

    counts.set(choice, (counts.get(choice) ?? 0) + 1);
    if (!bySegment.has(response.segmentId)) bySegment.set(response.segmentId, new Map());
    const segment = bySegment.get(response.segmentId)!;
    segment.set(choice, (segment.get(choice) ?? 0) + 1);
  }

  const counted = [...counts.values()].reduce((sum, n) => sum + n, 0);

  // The distribution is only shown if it reconciles. A chart whose bars do not
  // sum to the panel invites the reader to infer a total that is not there.
  let distribution: ScenarioOutcome['distribution'] = null;
  let withheldReason: string | undefined;

  if (counted === 0) {
    withheldReason = 'no persona selected a valid alternative in the decision round';
  } else if (counted + failed.length !== expectedPanelSize) {
    withheldReason =
      `counts reconcile to ${counted + failed.length} of an expected panel of ${expectedPanelSize}; ` +
      'the distribution is withheld rather than shown against a total it does not sum to';
  } else {
    distribution = brief.alternatives.map((a) => ({
      alternativeId: a.id,
      count: counts.get(a.id) ?? 0,
    }));
  }

  const segmentBreakdown: ScenarioOutcome['segmentBreakdown'] = [];
  for (const [segmentId, choices] of bySegment) {
    for (const [alternativeId, count] of choices) {
      segmentBreakdown.push({ segmentId, alternativeId, count });
    }
  }

  // Objections grouped by normalised text, most common first.
  const objectionGroups = new Map<string, { text: string; personaIds: string[] }>();
  for (const response of decisionRound) {
    const text = response.blockingObjection?.trim();
    if (!text) continue;
    const key = objectionKey(text);
    if (!objectionGroups.has(key)) objectionGroups.set(key, { text, personaIds: [] });
    objectionGroups.get(key)!.personaIds.push(response.personaId);
  }
  const objections = [...objectionGroups.values()].sort(
    (a, b) => b.personaIds.length - a.personaIds.length,
  );

  // Dissent: anyone not choosing the plurality option. A 7-5 split and a 12-0
  // split are entirely different findings, and only this surfaces which is which.
  const plurality = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const dissent = answered
    .filter((r) => r.chosenAlternativeId !== plurality)
    .map((r) => ({
      personaId: r.personaId,
      segmentId: r.segmentId,
      summary: r.blockingObjection || r.response.slice(0, 240),
    }));

  // Position changes between rounds, so movement can be charted rather than
  // inferred from two separate distributions.
  const positionChanges: ScenarioOutcome['positionChanges'] = [];
  const round2 = new Map(
    responses
      .filter((r) => r.round === 2 && r.status === 'ok' && r.chosenAlternativeId)
      .map((r) => [r.personaId, r.chosenAlternativeId!]),
  );
  for (const response of answered) {
    const before = round2.get(response.personaId);
    if (before && before !== response.chosenAlternativeId) {
      positionChanges.push({
        personaId: response.personaId,
        from: before,
        to: response.chosenAlternativeId!,
      });
    }
  }

  const informationGaps = [
    ...new Set(
      decisionRound
        .map((r) => r.missingInformation?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  const limitations = [...scenarioLimitations(brief)];
  if (failed.length > 0) {
    // Stated in the limitations, not buried in a status field, because the
    // reader of the chart is the one who needs to know the panel was partial.
    limitations.push(
      `${failed.length} of ${expectedPanelSize} personas failed to respond; this is a partial panel.`,
    );
  }
  if (withheldReason) limitations.push(`Distribution withheld: ${withheldReason}`);

  const status: ScenarioOutcome['status'] =
    answered.length === 0 ? 'failed' : failed.length > 0 ? 'partial' : 'complete';

  return {
    scenarioId: brief.id,
    scenarioVersion: brief.version,
    label: 'synthetic-scenario',
    panelSize: expectedPanelSize,
    respondedCount: answered.length,
    failedCount: failed.length,
    responses,
    distribution,
    distributionWithheldReason: withheldReason,
    segmentBreakdown,
    objections,
    dissent,
    positionChanges,
    informationGaps,
    limitations,
    status,
  };
}
