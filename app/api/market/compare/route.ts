import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { buildComparison, companyIndex } from '@/lib/market/briefing';

export const runtime = 'nodejs';

/** The picker's list — who can be compared. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');
  return apiSuccess({ companies: companyIndex() });
}

/**
 * Compare named companies.
 *
 * Names arrive as the user typed them, so matching is case- and
 * spacing-insensitive and anything unrecognised comes back in `unknown` rather
 * than being silently dropped — "we do not follow that one yet, want to add it?"
 * is a useful answer and an empty comparison is not.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Body must be JSON', 400, 'BAD_REQUEST');
  }

  const names = (body as { companies?: unknown })?.companies;
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
    return apiError('Send { companies: string[] }', 400, 'BAD_REQUEST');
  }
  if (names.length === 0) {
    return apiError('Name at least one company', 400, 'BAD_REQUEST');
  }

  return apiSuccess(buildComparison(names as string[]));
}
