/**
 * Answering from stored evidence, without collecting anything.
 *
 * "Explain what you found" and "compare these two options" are questions about
 * research that already happened. Running six agents to answer them costs as
 * much as the original sweep, takes as long, and is not more correct — the
 * answer is already in the ledger.
 *
 * This path loads the relevant claims and evidence, builds a bounded context,
 * and makes exactly one model call. The difference is roughly two orders of
 * magnitude in cost and about thirty seconds in latency.
 *
 * The honesty constraint: this answers *only* from what is stored. If the
 * evidence does not cover the question, it says so and names what a fresh run
 * would need to collect, rather than filling the gap from the model's own
 * knowledge.
 */

import { query } from '@/lib/db';
import { generateHuggingFaceText } from '@/lib/agents/gemini';
import {
  buildTurnContext,
  canAnswerFromStored,
  requiresCollection,
  type ProjectState,
  type RetrievedEvidence,
  type ConversationTurn,
  type AttachedArtifact,
} from './conversation-context';

export interface StoredAnswerRequest {
  userId: string;
  projectId: string;
  question: string;
  mode: string;
  recentTurns?: ConversationTurn[];
  attachedArtifacts?: AttachedArtifact[];
  /** Evidence older than this makes the answer stale. */
  maxEvidenceAgeDays?: number;
}

export type StoredAnswerResult =
  | {
      ok: true;
      answer: string;
      citedClaimIds: string[];
      evidenceCount: number;
      contextVersion: string;
      /** Layers that had to be trimmed, so a caller can report degraded context. */
      trimmed: string[];
    }
  | { ok: false; reason: string; needsCollection: true };

const SYSTEM_PROMPT = `You answer questions about market research that has already been carried out.

Rules:
- Answer ONLY from the stored evidence provided. It is the entirety of what is known.
- Cite claims by their bracketed id, e.g. [claim-7], wherever you rely on them.
- If the stored evidence does not answer the question, say so plainly and state what would need to be collected. Do not fill the gap from your own knowledge.
- Distinguish what the evidence establishes from what you are inferring. Label inference as inference.
- Do not introduce numbers, dates, company names, or events that are not in the evidence.`;

/**
 * Load the claims most relevant to a question.
 *
 * Ranking is deliberately simple: recency plus keyword overlap. A vector search
 * would be better, but the failure mode of a weak match here is a longer
 * context, not a wrong answer — the model is instructed to say when the
 * evidence does not cover the question.
 */
async function loadRelevantClaims(params: {
  userId: string;
  projectId: string;
  question: string;
  limit?: number;
}): Promise<RetrievedEvidence[]> {
  const terms = params.question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3)
    .slice(0, 8);

  const { rows } = await query<{
    id: string;
    statement: string;
    confidence: string;
    source_url: string | null;
  }>(
    `SELECT c.id, c.statement, c.confidence,
            (SELECT snap.source_url
               FROM evidence_spans s
               JOIN source_snapshots snap ON snap.id = s.snapshot_id
              WHERE s.id = ANY(c.supporting_span_ids)
              LIMIT 1) AS source_url
       FROM claims c
      WHERE c.user_id = $1 AND c.project_id = $2
      ORDER BY
        -- Claims whose text overlaps the question first, then most recent.
        (SELECT count(*) FROM unnest($3::text[]) term
          WHERE lower(c.statement) LIKE '%' || term || '%') DESC,
        c.created_at DESC
      LIMIT $4`,
    [params.userId, params.projectId, terms, params.limit ?? 24],
  );

  return rows.map((row) => ({
    claimId: row.id,
    statement: row.statement,
    confidence: row.confidence,
    sourceUrl: row.source_url ?? undefined,
  }));
}

async function loadProjectState(
  userId: string,
  projectId: string,
): Promise<ProjectState | null> {
  const { rows } = await query<{
    product: string;
    competitors: string[];
    geography: string | null;
    decision_context: string | null;
  }>(
    `SELECT product, competitors, geography, decision_context
       FROM market_projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  if (!rows[0]) return null;

  return {
    product: rows[0].product,
    competitors: rows[0].competitors ?? [],
    geography: rows[0].geography,
    decisionContext: rows[0].decision_context,
  };
}

/**
 * Answer from the ledger, or explain why that is not possible.
 *
 * Returning a reason rather than silently escalating matters: a user who asked
 * a cheap question should not be billed for a full sweep without being told,
 * and the reason ("the newest stored evidence is 40 days old") is something
 * they can act on.
 */
export async function answerFromStored(
  request: StoredAnswerRequest,
): Promise<StoredAnswerResult> {
  if (requiresCollection(request.mode)) {
    return {
      ok: false,
      reason: `the ${request.mode} mode collects fresh data by design`,
      needsCollection: true,
    };
  }

  const [projectState, evidence] = await Promise.all([
    loadProjectState(request.userId, request.projectId),
    loadRelevantClaims({
      userId: request.userId,
      projectId: request.projectId,
      question: request.question,
    }),
  ]);

  const freshest = await query<{ newest: string | null }>(
    `SELECT max(created_at)::text AS newest
       FROM claims WHERE user_id = $1 AND project_id = $2`,
    [request.userId, request.projectId],
  );

  const viable = canAnswerFromStored({
    mode: request.mode,
    retrievedEvidence: evidence,
    freshestEvidenceAt: freshest.rows[0]?.newest ?? null,
    maxAgeDays: request.maxEvidenceAgeDays,
  });

  if (!viable.ok) return { ok: false, reason: viable.reason, needsCollection: true };

  const context = buildTurnContext({
    question: request.question,
    attachedArtifacts: request.attachedArtifacts,
    projectState,
    recentTurns: request.recentTurns,
    retrievedEvidence: evidence,
  });

  let answer: string;
  try {
    answer = await generateHuggingFaceText(`${SYSTEM_PROMPT}\n\n${context.text}`, {
      temperature: 0.2,
      maxNewTokens: 1200,
    });
  } catch (err) {
    // A model failure is not a reason to fall back to a sweep the user did not
    // ask for, nor to invent an answer. It is reported as what it is.
    return {
      ok: false,
      reason: `the model was unavailable: ${err instanceof Error ? err.message : String(err)}`,
      needsCollection: false as true,
    };
  }

  if (!answer.trim()) {
    return { ok: false, reason: 'the model returned an empty answer', needsCollection: false as true };
  }

  // Only ids the model actually cited, and only ones that exist. A hallucinated
  // citation is worse than none, because it looks verifiable.
  const known = new Set(evidence.map((e) => e.claimId));
  const cited = [...new Set(answer.match(/\[([a-zA-Z0-9-]+)\]/g) ?? [])]
    .map((m) => m.slice(1, -1))
    .filter((id) => known.has(id));

  return {
    ok: true,
    answer,
    citedClaimIds: cited,
    evidenceCount: evidence.length,
    contextVersion: context.contextVersion,
    trimmed: context.trimmed,
  };
}
