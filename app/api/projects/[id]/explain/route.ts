import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { answerFromStored } from '@/lib/intelligence/stored-answer';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

/**
 * Answer a question from stored evidence, without collecting.
 *
 * The cheap path behind the Explain and Compare turn modes. Those modes
 * previously only appended an instruction to the prompt while still running the
 * full sweep, so "what did you mean by that?" cost the same as the original
 * research. One model call over the ledger costs roughly two orders of
 * magnitude less and returns in seconds.
 *
 * When stored evidence cannot answer, this returns 409 with a reason rather
 * than silently escalating. A user who asked a cheap question should not be
 * billed for a sweep without being told, and "the newest stored evidence is 40
 * days old" is something they can act on.
 */
export async function POST(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { id } = await context.params;
  const owned = await query(
    `SELECT id FROM market_projects WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!owned.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');

  let body: {
    question?: string;
    mode?: string;
    sessionId?: string;
    recentTurns?: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>;
    attachedArtifacts?: Array<{
      kind: 'claim' | 'chart' | 'source' | 'event' | 'recommendation';
      id: string;
      label: string;
      detail: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400, 'BAD_REQUEST');
  }

  const question = body.question?.trim();
  if (!question) return apiError('A question is required', 400, 'BAD_REQUEST');

  const result = await answerFromStored({
    userId: user.id,
    projectId: id,
    question,
    mode: body.mode ?? 'explain',
    // Enables the rolling summary, so a long conversation keeps its earlier
    // decisions in view rather than only its last ten turns.
    sessionId: body.sessionId ?? null,
    recentTurns: body.recentTurns,
    attachedArtifacts: body.attachedArtifacts,
  });

  if (!result.ok) {
    return apiError(result.reason, 409, 'NEEDS_COLLECTION');
  }

  return apiSuccess(result);
}
