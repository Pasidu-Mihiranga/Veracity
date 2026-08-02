/**
 * Bounded context assembly for a research turn.
 *
 * "Memory" must not mean sending an indefinitely growing transcript. That gets
 * expensive, then slow, then wrong — the useful facts get buried among small
 * talk and the model starts answering the wrong question.
 *
 * Context is built from five layers with separate budgets, so an enormous
 * transcript can never crowd out the project's actual state:
 *
 *   1. the current question and any artifacts the user attached to it
 *   2. project state — entities, decision focus, open questions, corrections
 *   3. a rolling structured summary of everything older than the recent window
 *   4. the most recent turns, verbatim
 *   5. retrieved claims and evidence relevant to the question
 *
 * Layer 2 is given a hard floor. It is the cheapest layer and the one whose
 * absence causes the worst failure: an agent that has forgotten which product
 * it is researching will confidently answer about the wrong company.
 *
 * Separately, user-profile memory is kept out of project research memory. A
 * user's stated preferences are not evidence about the market, and letting them
 * mix is how a personal bias becomes a cited finding.
 */

export type ContextLayer =
  | 'question'
  | 'project-state'
  | 'rolling-summary'
  | 'recent-turns'
  | 'retrieved-evidence';

export interface ContextBudget {
  /** Total character budget across all layers. */
  total: number;
  /** Per-layer ceilings. Unspecified layers share what remains. */
  perLayer?: Partial<Record<ContextLayer, number>>;
}

export const DEFAULT_BUDGET: ContextBudget = {
  total: 24_000,
  perLayer: {
    question: 2_000,
    // Small but guaranteed: forgetting the product is the worst failure.
    'project-state': 3_000,
    'rolling-summary': 4_000,
    'recent-turns': 10_000,
    'retrieved-evidence': 5_000,
  },
};

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AttachedArtifact {
  kind: 'claim' | 'chart' | 'source' | 'event' | 'recommendation';
  id: string;
  label: string;
  /** The artifact's own text, so the model does not have to guess what it says. */
  detail: string;
}

export interface ProjectState {
  product: string;
  competitors: string[];
  geography?: string | null;
  decisionContext?: string | null;
  /** Corrections the user made — these override anything inferred. */
  corrections?: string[];
  openQuestions?: string[];
  assumptions?: string[];
}

export interface RollingSummary {
  /** Message id the summary covers up to. */
  throughMessageId: string | null;
  summary: string;
  openQuestions: string[];
  assumptions: string[];
  /** Claim/evidence ids preserved verbatim, so the summary stays traceable. */
  citedIds: string[];
}

export interface RetrievedEvidence {
  claimId: string;
  statement: string;
  sourceUrl?: string;
  confidence?: string;
}

export interface ContextInput {
  question: string;
  attachedArtifacts?: AttachedArtifact[];
  projectState?: ProjectState | null;
  rollingSummary?: RollingSummary | null;
  recentTurns?: ConversationTurn[];
  retrievedEvidence?: RetrievedEvidence[];
  budget?: ContextBudget;
}

export interface BuiltContext {
  text: string;
  /** What each layer actually contributed, for cost analysis and debugging. */
  layerSizes: Record<ContextLayer, number>;
  /** Layers that were trimmed, so a caller can report degraded context. */
  trimmed: ContextLayer[];
  /** Increment when the assembly rules change, so stored turns stay comparable. */
  contextVersion: string;
  totalChars: number;
}

export const CONTEXT_VERSION = 'ctx-v1';

function clip(text: string, limit: number): { text: string; trimmed: boolean } {
  if (text.length <= limit) return { text, trimmed: false };
  // Trim on a line boundary so a fragment of a sentence is not presented as a
  // complete fact.
  const cut = text.slice(0, limit);
  const lastBreak = cut.lastIndexOf('\n');
  return { text: (lastBreak > limit * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd(), trimmed: true };
}

function renderProjectState(state: ProjectState): string {
  const lines = [
    `Product under research: ${state.product}`,
    state.competitors.length > 0 ? `Tracked competitors: ${state.competitors.join(', ')}` : '',
    state.geography ? `Geography: ${state.geography}` : '',
    state.decisionContext ? `Decision in play: ${state.decisionContext}` : '',
  ].filter(Boolean);

  // Corrections come last so they read as the final word. A user who has said
  // "no, that is a different company" must not be contradicted by an earlier
  // inference in the same prompt.
  if (state.corrections?.length) {
    lines.push('User corrections (these override anything inferred):');
    for (const correction of state.corrections) lines.push(`  - ${correction}`);
  }
  if (state.openQuestions?.length) {
    lines.push('Open questions:');
    for (const q of state.openQuestions) lines.push(`  - ${q}`);
  }
  if (state.assumptions?.length) {
    lines.push('Working assumptions (not established facts):');
    for (const a of state.assumptions) lines.push(`  - ${a}`);
  }

  return lines.join('\n');
}

function renderSummary(summary: RollingSummary): string {
  const lines = ['Summary of earlier conversation:', summary.summary];

  if (summary.openQuestions.length > 0) {
    lines.push('Still unresolved:');
    for (const q of summary.openQuestions) lines.push(`  - ${q}`);
  }
  if (summary.assumptions.length > 0) {
    lines.push('Assumptions carried forward:');
    for (const a of summary.assumptions) lines.push(`  - ${a}`);
  }
  if (summary.citedIds.length > 0) {
    // Ids are preserved verbatim so a summarised claim can still be traced back
    // to its evidence instead of becoming an unsourced assertion.
    lines.push(`Evidence referenced: ${summary.citedIds.join(', ')}`);
  }

  return lines.join('\n');
}

function renderTurns(turns: ConversationTurn[]): string {
  return turns
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n\n');
}

function renderArtifacts(artifacts: AttachedArtifact[]): string {
  const lines = ['The user is asking about these specific artifacts:'];
  for (const a of artifacts) {
    lines.push(`  [${a.kind}:${a.id}] ${a.label}`);
    if (a.detail) lines.push(`    ${a.detail}`);
  }
  return lines.join('\n');
}

function renderEvidence(evidence: RetrievedEvidence[]): string {
  const lines = ['Relevant stored evidence:'];
  for (const e of evidence) {
    lines.push(
      `  [${e.claimId}] ${e.statement}` +
        (e.confidence ? ` (confidence: ${e.confidence})` : '') +
        (e.sourceUrl ? ` — ${e.sourceUrl}` : ''),
    );
  }
  return lines.join('\n');
}

/**
 * Assemble the turn context.
 *
 * Layers are filled in priority order, and each is capped both by its own
 * budget and by whatever total remains. Recent turns are trimmed from the
 * *oldest* end, since the newest exchange is the one the question follows on
 * from.
 */
export function buildTurnContext(input: ContextInput): BuiltContext {
  const budget = input.budget ?? DEFAULT_BUDGET;
  const perLayer = budget.perLayer ?? {};
  const trimmed: ContextLayer[] = [];
  const layerSizes: Record<ContextLayer, number> = {
    question: 0,
    'project-state': 0,
    'rolling-summary': 0,
    'recent-turns': 0,
    'retrieved-evidence': 0,
  };

  const sections: string[] = [];
  let remaining = budget.total;

  const SEPARATOR = '\n\n---\n\n';

  const add = (layer: ContextLayer, body: string) => {
    if (!body.trim()) return;

    // The joiner between sections is real output and has to be charged against
    // the budget, or a context with several layers overshoots by the separator
    // cost every time.
    const joinerCost = sections.length > 0 ? SEPARATOR.length : 0;
    const available = remaining - joinerCost;
    if (available <= 0) {
      trimmed.push(layer);
      return;
    }

    const cap = Math.min(perLayer[layer] ?? budget.total, available);
    const result = clip(body, cap);
    if (result.trimmed) trimmed.push(layer);
    sections.push(result.text);
    layerSizes[layer] = result.text.length;
    remaining -= result.text.length + joinerCost;
  };

  // 1. The question and anything the user pointed at. Highest priority: this is
  //    literally what was asked.
  const questionBlock = [
    `Current question: ${input.question}`,
    input.attachedArtifacts?.length ? renderArtifacts(input.attachedArtifacts) : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  add('question', questionBlock);

  // 2. Project state. Cheap, and its absence is the worst failure mode.
  if (input.projectState) add('project-state', renderProjectState(input.projectState));

  // 3. Rolling summary of everything older than the recent window.
  if (input.rollingSummary) add('rolling-summary', renderSummary(input.rollingSummary));

  // 4. Recent turns, newest-biased.
  if (input.recentTurns?.length) {
    const turns = [...input.recentTurns];
    const cap = Math.min(perLayer['recent-turns'] ?? budget.total, remaining);
    // Drop from the oldest end until it fits, rather than truncating mid-turn.
    while (turns.length > 1 && renderTurns(turns).length > cap) turns.shift();
    if (turns.length < input.recentTurns.length) trimmed.push('recent-turns');
    add('recent-turns', renderTurns(turns));
  }

  // 5. Retrieved evidence.
  if (input.retrievedEvidence?.length) {
    add('retrieved-evidence', renderEvidence(input.retrievedEvidence));
  }

  const text = sections.join(SEPARATOR);

  return {
    text,
    layerSizes,
    trimmed: [...new Set(trimmed)],
    contextVersion: CONTEXT_VERSION,
    totalChars: text.length,
  };
}

/**
 * Which turns stay verbatim and which fold into the summary.
 *
 * A window of 8–12 recent turns is the research's recommendation. Everything
 * older is summarised rather than dropped, so the conversation keeps its shape
 * without keeping its full length.
 */
export function partitionTurns(
  turns: ConversationTurn[],
  windowSize = 10,
): { recent: ConversationTurn[]; toSummarize: ConversationTurn[] } {
  if (turns.length <= windowSize) return { recent: turns, toSummarize: [] };
  return {
    recent: turns.slice(-windowSize),
    toSummarize: turns.slice(0, -windowSize),
  };
}

/**
 * Whether a turn needs new collection at all.
 *
 * `explain` and `compare` answer from what is already stored. Running six
 * agents to answer "what did you mean by that?" is the difference between a
 * follow-up costing a fraction of a cent and costing as much as the original
 * sweep — and the expensive version is not more correct, just slower.
 */
export function requiresCollection(mode: string): boolean {
  return mode !== 'explain' && mode !== 'compare';
}

/**
 * Whether stored evidence is sufficient to answer without collecting.
 *
 * Returns a reason when it is not, so the UI can say "this needs fresh data
 * because the newest evidence is 40 days old" rather than silently escalating
 * to an expensive sweep the user did not ask for.
 */
export function canAnswerFromStored(params: {
  mode: string;
  retrievedEvidence: RetrievedEvidence[];
  freshestEvidenceAt?: string | null;
  maxAgeDays?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (requiresCollection(params.mode)) {
    return { ok: false, reason: `the ${params.mode} mode collects fresh data by design` };
  }

  if (params.retrievedEvidence.length === 0) {
    return { ok: false, reason: 'no stored evidence matches this question' };
  }

  if (params.freshestEvidenceAt) {
    const maxAge = params.maxAgeDays ?? 30;
    const ageDays = (Date.now() - new Date(params.freshestEvidenceAt).getTime()) / 86_400_000;
    if (ageDays > maxAge) {
      return {
        ok: false,
        reason: `the newest stored evidence is ${Math.round(ageDays)} days old`,
      };
    }
  }

  return { ok: true };
}
