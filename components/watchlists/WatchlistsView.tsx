'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Eye, Plus, Play, Trash2, ShieldCheck, Activity, Radio, Bell, BarChart3, PieChart, TrendingUp, Sparkles, CheckCircle2
} from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';
import { formatRelativeSweep } from '@/lib/monitoring/health';
import { unwrapApiPayload } from '@/lib/api-client';

type Item = { id: string; competitor: string; enabled: boolean };
type Watchlist = {
  id: string;
  name: string;
  product: string;
  enabled: boolean;
  last_sweep_at: string | null;
  next_sweep_at: string | null;
  health_status: string;
  cadence: 'daily' | 'twice_weekly' | 'weekly' | 'monthly';
  max_competitors: number;
  weekly_alert_budget: number;
  alert_channels: string[];
  last_sweep_summary: {
    materialEvents?: number;
    suppressedSignals?: number;
    limitations?: string[];
  };
  items: Item[];
};

type AlertEvent = {
  id: string;
  product: string;
  competitor: string;
  title: string;
  summary: string;
  severity: 'high' | 'medium' | 'low';
  created_at: string;
  diff?: {
    category?: string;
    [key: string]: unknown;
  };
};

export function WatchlistsView() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [competitorInput, setCompetitorInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newCompetitorsText, setNewCompetitorsText] = useState('');
  const [newCadence, setNewCadence] = useState<Watchlist['cadence']>('weekly');
  const [newMaxCompetitors, setNewMaxCompetitors] = useState(6);
  const [newWeeklyAlertBudget, setNewWeeklyAlertBudget] = useState(12);
  const [newAlertChannels, setNewAlertChannels] = useState<string[]>(['in_app']);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'watchlist' | 'item';
    id: string;
    itemId?: string;
    title: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!featureFlags.watchlists) return;
    setLoading(true);
    try {
      const [wRes, aRes] = await Promise.all([
        fetch('/api/watchlists').catch(() => null),
        fetch('/api/alerts').catch(() => null),
      ]);

      if (wRes && wRes.ok) {
        const raw = await wRes.json().catch(() => null);
        const wData = unwrapApiPayload<{ watchlists?: Watchlist[] }>(raw);
        if (wData.watchlists) {
          setLists(wData.watchlists);
        }
      }

      if (aRes && aRes.ok) {
        const raw = await aRes.json().catch(() => null);
        const aData = unwrapApiPayload<{ alerts?: AlertEvent[] }>(raw);
        if (aData.alerts) {
          setAlerts(aData.alerts);
        }
      }
    } catch {
      // Silently catch unexpected network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateWatchlist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      const comps = newCompetitorsText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: newProductName.trim() || undefined,
          competitors: comps.length > 0 ? comps : undefined,
          seedFromMemory: comps.length === 0 && !newProductName.trim(),
          cadence: newCadence,
          maxCompetitors: newMaxCompetitors,
          weeklyAlertBudget: newWeeklyAlertBudget,
          alertChannels: newAlertChannels,
        }),
      });
      setNewProductName('');
      setNewCompetitorsText('');
      setNewCadence('weekly');
      setNewMaxCompetitors(6);
      setNewWeeklyAlertBudget(12);
      setNewAlertChannels(['in_app']);
      setShowCreateModal(false);
      showToast('Watchlist created successfully!');
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const addCompetitor = async (watchlistId: string) => {
    const text = (competitorInput[watchlistId] ?? '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await fetch(`/api/watchlists/${watchlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor: text }),
      });
      setCompetitorInput((prev) => ({ ...prev, [watchlistId]: '' }));
      showToast(`Added ${text} to watchlist`);
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const runSweepNow = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/watchlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runNow: true }),
      });
      showToast('Multi-agent sweep queued! Background research started.', 'info');
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const updateMonitoringConfig = async (
    id: string,
    patch: Record<string, unknown>,
  ) => {
    setBusy(true);
    try {
      await fetch(`/api/watchlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      showToast('Watchlist configuration updated');
      await loadData();
    } finally {
      setBusy(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setBusy(true);
    try {
      if (deleteConfirm.type === 'watchlist') {
        await fetch(`/api/watchlists/${deleteConfirm.id}`, { method: 'DELETE' });
        showToast('Watchlist deleted');
      } else if (deleteConfirm.itemId) {
        await fetch(`/api/watchlists/${deleteConfirm.id}/items/${deleteConfirm.itemId}`, {
          method: 'DELETE',
        });
        showToast('Competitor removed');
      }
      await loadData();
    } finally {
      setBusy(false);
      setDeleteConfirm(null);
    }
  };

  if (!featureFlags.watchlists) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Watchlists monitoring feature is currently disabled in system feature flags.
      </div>
    );
  }

  const totalTrackedCompetitors = lists.reduce((acc, wl) => acc + (wl.items?.length ?? 0), 0);

  // Compute competitor tracking breakdown
  const competitorStatsMap: Record<string, number> = {};
  lists.forEach((wl) => {
    wl.items?.forEach((item) => {
      competitorStatsMap[item.competitor] = (competitorStatsMap[item.competitor] ?? 0) + 1;
    });
  });

  const competitorEntries = Object.entries(competitorStatsMap);
  const displayAlerts: AlertEvent[] = alerts;

  // Dynamic calculation of Delta Category Shifts from actual alerts
  const totalAlertsCount = alerts.length;
  let pricingCount = 0;
  let featureCount = 0;
  let positioningCount = 0;

  alerts.forEach((a) => {
    const cat = String(a.diff?.category ?? '').toLowerCase();
    const titleLower = a.title.toLowerCase();
    if (cat.includes('price') || cat.includes('pricing') || titleLower.includes('price') || titleLower.includes('pricing')) {
      pricingCount++;
    } else if (cat.includes('feature') || cat.includes('launch') || cat.includes('docs') || titleLower.includes('feature') || titleLower.includes('launch')) {
      featureCount++;
    } else {
      positioningCount++;
    }
  });

  const pricingPct = totalAlertsCount > 0 ? Math.round((pricingCount / totalAlertsCount) * 100) : 0;
  const featurePct = totalAlertsCount > 0 ? Math.round((featureCount / totalAlertsCount) * 100) : 0;
  const positioningPct = totalAlertsCount > 0 ? Math.round((positioningCount / totalAlertsCount) * 100) : 0;

  const totalMaxCapacity = lists.reduce((acc, wl) => acc + (wl.max_competitors || 6), 0);
  const targetCapacityPct = totalMaxCapacity > 0 ? Math.min(100, Math.round((totalTrackedCompetitors / totalMaxCapacity) * 100)) : 0;

  const uniqueCadences = Array.from(new Set(lists.map((w) => w.cadence)));
  const cadenceDisplay = lists.length === 0
    ? 'Not configured'
    : `${uniqueCadences.map((c) => c.replace('_', ' ')).join(', ')} · 09:00 UTC`;

  const healthyCount = lists.filter((w) => w.health_status === 'healthy').length;
  const systemStatusDisplay = lists.length === 0
    ? 'Ready · Source Gated'
    : `${healthyCount}/${lists.length} Healthy · Source Gated`;

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn pb-24">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all animate-fadeIn ${
            toast.type === 'info'
              ? 'bg-accent/15 border border-accent/40 text-accent'
              : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{toast.message}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header Executive Card - Standardized Across Top Tabs */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-2xl font-bold shrink-0">
            <Eye size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Competitor Intelligence Watchlists</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-[11px] font-semibold text-accent">
                Automated Sweeps
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-agent background monitoring continuously tracks competitor pricing, features, and positioning shifts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={15} /> Create Watchlist
        </button>
      </div>

      {/* 4-Card Metric Grid - Matching API Usage Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="rounded-2xl p-4 bg-card border border-border flex items-center gap-3 shadow-xs"
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <Radio size={18} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Active Watchlists</span>
            <span className="text-lg font-bold text-foreground">{lists.length}</span>
          </div>
        </div>

        <div
          className="rounded-2xl p-4 bg-card border border-border flex items-center gap-3 shadow-xs"
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Tracked Competitors</span>
            <span className="text-lg font-bold text-foreground">{totalTrackedCompetitors}</span>
          </div>
        </div>

        <div
          className="rounded-2xl p-4 bg-card border border-border flex items-center gap-3 shadow-xs"
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Sweep Cadence</span>
            <span className="text-xs font-bold text-foreground capitalize">{cadenceDisplay}</span>
          </div>
        </div>

        <div
          className="rounded-2xl p-4 bg-card border border-border flex items-center gap-3 shadow-xs"
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">System Status</span>
            <span className="text-xs font-bold text-foreground">{systemStatusDisplay}</span>
          </div>
        </div>
      </div>

      {/* Balanced 2-Column Equal-Height Grid (6 Cols Left / 6 Cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column (6 Cols): Active Watchlists & Competitors */}
        <div className="lg:col-span-6 flex flex-col h-full">
          <div
            className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-5 shadow-sm h-full justify-between"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-accent" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Active Watchlists ({lists.length})
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">Multi-Agent Monitoring</span>
              </div>

              {loading ? (
                <div className="p-6 flex flex-col gap-3 animate-pulse">
                  <div className="h-5 bg-accent/10 rounded w-1/4" />
                  <div className="h-4 bg-accent/10 rounded w-1/2" />
                </div>
              ) : lists.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    No competitor watchlists configured yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                  >
                    <Plus size={14} className="inline mr-1" /> Add Watchlist
                  </button>
                </div>
              ) : (
                lists.map((wl) => (
                  <div
                    key={wl.id}
                    className="rounded-xl p-5 bg-accent/5 border border-border/50 flex flex-col gap-4"
                  >
                    {/* Watchlist Top Header */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                          Target Product Baseline
                        </span>
                        <h3 className="text-base font-bold text-foreground mt-0.5">
                          {wl.product || wl.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold capitalize bg-accent/15 border border-accent/30 text-accent">
                          {wl.health_status}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'watchlist',
                              id: wl.id,
                              title: `watchlist "${wl.product || wl.name}"`,
                            })
                          }
                          className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-lg transition-all cursor-pointer"
                          title="Delete Watchlist"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Sweep Status Info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-background/60 px-3.5 py-2 rounded-lg border border-border/30">
                      <span>Last Sweep: <strong>{formatRelativeSweep(wl.last_sweep_at)}</strong></span>
                      <span>Next: <strong>{wl.next_sweep_at ? new Date(wl.next_sweep_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</strong></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <label className="flex flex-col gap-1 text-muted-foreground">
                        <span className="font-mono uppercase text-[9px]">Cadence</span>
                        <select
                          value={wl.cadence}
                          disabled={busy}
                          onChange={(event) => void updateMonitoringConfig(wl.id, { cadence: event.target.value })}
                          className="px-2.5 py-2 rounded-lg bg-card border border-border text-foreground"
                        >
                          <option value="daily">Daily</option>
                          <option value="twice_weekly">Twice weekly</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-muted-foreground">
                        <span className="font-mono uppercase text-[9px]">Competitor cap</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          defaultValue={wl.max_competitors}
                          disabled={busy}
                          onBlur={(event) => void updateMonitoringConfig(wl.id, {
                            maxCompetitors: Number(event.target.value),
                          })}
                          className="px-2.5 py-2 rounded-lg bg-card border border-border text-foreground"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-muted-foreground">
                        <span className="font-mono uppercase text-[9px]">Alerts/week</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          defaultValue={wl.weekly_alert_budget}
                          disabled={busy}
                          onBlur={(event) => void updateMonitoringConfig(wl.id, {
                            weeklyAlertBudget: Number(event.target.value),
                          })}
                          className="px-2.5 py-2 rounded-lg bg-card border border-border text-foreground"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono uppercase text-muted-foreground">
                      <span>Channels: {wl.alert_channels.map((c) => c.replace('_', '-')).join(', ')}</span>
                      {(['email', 'slack'] as const).map((channel) => (
                        <label key={channel} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={wl.alert_channels.includes(channel)}
                            disabled={busy}
                            onChange={(event) => {
                              const channels = event.target.checked
                                ? [...new Set([...wl.alert_channels, channel])]
                                : wl.alert_channels.filter((value) => value !== channel);
                              void updateMonitoringConfig(wl.id, { alertChannels: channels });
                            }}
                          />
                          {channel}
                        </label>
                      ))}
                    </div>
                    {(wl.last_sweep_summary?.limitations?.length ?? 0) > 0 ? (
                      <div className="rounded-lg px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                        <span className="font-mono uppercase text-[9px] block mb-1">Sweep limitations</span>
                        {wl.last_sweep_summary.limitations!.slice(0, 2).join(' ')}
                      </div>
                    ) : null}

                    {/* Competitor Chips List */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-foreground">
                        Tracked Competitors ({wl.items?.length ?? 0})
                      </span>
                      {wl.items?.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No competitors added yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {wl.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/50 text-xs"
                            >
                              <span className="font-semibold text-foreground truncate">{item.competitor}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirm({
                                    type: 'item',
                                    id: wl.id,
                                    itemId: item.id,
                                    title: `competitor "${item.competitor}"`,
                                  })
                                }
                                className="text-red-500 hover:text-red-600 p-0.5 transition-colors cursor-pointer"
                                title="Remove competitor"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Competitor Input & Sweep Button */}
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-border/40">
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={competitorInput[wl.id] ?? ''}
                          onChange={(e) =>
                            setCompetitorInput((prev) => ({ ...prev, [wl.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addCompetitor(wl.id);
                          }}
                          placeholder="Add competitor (e.g. Clay)..."
                          className="flex-1 px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          disabled={busy || !(competitorInput[wl.id] ?? '').trim() || wl.items.length >= wl.max_competitors}
                          onClick={() => void addCompetitor(wl.id)}
                          className="px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer shrink-0"
                        >
                          <Plus size={14} className="inline mr-1" /> Add
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runSweepNow(wl.id)}
                        className="w-full py-2.5 rounded-xl border border-accent/30 bg-accent/15 hover:bg-accent/25 text-accent text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play size={12} /> {busy ? 'Sweeping...' : 'Run Automated Multi-Agent Sweep Now'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Equal Height Stacked Cards */}
        <div className="lg:col-span-6 flex flex-col gap-6 justify-between h-full">
          {/* Statistical Intelligence Visualizations */}
          <div
            className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-5 shadow-sm"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-accent" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Statistical Intelligence & Distribution
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">Market Analytics</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Donut Chart Visual Representation */}
              <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-accent/5 border border-border/40">
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-border"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-accent"
                      strokeDasharray={`${targetCapacityPct}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-bold text-foreground">{totalTrackedCompetitors}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">Targets</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-foreground mb-0.5">Roster Share</span>
                  {competitorEntries.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No targets.</span>
                  ) : (
                    competitorEntries.slice(0, 4).map(([name, count]) => {
                      const pct = totalTrackedCompetitors > 0 ? Math.round((count / totalTrackedCompetitors) * 100) : 0;
                      return (
                        <div key={name} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                            <span className="text-muted-foreground truncate font-medium">{name}</span>
                          </div>
                          <span className="font-mono font-bold text-foreground ml-1.5">{pct}%</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Signal Severity & Category Breakdown Bar Graph */}
              <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-accent/5 border border-border/40">
                <span className="text-[11px] font-bold text-foreground">Delta Category Shifts</span>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Pricing Adjustments</span>
                    <span className="font-mono font-bold text-foreground">{pricingPct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pricingPct}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Feature Drops</span>
                    <span className="font-mono font-bold text-foreground">{featurePct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-accent/80 rounded-full transition-all duration-500" style={{ width: `${featurePct}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">GTM Positioning</span>
                    <span className="font-mono font-bold text-foreground">{positioningPct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full transition-all duration-500" style={{ width: `${positioningPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Swept Intelligence Signals Feed Card - Flexible Fill for Height Equalization */}
          <div
            className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm flex-1 justify-between"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-accent" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Recent Swept Signals & Deltas
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">Multi-Agent Feed</span>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                {displayAlerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No material, source-grounded changes detected yet.
                  </p>
                ) : null}
                {displayAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-xl bg-accent/5 border border-border/40 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-accent/15 text-accent font-mono font-bold text-[10px]">
                          {alert.competitor}
                        </span>
                        <span className="text-muted-foreground text-[11px]">vs {alert.product}</span>
                      </div>
                      <span className="font-mono text-muted-foreground text-[10px]">
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="font-bold text-foreground leading-snug">{alert.title}</h4>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">{alert.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create Watchlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-2xl animate-scaleUp"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-accent" />
                <h3 className="text-sm font-bold text-foreground">Create Competitor Watchlist</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWatchlist} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Target Product Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Vector Agents"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs text-muted-foreground">
                  <span className="font-semibold block mb-1.5">Cadence</span>
                  <select
                    value={newCadence}
                    onChange={(event) => setNewCadence(event.target.value as Watchlist['cadence'])}
                    className="w-full px-2 py-2.5 rounded-xl bg-accent/5 border border-border text-foreground"
                  >
                    <option value="daily">Daily</option>
                    <option value="twice_weekly">2× weekly</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  <span className="font-semibold block mb-1.5">Competitor cap</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newMaxCompetitors}
                    onChange={(event) => setNewMaxCompetitors(Number(event.target.value))}
                    className="w-full px-2 py-2.5 rounded-xl bg-accent/5 border border-border text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  <span className="font-semibold block mb-1.5">Alerts/week</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newWeeklyAlertBudget}
                    onChange={(event) => setNewWeeklyAlertBudget(Number(event.target.value))}
                    className="w-full px-2 py-2.5 rounded-xl bg-accent/5 border border-border text-foreground"
                  />
                </label>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground block mb-1.5">Alert channels</span>
                <div className="flex gap-3">
                  {(['email', 'slack'] as const).map((channel) => (
                    <label key={channel} className="flex items-center gap-1.5 text-xs font-mono uppercase text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newAlertChannels.includes(channel)}
                        onChange={(event) => setNewAlertChannels((current) =>
                          event.target.checked
                            ? [...new Set([...current, channel])]
                            : current.filter((value) => value !== channel),
                        )}
                      />
                      {channel}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  In-app alerts are always retained. Email/Slack send only when server connectors are configured.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Initial Competitors (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Clay, Lilian, Notion"
                  value={newCompetitorsText}
                  onChange={(e) => setNewCompetitorsText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Leave empty to automatically seed competitors from your AI memory.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4.5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                >
                  {busy ? 'Creating...' : 'Create Watchlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteConfirm && (
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
                <h3 className="text-sm font-bold text-foreground">Confirm Deletion</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete {deleteConfirm.title}? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeDelete()}
                className="px-4.5 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-xs transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
