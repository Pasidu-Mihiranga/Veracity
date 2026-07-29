import { NextResponse } from 'next/server';
import { featureFlags } from '@/lib/feature-flags';
import { getCurrentUser } from '@/lib/auth';
import {
  addWatchlistItem,
  deleteWatchlist,
  getWatchlistForUser,
  listWatchlistItems,
  updateWatchlist,
} from '@/lib/watchlists';
import { inngest } from '@/lib/inngest/client';
import type { WatchlistCadence } from '@/lib/monitoring/health';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const user = await getCurrentUser();
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getWatchlistForUser(id, user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    product?: string;
    enabled?: boolean;
    competitor?: string;
    competitorUrl?: string;
    runNow?: boolean;
    cadence?: WatchlistCadence;
    maxCompetitors?: number;
    weeklyAlertBudget?: number;
    alertChannels?: string[];
  };

  const allowedCadences: WatchlistCadence[] = ['daily', 'twice_weekly', 'weekly', 'monthly'];
  if (body.cadence && !allowedCadences.includes(body.cadence)) {
    return NextResponse.json({ error: 'Invalid cadence' }, { status: 400 });
  }
  if (body.maxCompetitors !== undefined && (
    !Number.isInteger(body.maxCompetitors)
    || body.maxCompetitors < 1
    || body.maxCompetitors > 12
  )) {
    return NextResponse.json({ error: 'maxCompetitors must be between 1 and 12' }, { status: 400 });
  }
  if (body.weeklyAlertBudget !== undefined && (
    !Number.isInteger(body.weeklyAlertBudget)
    || body.weeklyAlertBudget < 1
    || body.weeklyAlertBudget > 50
  )) {
    return NextResponse.json({ error: 'weeklyAlertBudget must be between 1 and 50' }, { status: 400 });
  }
  const allowedChannels = new Set(['in_app', 'email', 'slack']);
  if (body.alertChannels?.some((channel) => !allowedChannels.has(channel))) {
    return NextResponse.json({ error: 'Invalid alert channel' }, { status: 400 });
  }

  if (body.competitor?.trim()) {
    const item = await addWatchlistItem({
      watchlistId: id,
      competitor: body.competitor.trim(),
      competitorUrl: body.competitorUrl,
      userId: user.id,
    });
    if (!item) {
      return NextResponse.json({
        error: `Competitor cap reached (${existing.max_competitors})`,
      }, { status: 409 });
    }
  }

  const watchlist = await updateWatchlist(id, user.id, {
    name: body.name,
    product: body.product,
    enabled: body.enabled,
    cadence: body.cadence,
    max_competitors: body.maxCompetitors,
    weekly_alert_budget: body.weeklyAlertBudget,
    alert_channels: body.alertChannels,
  });

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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteWatchlist(id, user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
