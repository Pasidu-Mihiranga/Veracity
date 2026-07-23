'use client';

import { useEffect, useState } from 'react';
import { featureFlags } from '@/lib/feature-flags';

type Cluster = {
  clusterKey: string;
  competitor: string;
  weekLabel: string;
  categoryFamily: string;
  events: Array<{ id: string; title: string; summary: string; event_date: string }>;
};

type Trend = {
  competitor: string;
  bullets: string[];
  overallTrend: string;
  eventCount: number;
};

type Props = {
  product?: string;
  competitor?: string;
};

export function CompetitiveTimeline({ product, competitor }: Props) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [flat, setFlat] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (!featureFlags.competitiveTimeline) return;
    const params = new URLSearchParams();
    if (product) params.set('product', product);
    if (competitor) params.set('competitor', competitor);
    void fetch(`/api/timeline?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { clusters?: Cluster[]; trends?: Trend[] } | null) => {
        if (!data) return;
        setClusters(data.clusters ?? []);
        setTrends(data.trends ?? []);
      })
      .catch(() => {});
  }, [product, competitor]);

  if (!featureFlags.competitiveTimeline) return null;
  if (clusters.length === 0 && trends.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {trends.map((t) => (
        <div key={t.competitor} className="veracity-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Last 30 days · {t.competitor}
            </span>
            <span className="text-[10px] font-mono text-accent">{t.eventCount} events</span>
          </div>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {t.bullets.map((b) => (
              <li key={b} className="text-sm text-foreground">• {b}</li>
            ))}
          </ul>
          <p className="text-[12px] font-mono text-muted-foreground pt-1">
            Overall trend · <span className="text-accent">{t.overallTrend}</span>
          </p>
        </div>
      ))}

      <div className="veracity-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Competitive timeline
          </span>
          <button
            type="button"
            onClick={() => setFlat((v) => !v)}
            className="text-[10px] font-mono uppercase text-muted-foreground"
          >
            {flat ? 'Clustered' : 'Flat'}
          </button>
        </div>
        {flat ? (
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            {clusters.flatMap((c) => c.events).map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-mono text-[10px] text-muted-foreground">{e.event_date}</span>
                <p className="text-foreground">{e.title}</p>
              </li>
            ))}
          </ul>
        ) : (
          clusters.map((c) => (
            <div key={c.clusterKey} className="rounded-xl border border-border p-3">
              <button
                type="button"
                className="w-full flex items-center justify-between text-left"
                onClick={() => setOpenKey((k) => (k === c.clusterKey ? null : c.clusterKey))}
              >
                <span className="text-sm text-foreground">
                  {c.weekLabel} · {c.competitor} · {c.categoryFamily}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {c.events.length} events
                </span>
              </button>
              {openKey === c.clusterKey || c.events.length === 1 ? (
                <ul className="mt-2 flex flex-col gap-1.5 m-0 p-0 list-none">
                  {c.events.map((e) => (
                    <li key={e.id} className="text-[12px] text-muted-foreground">
                      <span className="font-mono text-[10px]">{e.event_date}</span> — {e.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
