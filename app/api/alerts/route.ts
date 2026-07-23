import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { featureFlags } from '@/lib/feature-flags';
import { listAlerts, markAlertRead } from '@/lib/alerts';

export async function GET(req: Request) {
  if (!featureFlags.alerts) {
    return NextResponse.json({ alerts: [] });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  const alerts = await listAlerts(user.id, {
    unread: url.searchParams.get('unread') === '1',
    severity: url.searchParams.get('severity') ?? undefined,
    competitor: url.searchParams.get('competitor') ?? undefined,
  });
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  if (!featureFlags.alerts) {
    return NextResponse.json({ error: 'Alerts disabled' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const row = await markAlertRead(body.id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ alert: row });
}
