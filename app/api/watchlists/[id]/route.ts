import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { featureFlags } from '@/lib/feature-flags';
import {
  addWatchlistItem,
  deleteWatchlist,
  getWatchlistForUser,
  listWatchlistItems,
  updateWatchlist,
} from '@/lib/watchlists';
import { inngest } from '@/lib/inngest/client';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const watchlist = await getWatchlistForUser(id, user.id);
  if (!watchlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const items = await listWatchlistItems(id);
  return NextResponse.json({ watchlist: { ...watchlist, items } });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({})) as {
    name?: string;
    product?: string;
    enabled?: boolean;
    competitor?: string;
    competitorUrl?: string;
    runNow?: boolean;
  };

  if (body.competitor?.trim()) {
    await addWatchlistItem({
      watchlistId: id,
      competitor: body.competitor.trim(),
      competitorUrl: body.competitorUrl,
    });
  }

  const watchlist = await updateWatchlist(id, user.id, {
    name: body.name,
    product: body.product,
    enabled: body.enabled,
  });
  if (!watchlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.runNow && featureFlags.alerts) {
    await inngest.send({
      name: 'monitoring/run.requested',
      data: { userId: user.id, watchlistId: id },
    });
  }

  const items = await listWatchlistItems(id);
  return NextResponse.json({ watchlist: { ...watchlist, items } });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteWatchlist(id, user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
