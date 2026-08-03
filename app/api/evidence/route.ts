import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { loadSpans } from '@/lib/intelligence/ledger-repo';

export const runtime = 'nodejs';

/** Cap on ids per request — the drawer shows a handful, not a corpus. */
const MAX_SPANS = 50;

/**
 * Backs the evidence drawer: given span ids, return the exact excerpts with
 * their source, retrieval time, and snapshot hash.
 *
 * The hash travels with the excerpt so a reviewer can confirm the quote came
 * from the snapshot we stored rather than from a page that has since changed.
 * Without it "here is the source" is a weaker claim than it appears.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_SPANS);

  if (ids.length === 0) return apiError('No evidence ids supplied', 400, 'BAD_REQUEST');

  // loadSpans is scoped by user_id, so an id belonging to someone else simply
  // does not come back rather than 403-ing and confirming it exists.
  const spans = await loadSpans(user.id, ids);

  return apiSuccess({
    spans,
    // Reported so the drawer can say "2 of 3 excerpts are no longer available"
    // instead of quietly showing fewer than the claim cited.
    requested: ids.length,
    found: spans.length,
  });
}
