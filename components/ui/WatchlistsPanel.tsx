'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';
import { formatRelativeSweep } from '@/lib/monitoring/health';

type Item = { id: string; competitor: string; enabled: boolean };
type Watchlist = {
  id: string;
  name: string;
  product: string;
  enabled: boolean;
  last_sweep_at: string | null;
  next_sweep_at: string | null;
  health_status: string;
  items: Item[];
};

export function WatchlistsPanel() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [competitor, setCompetitor] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!featureFlags.watchlists) return;
    const res = await fetch('/api/watchlists');
    if (!res.ok) return;
    const data = await res.json() as { watchlists: Watchlist[] };
    setLists(data.watchlists ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!featureFlags.watchlists) return null;

  const ensureList = async () => {
    setBusy(true);
    try {
      if (lists.length === 0) {
        await fetch('/api/watchlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seedFromMemory: true }),
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const addCompetitor = async () => {
    const wl = lists[0];
    if (!wl || !competitor.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/watchlists/${wl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor: competitor.trim() }),
      });
      setCompetitor('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const runNow = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/watchlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runNow: true }),
      });
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (watchlistId: string, itemId: string) => {
    await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, { method: 'DELETE' });
    await load();
  };

  const removeWatchlist = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/watchlists/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const wl = lists[0];

  return (
    <>
      <div className="neu-extruded overflow-hidden rounded-[20px] mb-3" style={{ background: 'var(--surface-raised, var(--card))' }}>
        <div className="px-3 py-2.5 flex items-center justify-between">
          <span className="ui-section-label text-muted-foreground">Watchlists</span>
          {!wl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => { void ensureList(); }}
              className="text-[10px] font-mono uppercase text-accent font-bold hover:underline cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Creating...' : 'Create'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600 p-0.5 transition-colors cursor-pointer"
              title="Delete Watchlist"
            >
              <Trash2 size={12} className="text-red-500" />
            </button>
          )}
        </div>
        {wl ? (
          <div className="px-3 pb-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground">
              <span>Last · {formatRelativeSweep(wl.last_sweep_at)}</span>
              <span>·</span>
              <span>
                Next · {wl.next_sweep_at ? new Date(wl.next_sweep_at).toLocaleDateString(undefined, { weekday: 'short' }) : '—'}
              </span>
              <span>·</span>
              <span className={
                wl.health_status === 'healthy' ? 'text-emerald-600 font-semibold'
                  : wl.health_status === 'degraded' ? 'text-amber-700 font-semibold'
                    : 'text-muted-foreground'
              }>
                {wl.health_status}
              </span>
            </div>
            <p className="text-[11px] text-foreground font-semibold truncate">{wl.product || wl.name}</p>
            {(wl.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-[12px] px-2 py-1 rounded-lg bg-accent/5 border border-border/30">
                <span className="text-foreground truncate">{item.competitor}</span>
                <button type="button" onClick={() => { void removeItem(wl.id, item.id); }} className="text-red-500 hover:text-red-600 transition-colors">
                  <Trash2 size={11} className="text-red-500" />
                </button>
              </div>
            ))}
            <div className="flex gap-1.5 mt-1">
              <input
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addCompetitor(); }}
                placeholder="Add competitor..."
                className="flex-1 text-[11px] px-2.5 py-1.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-accent"
              />
              <button type="button" disabled={busy || !competitor.trim()} onClick={() => { void addCompetitor(); }} className="px-2 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                <Plus size={14} />
              </button>
            </div>
            {featureFlags.alerts ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => { void runNow(wl.id); }}
                className="text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 flex items-center gap-1.5 justify-center transition-colors cursor-pointer mt-1"
              >
                <Play size={10} /> Run automated sweep now
              </button>
            ) : null}
          </div>
        ) : (
          <p className="px-3 pb-3 text-[11px] text-muted-foreground">Click <strong className="text-accent cursor-pointer" onClick={() => { void ensureList(); }}>CREATE</strong> to start automated competitor monitoring.</p>
        )}
      </div>

      {showDeleteConfirm && wl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-sm rounded-2xl p-5 bg-card border border-red-500/30 flex flex-col gap-4 shadow-2xl animate-scaleUp"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Delete Watchlist</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete this watchlist tracking &quot;{wl.product}&quot;? All automated monitoring schedules will be stopped.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await removeWatchlist(wl.id);
                }}
                className="px-4.5 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
