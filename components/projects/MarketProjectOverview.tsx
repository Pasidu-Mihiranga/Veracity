'use client';

import { Activity, Database, MessageSquare, RefreshCw, Scale } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMarketProjectOverview, type MarketProjectOverview } from '@/lib/projects';

export function MarketProjectOverview({ projectId, refreshKey }: { projectId: string; refreshKey?: string | number | null }) {
  const overviewQuery = useQuery<MarketProjectOverview>({
    queryKey: ['marketProjectOverview', projectId, refreshKey ?? null],
    queryFn: () => getMarketProjectOverview(projectId),
    staleTime: 0,
  });
  const overview = overviewQuery.data ?? null;

  if (overviewQuery.isLoading) return <div className="h-20 rounded-2xl skeleton" aria-label="Loading project overview" />;
  if (!overview) return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-700 dark:text-amber-300">
      Project history is unavailable. Confirm migration 0007 is applied.
    </div>
  );

  const latest = overview.latestSnapshot;
  return (
    <section className="veracity-card flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ui-section-label flex items-center gap-2 text-accent"><Activity size={13} /> Project research history</p>
        <span className="text-[10px] font-mono text-muted-foreground">Coverage changes, not claimed market events</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Metric icon={<MessageSquare size={13} />} label="Conversations" value={overview.conversationCount} />
        <Metric icon={<RefreshCw size={13} />} label="Research runs" value={overview.researchRunCount} />
        <Metric icon={<Database size={13} />} label="Latest sources" value={latest?.source_count ?? 0} />
        <Metric icon={<Activity size={13} />} label="Evidence coverage" value={latest?.evidence_score == null ? '—' : `${Math.round(latest.evidence_score * 100)}%`} />
        <Metric icon={<Scale size={13} />} label="Open decisions" value={overview.openDecisionCount} />
      </div>
      {latest ? (
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Latest research · {new Date(latest.generated_at).toLocaleString()}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-foreground">{latest.summary}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run the first baseline to create this project’s evidence snapshot.</p>
      )}
      {overview.coverageEvents.length ? (
        <details>
          <summary className="cursor-pointer text-[10px] font-mono uppercase text-muted-foreground">Recent research coverage changes</summary>
          <ul className="mt-2 space-y-2">
            {overview.coverageEvents.slice(0, 5).map((event) => (
              <li key={event.id} className="text-xs text-muted-foreground">• {event.title}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="mb-1 text-accent">{icon}</div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[9px] font-mono uppercase text-muted-foreground">{label}</p>
    </div>
  );
}
