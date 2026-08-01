export type StealStrategyGrounding = {
  status: 'ungrounded-educational';
  label: string;
  enterpriseEligible: false;
  sources: [];
  limitations: string[];
};

export type StealStrategyModelResult = {
  summary: string;
  historicalCompetitiveMoves: {
    move: string;
    context: string;
    effectOnRivals: string;
  }[];
  modernEntrantPlaybook: {
    analogy: string;
    applicationToday: string;
    exampleTactics: string[];
  }[];
  guardrails: string;
};

export type StealStrategyResponse = StealStrategyModelResult & {
  grounding: StealStrategyGrounding;
};

/**
 * Steal Strategy currently has no retrieval step. Fail closed: every response
 * is educational, explicitly ungrounded, and ineligible for enterprise packs.
 */
export function markStealStrategyUngrounded(
  result: StealStrategyModelResult,
): StealStrategyResponse {
  return {
    ...result,
    grounding: {
      status: 'ungrounded-educational',
      label: 'Educational analogy — not source-grounded',
      enterpriseEligible: false,
      sources: [],
      limitations: [
        'No live retrieval tools or primary sources were used for this output.',
        'Historical claims and analogies must be independently verified before use.',
        'This output is excluded from board packs and enterprise decision evidence.',
      ],
    },
  };
}

