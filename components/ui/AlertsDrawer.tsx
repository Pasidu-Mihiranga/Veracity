'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, X, Trash2 } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';
import { unwrapApiPayload } from '@/lib/api-client';

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
    const raw = await res.json();
    const data = unwrapApiPayload<{ alerts?: AlertRow[] }>(raw);
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

  const dismissAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
  };

  const clearAllAlerts = async () => {
    setAlerts([]);
    await fetch('/api/alerts', { method: 'DELETE' });
  };

  const unreadCount = alerts.filter((a) => !a.read_at).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end p-2.5 sm:p-4 pointer-events-none" role="dialog">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity animate-fadeIn pointer-events-auto"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md h-full rounded-2xl bg-card/95 backdrop-blur-xl border border-border/80 flex flex-col overflow-hidden shadow-2xl pointer-events-auto animate-slideInRight"
        style={{
          boxShadow: 'var(--shadow-extruded), 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Floating Notification Window Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border/60 bg-accent/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0 shadow-xs relative">
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                Notifications & Alerts
                {unreadCount > 0 && (
                  <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                    {unreadCount} Unread
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Real-time competitive intelligence feed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/15 border border-border/50 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/40 bg-accent/5">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              unreadOnly
                ? 'bg-accent/15 text-accent border-accent/30 shadow-2xs'
                : 'border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => setHighOnly((v) => !v)}
            className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              highOnly
                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 shadow-2xs'
                : 'border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            High Priority
          </button>
          <input
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder="Search competitor..."
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg border border-border/60 bg-background text-foreground flex-1 min-w-[7rem] outline-none focus:border-accent"
          />
        </div>

        {/* Scrollable Notification List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
              <Bell size={24} className="text-muted-foreground/40" />
              <p className="text-xs">No notifications matching current filter.</p>
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                onClick={() => { void markRead(a.id); }}
                className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all cursor-pointer ${
                  a.read_at
                    ? 'bg-accent/5 border-border/40 opacity-70'
                    : 'bg-card border-accent/30 shadow-xs hover:border-accent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        a.severity === 'high'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                          : a.severity === 'medium'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-accent/10 text-accent border-accent/25'
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                      {a.competitor}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => void dismissAlert(a.id, e)}
                      className="text-muted-foreground hover:text-red-500 hover:bg-red-500/15 p-1 rounded-md transition-all cursor-pointer"
                      title="Dismiss notification"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-foreground leading-snug">{a.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{a.summary}</p>
              </div>
            ))
          )}
        </div>

        {/* Floating Notification Window Footer Bar */}
        <div className="px-5 py-3.5 border-t border-border/60 bg-accent/5 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => void clearAllAlerts()}
            disabled={alerts.length === 0}
            className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Trash2 size={13} />
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
