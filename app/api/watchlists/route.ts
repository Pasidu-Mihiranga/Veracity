import { NextResponse } from 'next/server';
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

export async function GET() {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ watchlists: [] });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenant = await resolveTenantFromCookies(user.id, user.email);
  const lists = await listWatchlists(user.id, tenant.workspaceId);
  const withItems = await Promise.all(
    lists.map(async (w) => ({
      ...w,
      items: await listWatchlistItems(w.id),
    })),
  );
  return NextResponse.json({ watchlists: withItems });
}

export async function POST(req: Request) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenant = await resolveTenantFromCookies(user.id, user.email);
  if (featureFlags.workspaces && tenant.workspaceId) {
    try {
      await requireWorkspaceAccess(user.id, tenant.workspaceId, 'watchlist.manage');
    } catch (err) {
      if (err instanceof PermissionError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  }

  let body: {
    name?: string;
    product?: string;
    seedFromMemory?: boolean;
    competitors?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
      if (competitors.length === 0) competitors = mem.competitors ?? [];
    }
  }

  const watchlist = await createWatchlist({
    userId: user.id,
    workspaceId: tenant.workspaceId,
    name,
    product: product || 'Product',
  });

  for (const c of competitors.slice(0, 12)) {
    if (c?.trim()) {
      await addWatchlistItem({ watchlistId: watchlist.id, competitor: c.trim() });
    }
  }

  const items = await listWatchlistItems(watchlist.id);
  return NextResponse.json({ watchlist: { ...watchlist, items } });
}
