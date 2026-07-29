import { NextResponse } from 'next/server';
import { featureFlags } from '@/lib/feature-flags';
import { getCurrentUser } from '@/lib/auth';
import { deleteWatchlistItem } from '@/lib/watchlists';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { itemId } = await ctx.params;
  const ok = await deleteWatchlistItem(itemId, user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
