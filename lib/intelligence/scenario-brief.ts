/**
 * ScenarioBrief — the reviewable input contract for the Swarm Decision Lab.
 *
 * The rule this module exists to enforce: an arbitrary user prompt must never
 * go straight to a persona pool. A synthetic panel will answer whatever it is
 * asked, confidently, and if the question smuggled in an assumption then the
 * answer inherits it invisibly. So the brief is built from *verified project
 * state*, shown to the user, and versioned before anything expensive runs.
 *
 * Two separations are load-bearing:
 *
 *   - **Observed facts vs assumptions.** Facts carry claim and evidence ids and
 *     are traceable. Assumptions are explicitly unproven and the panel is told
 *     so. Blurring them is how a scenario's premise quietly becomes a finding.
 *   - **Synthetic output vs evidence.** Nothing produced by a panel may enter
 *     the evidence ledger. Consensus among personas raises no confidence about
 *     the real world, however many of them agree.
 *
 * Branching a scenario creates a new version rather than mutating the old one,
 * so "what if their price drops 20%?" is comparable against the base case
 * instead of destroying it.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';

// ── Schema ──────────────────────────────────────────────────────────────────

export const ScenarioAlternative = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1, 'an alternative the panel cannot understand is not a choice'),
});
export type ScenarioAlternative = z.infer<typeof ScenarioAlternative>;

export const ScenarioSegment = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  /** How many synthetic personas represent this segment. */
  panelSize: z.number().int().positive(),
});
export type ScenarioSegment = z.infer<typeof ScenarioSegment>;

export const ScenarioFact = z.object({
  claimId: z.string().min(1),
  statement: z.string().min(1),
  /** Required — a "fact" with no evidence is an assumption wearing a disguise. */
  evidenceSpanIds: z.array(z.string()).min(1),
});
export type ScenarioFact = z.infer<typeof ScenarioFact>;

export const ScenarioBrief = z.object({
  id: z.string().min(1),
  /** Incremented on every branch. Responses always record which version produced them. */
  version: z.number().int().positive(),
  /** Set when this brief was branched from another, with what changed. */
  parentVersion: z.number().int().positive().nullable().default(null),
  branchReason: z.string().nullable().default(null),

  projectId: z.string().nullable().optional(),
  decisionQuestion: z.string().min(1),

  alternatives: z.array(ScenarioAlternative)
    .min(2, 'a decision with one option is not a decision'),
  targetSegments: z.array(ScenarioSegment).min(1),

  /** Verified, traceable facts the panel is given. */
  observedFacts: z.array(ScenarioFact).default([]),
  /** Explicitly unproven premises. The panel is told these are assumptions. */
  assumptions: z.array(z.string()).default([]),
  /** What nobody knows, stated so the panel does not paper over it. */
  uncertainties: z.array(z.string()).default([]),
  /** Deliberately out of scope. */
  exclusions: z.array(z.string()).default([]),

  timeHorizon: z.string().nullable().default(null),
  createdAt: z.string(),
}).refine(
  (b) => new Set(b.alternatives.map((a) => a.id)).size === b.alternatives.length,
  { message: 'alternative ids must be unique' },
).refine(
  (b) => new Set(b.targetSegments.map((s) => s.id)).size === b.targetSegments.length,
  { message: 'segment ids must be unique' },
);
export type ScenarioBrief = z.infer<typeof ScenarioBrief>;

// ── Validation ──────────────────────────────────────────────────────────────

export type BriefValidation =
  | { ok: true; brief: ScenarioBrief; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Validate a brief before an expensive run.
 *
 * Warnings do not block. A brief resting entirely on assumptions is a legitimate
 * thing to explore — it just has to be *labelled* as such, so the output is not
 * mistaken for something grounded.
 */
export function validateScenarioBrief(input: unknown): BriefValidation {
  const parsed = ScenarioBrief.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) =>
        i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message,
      ),
    };
  }

  const brief = parsed.data;
  const warnings: string[] = [];

  if (brief.observedFacts.length === 0) {
    warnings.push(
      'This scenario rests entirely on assumptions — no observed facts are attached. ' +
        'Treat the result as a thought experiment, not as grounded analysis.',
    );
  }

  if (brief.assumptions.length === 0 && brief.observedFacts.length > 0) {
    // Every scenario about the future rests on something unproven. Claiming
    // otherwise usually means an assumption is hiding inside the question.
    warnings.push(
      'No assumptions are stated. Check whether an unproven premise is embedded ' +
        'in the decision question itself.',
    );
  }

  if (brief.uncertainties.length === 0) {
    warnings.push('No uncertainties are stated, which is rarely true of a real decision.');
  }

  const totalPanel = brief.targetSegments.reduce((sum, s) => sum + s.panelSize, 0);
  if (totalPanel < brief.targetSegments.length * 2) {
    warnings.push(
      `A panel of ${totalPanel} across ${brief.targetSegments.length} segment(s) is small; ` +
        'segment-level differences will not be meaningful.',
    );
  }

  return { ok: true, brief, warnings };
}

// ── Versioning and branching ────────────────────────────────────────────────

/**
 * Branch a brief by changing assumptions.
 *
 * Returns a new version rather than mutating, so the base case survives for
 * comparison. Overwriting it would destroy the only thing that makes the branch
 * interesting.
 */
export function branchScenario(
  base: ScenarioBrief,
  changes: {
    assumptions?: string[];
    alternatives?: ScenarioAlternative[];
    targetSegments?: ScenarioSegment[];
    reason: string;
  },
): ScenarioBrief {
  return {
    ...base,
    version: base.version + 1,
    parentVersion: base.version,
    branchReason: changes.reason,
    assumptions: changes.assumptions ?? base.assumptions,
    alternatives: changes.alternatives ?? base.alternatives,
    targetSegments: changes.targetSegments ?? base.targetSegments,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Cache key for a scenario run.
 *
 * Includes the evidence hash and model version, not just the brief. Two runs of
 * "the same" scenario against different evidence are different runs, and letting
 * them collide would serve a stale panel result as though it reflected current
 * facts.
 */
export function scenarioCacheKey(params: {
  brief: ScenarioBrief;
  modelVersion: string;
  panelVersion: string;
}): string {
  const evidenceHash = createHash('sha256')
    .update(
      params.brief.observedFacts
        .flatMap((f) => f.evidenceSpanIds)
        .sort()
        .join('|'),
    )
    .digest('hex')
    .slice(0, 16);

  return [
    params.brief.id,
    `v${params.brief.version}`,
    params.panelVersion,
    params.modelVersion,
    evidenceHash,
  ].join(':');
}

// ── Rounds ──────────────────────────────────────────────────────────────────

export type ScenarioRound = 1 | 2 | 3;

export const ROUND_PURPOSE: Record<ScenarioRound, string> = {
  1: 'Independent reaction — each persona responds without seeing any other response.',
  2: 'Challenge — personas receive verified evidence and counterarguments, and may revise.',
  3: 'Decision — each persona selects an alternative, gives reasons, names a blocking objection, and states what information is missing.',
};

/**
 * Prompt for one persona in one round.
 *
 * Round 1 deliberately withholds other personas' responses. Showing them
 * produces artificial consensus: personas converge on whatever they read first,
 * and the resulting agreement measures the prompt rather than the segments.
 */
export function buildRoundPrompt(params: {
  brief: ScenarioBrief;
  round: ScenarioRound;
  segment: ScenarioSegment;
  /** Prior rounds for this persona only. Empty in round 1. */
  priorResponses?: Array<{ round: number; response: string }>;
  /** Counterarguments introduced in round 2. */
  challenge?: string;
}): string {
  const { brief, round, segment, priorResponses = [], challenge } = params;

  const lines: string[] = [
    `You are responding as a member of this segment: ${segment.label}.`,
    segment.description,
    '',
    `Decision under consideration: ${brief.decisionQuestion}`,
    brief.timeHorizon ? `Time horizon: ${brief.timeHorizon}` : '',
    '',
    'Alternatives:',
    ...brief.alternatives.map((a) => `  ${a.id}. ${a.label} — ${a.description}`),
    '',
  ].filter(Boolean);

  if (brief.observedFacts.length > 0) {
    lines.push('Verified facts (these are established from sources):');
    for (const fact of brief.observedFacts) lines.push(`  - ${fact.statement}`);
    lines.push('');
  }

  if (brief.assumptions.length > 0) {
    // Stated as assumptions so the persona does not treat a premise as
    // established and then have its answer read as evidence for it.
    lines.push('Assumptions (NOT established — treat as premises of this scenario):');
    for (const assumption of brief.assumptions) lines.push(`  - ${assumption}`);
    lines.push('');
  }

  if (brief.uncertainties.length > 0) {
    lines.push('Known unknowns:');
    for (const u of brief.uncertainties) lines.push(`  - ${u}`);
    lines.push('');
  }

  if (brief.exclusions.length > 0) {
    lines.push(`Out of scope: ${brief.exclusions.join('; ')}`);
    lines.push('');
  }

  lines.push(ROUND_PURPOSE[round]);

  if (round === 1) {
    lines.push(
      'Respond only from your own perspective. You have not seen anyone else’s view.',
    );
  }

  if (priorResponses.length > 0) {
    lines.push('', 'Your own earlier responses in this scenario:');
    for (const prior of priorResponses) {
      lines.push(`  Round ${prior.round}: ${prior.response}`);
    }
  }

  if (round === 2 && challenge) {
    lines.push('', 'Consider this challenge, then state whether your position changes and why:');
    lines.push(challenge);
  }

  if (round === 3) {
    lines.push(
      '',
      'Answer with: the alternative id you choose, your main reason, the single ' +
        'objection that would block you, and what information you would need.',
    );
  }

  return lines.join('\n');
}

/**
 * Limitations attached to every scenario output.
 *
 * Non-negotiable and not caller-supplied. The whole risk of this feature is a
 * user reading synthetic output as market research, and the disclosure is the
 * only thing standing between those two readings.
 */
export function scenarioLimitations(brief: ScenarioBrief): string[] {
  const panelSize = brief.targetSegments.reduce((sum, s) => sum + s.panelSize, 0);

  const limitations = [
    'Synthetic scenario — model-generated personas, not survey data and not real customers.',
    'Persona agreement carries no statistical weight and does not raise confidence in any factual claim.',
    `Panel of ${panelSize} synthetic persona(s) across ${brief.targetSegments.length} segment(s).`,
    'Results are not calibrated against real outcomes and must not be read as a prediction.',
  ];

  if (brief.assumptions.length > 0) {
    limitations.push(
      `Rests on ${brief.assumptions.length} stated assumption(s); changing one may change the result.`,
    );
  }

  if (brief.observedFacts.length === 0) {
    limitations.push('No observed facts were attached — this is a thought experiment.');
  }

  return limitations;
}
