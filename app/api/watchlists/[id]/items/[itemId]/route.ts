import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { featureFlags } from '@/lib/feature-flags';
import { deleteWatchlistItem } from '@/lib/watchlists';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!featureFlags.watchlists) {
    return NextResponse.json({ error: 'Watchlists disabled' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { itemId } = await ctx.params;
  const ok = await deleteWatchlistItem(itemId, user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
