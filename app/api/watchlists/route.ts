import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { featureFlags } from '@/lib/feature-flags';
import {
  addWatchlistItem,
  createWatchlist,
  listWatchlistItems,
  listWatchlists,
} from '@/lib/watchlists';
import { query } from '@/lib/db';

export async function GET() {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ watchlists: [] });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const lists = await listWatchlists(user.id);
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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
  let name = body.name?.trim() || 'Strategic watchlist';

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
