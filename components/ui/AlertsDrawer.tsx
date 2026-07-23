'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';

type AlertRow = {
  id: string;
  title: string;
  summary: string;
  severity: 'high' | 'medium' | 'low';
  competitor: string;
  read_at: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AlertsDrawer({ open, onClose }: Props) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [highOnly, setHighOnly] = useState(false);
  const [competitor, setCompetitor] = useState('');

  const load = useCallback(async () => {
    if (!featureFlags.alerts) return;
    const params = new URLSearchParams();
    if (unreadOnly) params.set('unread', '1');
    if (highOnly) params.set('severity', 'high');
    if (competitor.trim()) params.set('competitor', competitor.trim());
    const res = await fetch(`/api/alerts?${params}`);
    if (!res.ok) return;
    const data = await res.json() as { alerts: AlertRow[] };
    setAlerts(data.alerts ?? []);
  }, [unreadOnly, highOnly, competitor]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!featureFlags.alerts || !open) return null;

  const markRead = async (id: string) => {
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    void load();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
      <button type="button" className="absolute inset-0 bg-black/20" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Bell size={14} /> Alerts
          </span>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${unreadOnly ? 'bg-accent/5 text-accent border-accent/20' : 'border-border text-muted-foreground'}`}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => setHighOnly((v) => !v)}
            className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${highOnly ? 'bg-red-50 text-red-600 border-red-200' : 'border-border text-muted-foreground'}`}
          >
            High
          </button>
          <input
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder="Competitor"
            className="text-[11px] font-mono px-2 py-1 rounded border border-border bg-background flex-1 min-w-[8rem]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            alerts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { void markRead(a.id); }}
                className={`veracity-card p-3 text-left ${a.read_at ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                    a.severity === 'high'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : a.severity === 'medium'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {a.severity}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.competitor}</span>
                </div>
                <p className="text-sm text-foreground font-medium">{a.title}</p>
                <p className="text-[12px] text-muted-foreground mt-1 line-clamp-3">{a.summary}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
