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

  const wl = lists[0];

  return (
    <div className="neu-extruded overflow-hidden rounded-[20px] mb-3" style={{ background: 'var(--surface-raised, var(--card))' }}>
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="ui-section-label text-muted-foreground">Watchlists</span>
        {!wl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => { void ensureList(); }}
            className="text-[10px] font-mono uppercase text-accent"
          >
            Create
          </button>
        ) : null}
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
              wl.health_status === 'healthy' ? 'text-emerald-600'
                : wl.health_status === 'degraded' ? 'text-amber-700'
                  : 'text-muted-foreground'
            }>
              {wl.health_status}
            </span>
          </div>
          <p className="text-[11px] text-foreground truncate">{wl.product || wl.name}</p>
          {(wl.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-foreground truncate">{item.competitor}</span>
              <button type="button" onClick={() => { void removeItem(wl.id, item.id); }} className="text-muted-foreground">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="Add competitor"
              className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-border bg-background"
            />
            <button type="button" disabled={busy} onClick={() => { void addCompetitor(); }} className="p-1.5 text-accent">
              <Plus size={14} />
            </button>
          </div>
          {featureFlags.alerts ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => { void runNow(wl.id); }}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded border border-accent/20 bg-accent/5 text-accent flex items-center gap-1 justify-center"
            >
              <Play size={10} /> Run now
            </button>
          ) : null}
        </div>
      ) : (
        <p className="px-3 pb-3 text-[11px] text-muted-foreground">Seed from memory to track competitors.</p>
      )}
    </div>
  );
}
