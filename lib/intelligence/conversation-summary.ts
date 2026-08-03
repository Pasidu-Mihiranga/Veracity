/**
 * Generating and storing the rolling conversation summary.
 *
 * `partitionTurns` already decided which turns stay verbatim and which should
 * fold into a summary, and `buildTurnContext` already accepted one. Nothing
 * produced it — so the older half of a long conversation was simply dropped. A
 * project with sixty turns behaved as though it had ten, and the decisions
 * taken in turn twelve were invisible by turn forty.
 *
 * Two constraints shape everything here:
 *
 *  1. **A summary must not become an unsourced assertion.** Claim and evidence
 *     ids survive verbatim. A summarised finding that loses its ids reads as
 *     established fact with nothing behind it, which is the failure the ledger
 *     exists to prevent.
 *  2. **A failed summary is no summary.** If the model is unavailable or
 *     returns something unusable, the previous summary stands and the recent
 *     window carries the turn. Writing a degraded summary would silently
 *     corrupt every later turn that reads it.
 */

import { z } from 'zod';
import { query } from '@/lib/db';
import { generateHuggingFaceJson } from '@/lib/agents/gemini';
import { partitionTurns, CONTEXT_VERSION, type ConversationTurn, type RollingSummary } from './conversation-context';
import { logger } from '@/lib/logger';

/**
 * How many turns must accumulate beyond the last summary before regenerating.
 *
 * Summarising on every message would mean a model call per message for a
 * paragraph that barely changes. Waiting too long means a stretch of the
 * conversation is briefly invisible. Six is roughly three exchanges.
 */
const REGENERATE_AFTER_TURNS = 6;

/** Turns kept verbatim. Everything older folds into the summary. */
const RECENT_WINDOW = 10;

const SummaryResponse = z.object({
  summary: z.string(),
  openQuestions: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  citedIds: z.array(z.string()).default([]),
});

const SYSTEM_PROMPT = `You are maintaining a running summary of a market research conversation.

Rules:
- Summarise what was established, decided, and left unresolved. Not who said what.
- Preserve any bracketed ids exactly as they appear, e.g. [claim-7]. They link statements to stored evidence, and dropping one turns a sourced finding into an unsourced assertion.
- Separate what the research established from what the user decided or assumed.
- List questions that were raised and not answered.
- List assumptions the conversation is operating under.
- Do not add facts, numbers, dates, or company names that are not in the transcript.
- Be brief. This is background context for later turns, not a report.`;

/**
 * Whether the summary needs regenerating.
 *
 * Exported so a caller can check cheaply before loading a transcript it may not
 * need.
 */
export function needsRegeneration(params: {
  totalTurns: number;
  existing: { turnsCovered: number; contextVersion: string } | null;
}): boolean {
  const summarisable = Math.max(0, params.totalTurns - RECENT_WINDOW);

  // Nothing has aged out of the verbatim window yet.
  if (summarisable === 0) return false;

  if (!params.existing) return true;

  // Built under different assembly rules — regenerate rather than mixing text
  // produced by two different contracts.
  if (params.existing.contextVersion !== CONTEXT_VERSION) return true;

  return summarisable - params.existing.turnsCovered >= REGENERATE_AFTER_TURNS;
}

/** Load the stored summary for a session, if any. */
export async function loadSummary(params: {
  userId: string;
  sessionId: string;
}): Promise<(RollingSummary & { turnsCovered: number; contextVersion: string }) | null> {
  const { rows } = await query<{
    through_message_id: string | null;
    turns_covered: number;
    summary: string;
    open_questions: string[];
    assumptions: string[];
    cited_ids: string[];
    context_version: string;
  }>(
    `SELECT through_message_id, turns_covered, summary, open_questions,
            assumptions, cited_ids, context_version
       FROM conversation_summaries
      WHERE session_id = $1 AND user_id = $2`,
    [params.sessionId, params.userId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    throughMessageId: row.through_message_id,
    summary: row.summary,
    openQuestions: row.open_questions ?? [],
    assumptions: row.assumptions ?? [],
    citedIds: row.cited_ids ?? [],
    turnsCovered: row.turns_covered,
    contextVersion: row.context_version,
  };
}

/**
 * Regenerate the summary from the turns that have aged out of the window.
 *
 * Returns null when there is nothing to summarise or the model failed. Callers
 * treat null as "keep whatever was already stored" — never as "clear it".
 */
export async function generateSummary(params: {
  turns: ConversationTurn[];
  previous?: RollingSummary | null;
}): Promise<RollingSummary | null> {
  const { toSummarize } = partitionTurns(params.turns, RECENT_WINDOW);
  if (toSummarize.length === 0) return null;

  const transcript = toSummarize
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n\n')
    .slice(0, 20_000);

  // The previous summary is included so the model extends rather than restarts.
  // Without it, each regeneration re-reads the whole transcript and quietly
  // drops whatever it happened not to mention this time.
  const priorBlock = params.previous
    ? `Previous summary (extend this, do not restart):\n${params.previous.summary}\n\n` +
      `Previously unresolved: ${params.previous.openQuestions.join('; ') || 'none'}\n` +
      `Previously assumed: ${params.previous.assumptions.join('; ') || 'none'}\n\n`
    : '';

  try {
    const raw = await generateHuggingFaceJson<unknown>(
      SYSTEM_PROMPT,
      `${priorBlock}Transcript to summarise:\n\n${transcript}`,
      { temperature: 0.1, maxNewTokens: 900 },
    );

    const parsed = SummaryResponse.safeParse(raw);
    if (!parsed.success || !parsed.data.summary.trim()) {
      logger.warn('summary.unusable_response', {
        reason: parsed.success ? 'empty summary' : parsed.error.issues[0]?.message,
      });
      return null;
    }

    // Only ids that actually appear in the summarised text. A model listing an
    // id it did not use produces a citation trail to nowhere.
    const present = new Set(
      [...parsed.data.summary.matchAll(/\[([a-zA-Z0-9-]+)\]/g)].map((m) => m[1]),
    );
    const citedIds = parsed.data.citedIds.filter((id) => present.has(id));

    return {
      throughMessageId: null,
      summary: parsed.data.summary.trim(),
      openQuestions: parsed.data.openQuestions.filter((q) => q.trim()),
      assumptions: parsed.data.assumptions.filter((a) => a.trim()),
      citedIds,
    };
  } catch (err) {
    // A model failure means no new summary. The old one stands and the recent
    // window still carries the turn — degraded, but never wrong.
    logger.warn('summary.generation_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Store or replace the summary for a session. */
export async function saveSummary(params: {
  userId: string;
  sessionId: string;
  summary: RollingSummary;
  turnsCovered: number;
  throughMessageId?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO conversation_summaries
       (session_id, user_id, through_message_id, turns_covered, summary,
        open_questions, assumptions, cited_ids, context_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (session_id) DO UPDATE SET
       through_message_id = EXCLUDED.through_message_id,
       turns_covered = EXCLUDED.turns_covered,
       summary = EXCLUDED.summary,
       open_questions = EXCLUDED.open_questions,
       assumptions = EXCLUDED.assumptions,
       cited_ids = EXCLUDED.cited_ids,
       context_version = EXCLUDED.context_version,
       updated_at = now()`,
    [
      params.sessionId, params.userId, params.throughMessageId ?? null,
      params.turnsCovered, params.summary.summary,
      params.summary.openQuestions, params.summary.assumptions,
      params.summary.citedIds, CONTEXT_VERSION,
    ],
  );
}

/**
 * Refresh the summary if enough has aged out, and return the current one.
 *
 * The single entry point callers need. Cheap when nothing has changed: one
 * indexed read and no model call.
 */
export async function refreshSummary(params: {
  userId: string;
  sessionId: string;
  turns: ConversationTurn[];
  throughMessageId?: string | null;
}): Promise<RollingSummary | null> {
  const existing = await loadSummary({ userId: params.userId, sessionId: params.sessionId });

  if (!needsRegeneration({ totalTurns: params.turns.length, existing })) {
    return existing;
  }

  const generated = await generateSummary({ turns: params.turns, previous: existing });

  // Generation failed — the existing summary is still better than none.
  if (!generated) return existing;

  const turnsCovered = Math.max(0, params.turns.length - RECENT_WINDOW);

  await saveSummary({
    userId: params.userId,
    sessionId: params.sessionId,
    summary: generated,
    turnsCovered,
    throughMessageId: params.throughMessageId,
  });

  logger.info('summary.refreshed', {
    sessionId: params.sessionId,
    turnsCovered,
    citedIds: generated.citedIds.length,
  });

  return generated;
}
