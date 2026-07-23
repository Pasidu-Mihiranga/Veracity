import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { formatDecisionsForMemory, listDecisions } from '@/lib/decisions';

/** Cross-session feedback + decisions for orchestrator preamble. */
export async function buildLearningContext(userId: string): Promise<string> {
  const parts: string[] = [];

  if (featureFlags.decisionMemory) {
    try {
      const decisions = await listDecisions(userId, 8);
      const block = formatDecisionsForMemory(decisions, 8);
      if (block) parts.push(block);
    } catch {
      // ignore
    }
  }

  if (featureFlags.feedbackLearning) {
    try {
      const { rows: fb } = await query<{ title: string; rating: string }>(
        `SELECT title, rating FROM recommendation_feedback
         WHERE user_id = $1 AND rating IN ('up','down')
         ORDER BY created_at DESC LIMIT 8`,
        [userId],
      );
      const { rows: actions } = await query<{ title: string; action: string }>(
        `SELECT title, action FROM recommendation_actions
         WHERE user_id = $1 AND action IN ('accepted','rejected')
         ORDER BY created_at DESC LIMIT 8`,
        [userId],
      );
      const lines = [
        ...fb.map((r) => `- Feedback ${r.rating}: ${r.title}`),
        ...actions.map((r) => `- Action ${r.action}: ${r.title}`),
      ].slice(0, 12);
      if (lines.length) {
        parts.push(`Cross-session recommendation learning:\n${lines.join('\n')}`);
      }
    } catch {
      // ignore
    }
  }

  return parts.join('\n\n');
}

export async function getFeedbackStats(userId: string): Promise<{
  up: number;
  down: number;
  refineRate: number | null;
}> {
  try {
    const { rows } = await query<{ rating: string; n: string }>(
      `SELECT rating, count(*)::text AS n FROM recommendation_feedback
       WHERE user_id = $1 GROUP BY rating`,
      [userId],
    );
    let up = 0;
    let down = 0;
    for (const r of rows) {
      if (r.rating === 'up') up = Number(r.n);
      if (r.rating === 'down') down = Number(r.n);
    }
    const { rows: actions } = await query<{ action: string; n: string }>(
      `SELECT action, count(*)::text AS n FROM recommendation_actions
       WHERE user_id = $1 GROUP BY action`,
      [userId],
    );
    let refined = 0;
    let total = 0;
    for (const a of actions) {
      const n = Number(a.n);
      total += n;
      if (a.action === 'refined') refined += n;
    }
    return {
      up,
      down,
      refineRate: total ? Math.round((refined / total) * 100) : null,
    };
  } catch {
    return { up: 0, down: 0, refineRate: null };
  }
}
