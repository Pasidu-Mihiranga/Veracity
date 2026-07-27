import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { featureFlags } from '@/lib/feature-flags';
import { listCompetitiveEvents } from '@/lib/alerts';
import { clusterCompetitiveEvents } from '@/lib/monitoring/cluster-events';
import { buildTrendSummaries } from '@/lib/monitoring/trend-summary';

export async function GET(req: Request) {
  if (!featureFlags.competitiveTimeline) {
    return NextResponse.json({ events: [], clusters: [], trends: [] });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(req.url);
  try {
    const events = await listCompetitiveEvents(user.id, {
      product: url.searchParams.get('product') ?? undefined,
      competitor: url.searchParams.get('competitor') ?? undefined,
      days: Number(url.searchParams.get('days') ?? 90),
    });

    const lite = events.map((e) => ({
      id: e.id,
      competitor: e.competitor,
      title: e.title,
      summary: e.summary,
      category: e.category,
      event_date: e.event_date,
      cluster_key: e.cluster_key,
    }));
    const clusters = clusterCompetitiveEvents(lite);
    const recent = events.filter((e) => {
      const d = new Date(e.event_date).getTime();
      return Date.now() - d <= 30 * 24 * 60 * 60 * 1000;
    });
    const trends = buildTrendSummaries(
      recent.map((e) => ({
        competitor: e.competitor,
        category: e.category,
        title: e.title,
      })),
    );

    return NextResponse.json({ events, clusters, trends });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '42P01') {
      return NextResponse.json({
        events: [],
        clusters: [],
        trends: [],
        warning: 'competitive_events table missing — run db:setup / migrations',
      });
    }
    throw err;
  }
}
