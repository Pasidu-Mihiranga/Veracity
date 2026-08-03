import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { DOMAINS } from '@/lib/market/dataset';

export const runtime = 'nodejs';

/**
 * The markets this workspace can brief on, and who is in them.
 *
 * Read-only and model-free: this is the index the entry cards and the company
 * picker render from, so opening the app must not cost anything.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  return apiSuccess({
    domains: DOMAINS.map((domain) => ({
      id: domain.id,
      label: domain.label,
      home: domain.home,
      geography: domain.geography,
      companies: domain.companies.map((company) => ({
        label: company.label,
        what: company.what,
      })),
    })),
  });
}
