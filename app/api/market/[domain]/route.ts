import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { buildBriefing } from '@/lib/market/briefing';
import { findDomain } from '@/lib/market/dataset';

export const runtime = 'nodejs';
type Context = { params: Promise<{ domain: string }> };

/** Everything the briefing view renders for one market. */
export async function GET(_req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const { domain: id } = await context.params;
  const domain = findDomain(id);
  if (!domain) return apiError('No such market', 404, 'NOT_FOUND');

  return apiSuccess(buildBriefing(domain));
}
