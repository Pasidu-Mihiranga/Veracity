import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import {
  addWatchlistItem,
  createWatchlist,
  listWatchlistItems,
  listWatchlists,
} from '@/lib/watchlists';
import { query } from '@/lib/db';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';
import { apiError, apiSuccess, parseAndValidateJson } from '@/lib/api-response';

const watchlistPostSchema = z.object({
  name: z.string().optional(),
  product: z.string().optional(),
  seedFromMemory: z.boolean().optional(),
  competitors: z.array(z.string()).optional(),
  cadence: z.enum(['daily', 'twice_weekly', 'weekly', 'monthly']).optional(),
  maxCompetitors: z.number().int().min(1).max(12).optional(),
  weeklyAlertBudget: z.number().int().min(1).max(50).optional(),
  alertChannels: z.array(z.enum(['in_app', 'email', 'slack'])).max(3).optional(),
});

export async function GET() {
  if (!featureFlags.watchlists) {
    return apiSuccess({ watchlists: [] });
  }
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const tenant = await resolveTenantFromCookies(user.id, user.email);
  const lists = await listWatchlists(user.id, tenant.workspaceId);
  const withItems = await Promise.all(
    lists.map(async (w) => ({
      ...w,
      items: await listWatchlistItems(w.id),
    })),
  );
  return apiSuccess({ watchlists: withItems });
}

export async function POST(req: Request) {
  if (!featureFlags.watchlists) {
    return apiError('Watchlists disabled', 403, 'FEATURE_DISABLED');
  }
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const tenant = await resolveTenantFromCookies(user.id, user.email);
  if (featureFlags.workspaces && tenant.workspaceId) {
    try {
      await requireWorkspaceAccess(user.id, tenant.workspaceId, 'watchlist.manage');
    } catch (err) {
      if (err instanceof PermissionError) {
        return apiError(err.message, err.status, 'FORBIDDEN');
      }
      throw err;
    }
  }

  const parsed = await parseAndValidateJson(req, watchlistPostSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  let product = body.product?.trim() || '';
  let competitors = body.competitors ?? [];
  const name = body.name?.trim() || 'Strategic watchlist';

  if (body.seedFromMemory || (!product && competitors.length === 0)) {
    const { rows } = await query<{ products: string[]; competitors: string[] }>(
      `SELECT products, competitors FROM user_memory WHERE user_id = $1 LIMIT 1`,
      [user.id],
    );
    const mem = rows[0];
    if (mem) {
      if (!product && mem.products?.[0]) product = mem.products[0];
      if (competitors.length === 0 && mem.competitors?.length) competitors = mem.competitors;
    }
    if (!product && competitors.length === 0) {
      return apiError(
        'No saved product or competitors were available; enter an explicit product and competitor.',
        400,
        'MISSING_WATCHLIST_TARGET',
      );
    }
  }
  if (!product) {
    return apiError('A target product is required', 400, 'MISSING_PRODUCT');
  }

  const watchlist = await createWatchlist({
    userId: user.id,
    workspaceId: tenant.workspaceId,
    name,
    product,
    cadence: body.cadence,
    maxCompetitors: body.maxCompetitors,
    weeklyAlertBudget: body.weeklyAlertBudget,
    alertChannels: body.alertChannels,
  });

  for (const c of competitors.slice(0, watchlist.max_competitors)) {
    if (c?.trim()) {
      await addWatchlistItem({ watchlistId: watchlist.id, competitor: c.trim() });
    }
  }

  const items = await listWatchlistItems(watchlist.id);
  return apiSuccess({ watchlist: { ...watchlist, items } }, 201);
}
