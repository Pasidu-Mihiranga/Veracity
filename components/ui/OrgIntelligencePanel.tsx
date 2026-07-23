'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, X } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';
import type { OrgIntelligence } from '@/lib/org-intelligence';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function OrgIntelligencePanel({ open, onClose }: Props) {
  const [data, setData] = useState<OrgIntelligence | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!featureFlags.orgIntelligence) return;
    const res = await fetch('/api/org/intelligence', { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to load');
      return;
    }
    const json = await res.json();
    setData(json.intelligence);
    setError('');
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open || !featureFlags.orgIntelligence) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <div className="w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-accent" />
            <div className="text-sm font-serif">Organization Intelligence</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600 font-mono">{error}</div>
        )}

        {data?.workspace && (
          <div className="veracity-card p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Workspace
            </div>
            <div className="text-sm font-medium">{data.workspace.name}</div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">
              {[data.workspace.industry, data.workspace.timezone].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Active watchlists" value={String(data.watchlists.active)} />
              <MetricCard label="Unread alerts" value={String(data.alerts.unread)} />
              <MetricCard label="Jobs succeeded" value={String(data.jobs.successful)} />
              <MetricCard label="Jobs failed" value={String(data.jobs.failed)} />
              <MetricCard
                label="Avg runtime"
                value={
                  data.jobs.averageRuntimeMs != null
                    ? `${Math.round(data.jobs.averageRuntimeMs / 1000)}s`
                    : '—'
                }
              />
              <MetricCard
                label="Decision accept rate"
                value={
                  data.decisions.acceptanceRate != null
                    ? `${Math.round(data.decisions.acceptanceRate * 100)}%`
                    : '—'
                }
              />
            </div>

            <div className="veracity-card p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Alert severity (unread)
              </div>
              <div className="flex gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                  high {data.alerts.high}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  med {data.alerts.medium}
                </span>
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  low {data.alerts.low}
                </span>
              </div>
            </div>

            <div className="veracity-card p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Watchlist health
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
                <div>healthy {data.watchlists.healthy}</div>
                <div>degraded {data.watchlists.degraded}</div>
                <div>stale {data.watchlists.stale}</div>
                <div>paused {data.watchlists.paused}</div>
              </div>
            </div>

            <div className="veracity-card p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                30d competitor activity
              </div>
              {data.trends.length === 0 ? (
                <div className="text-xs text-muted-foreground">No competitive events yet</div>
              ) : (
                <ul className="text-xs space-y-1">
                  {data.trends.map((t) => (
                    <li key={t.competitor} className="flex justify-between font-mono">
                      <span>{t.competitor}</span>
                      <span className="text-muted-foreground">{t.eventCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="veracity-card p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Recent decisions
              </div>
              {data.decisions.recent.length === 0 ? (
                <div className="text-xs text-muted-foreground">No decisions yet</div>
              ) : (
                <ul className="space-y-2">
                  {data.decisions.recent.map((d) => (
                    <li key={d.id} className="text-xs border-b border-border pb-2 last:border-0">
                      <div className="font-medium">{d.title}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {d.decision} · {d.outcome} · conf {(d.confidence * 100).toFixed(0)}%
                      </div>
                      {d.reason && <div className="text-muted-foreground mt-0.5">{d.reason}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="veracity-card p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className="text-lg font-serif">{value}</div>
    </div>
  );
}
