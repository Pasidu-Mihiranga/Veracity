'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Plus, RefreshCw, Circle, AlertCircle, Check,
  Search, Sparkles, TrendingUp, Play, Trash2, Globe, ShieldCheck,
  Zap, DollarSign, Rocket, Target
} from 'lucide-react';
import { listMarketProjects, type MarketProject } from '@/lib/projects';
import { importanceOf } from '@/lib/ux/vocabulary';

interface ResearchSession {
  id: string;
  title: string;
  updated_at: string;
}

interface DigestItem {
  id: string;
  entityLabel: string;
  eventType: string;
  beforeValue: string | null;
  afterValue: string | null;
  observedAt: string;
  materiality: number;
  materialityReason: string;
}

interface ProjectFeed {
  project: MarketProject;
  headline: string;
  itemCount: number;
  items: DigestItem[];
  ok: boolean;
  error?: string;
  loaded: boolean;
  sourcesChecked: number;
  staleCount: number;
}

interface HomeFeedProps {
  onOpenProject: (project: MarketProject) => void;
  onStartTracking: () => void;
  onOpenSession?: (sessionId: string) => void;
  onLaunchQuery?: (query: string) => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function HomeFeed({ onOpenProject, onStartTracking, onOpenSession, onLaunchQuery }: HomeFeedProps) {
  const [feeds, setFeeds] = useState<ProjectFeed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [homeSearchInput, setHomeSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'changes' | 'stale'>('all');

  const loadSessions = useCallback(() => {
    fetch('/api/sessions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const rows = payload?.data?.sessions ?? payload?.sessions ?? payload?.data ?? [];
        if (Array.isArray(rows)) setSessions(rows.slice(0, 6));
      })
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const projects = await listMarketProjects();
      setFeeds(
        projects.map((project) => ({
          project, headline: '', itemCount: 0, items: [], ok: true, loaded: false,
          sourcesChecked: 0, staleCount: 0,
        })),
      );

      projects.forEach(async (project) => {
        let next: ProjectFeed;
        try {
          const response = await fetch(`/api/projects/${project.id}/dashboard`, {
            credentials: 'include',
          });
          if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`${response.status}${body ? ` — ${body.slice(0, 140)}` : ''}`);
          }
          const payload = await response.json();
          const data = payload?.data ?? payload;
          const digest = data?.digest;
          const items: DigestItem[] = (digest?.sections ?? []).flatMap(
            (section: { items: DigestItem[] }) => section.items ?? [],
          );
          next = {
            project,
            headline: digest?.headline ?? 'Nothing has changed yet.',
            itemCount: digest?.itemCount ?? 0,
            items: items.slice(0, 4),
            ok: true,
            loaded: true,
            sourcesChecked: data?.sourcesChecked ?? 0,
            staleCount: (data?.staleSources ?? []).length,
          };
        } catch (err) {
          next = {
            project, headline: '', itemCount: 0, items: [], ok: false, loaded: true,
            sourcesChecked: 0, staleCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }
        setFeeds((prev) =>
          (prev ?? []).map((feed) => (feed.project.id === project.id ? next : feed)),
        );
      });
    } catch {
      setFeeds([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleQuickSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = homeSearchInput.trim();
    if (!query) return;
    onLaunchQuery?.(query);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE', credentials: 'include' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // Ignore
    }
  };

  if (feeds === null) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="veracity-card p-6 flex flex-col gap-3 animate-pulse">
            <div className="h-4 w-1/3 rounded bg-accent/10" />
            <div className="h-3 w-2/3 rounded bg-accent/10" />
          </div>
        ))}
      </div>
    );
  }

  const totalChanges = feeds.reduce((sum, feed) => sum + feed.itemCount, 0);
  const stillLoading = feeds.some((feed) => !feed.loaded);
  const totalSources = feeds.reduce((sum, feed) => sum + feed.sourcesChecked, 0);
  const totalStale = feeds.reduce((sum, feed) => sum + feed.staleCount, 0);

  const filteredFeeds = feeds.filter((feed) => {
    if (activeFilter === 'changes') return feed.itemCount > 0;
    if (activeFilter === 'stale') return feed.staleCount > 0 || !feed.ok;
    return true;
  });

  const DEMO_STARTER_PROMPTS = [
    { label: 'Compare PickMe and Uber in Sri Lanka ride hailing', icon: Zap },
    { label: 'Analyze SaaS competitor pricing tiers & discounts', icon: DollarSign },
    { label: 'Detect recent product releases for top competitors', icon: Rocket },
    { label: 'Executive market positioning & GTM breakdown', icon: Target },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Quick Interactive Executive Intelligence Search Box */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm relative overflow-hidden"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Instant Growth Intelligence</h2>
              <p className="text-xs text-muted-foreground">Ask any research question to launch 6 specialist agents immediately</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-[11px] font-semibold text-accent hidden sm:inline-block">
            Autonomous Swarm Active
          </span>
        </div>

        <form onSubmit={handleQuickSearchSubmit} className="flex gap-2 w-full">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
            <input
              type="text"
              value={homeSearchInput}
              onChange={(e) => setHomeSearchInput(e.target.value)}
              placeholder="Ask a growth intelligence question directly from Home..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!homeSearchInput.trim()}
            className="px-5 py-3 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md"
          >
            <Play size={13} /> Launch Research
          </button>
        </form>

        {/* Clickable Starter Prompt Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp size={12} className="text-accent" /> Quick Prompts:
          </span>
          {DEMO_STARTER_PROMPTS.map((prompt, idx) => {
            const Icon = prompt.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onLaunchQuery?.(prompt.label)}
                className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/25 text-xs text-foreground font-medium transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-1.5"
              >
                <Icon size={12} className="text-accent shrink-0" />
                <span>{prompt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Top Header Status & Refresh Controls */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {stillLoading
              ? 'Checking your companies…'
              : totalChanges > 0
                ? `${totalChanges} change${totalChanges === 1 ? '' : 's'} worth your attention`
                : 'Nothing has moved'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Across {feeds.length} tracked {feeds.length === 1 ? 'company' : 'companies'}.
            We checked every source and compared it against what we already had.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onStartTracking}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2 text-xs font-bold text-accent hover:bg-accent/20 transition-colors cursor-pointer"
          >
            <Plus size={13} /> Track another
          </button>
        </div>
      </div>

      {/* 3. Interactive Stat Tiles (Clickable Quick Filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveFilter('all')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
            activeFilter === 'all'
              ? 'bg-accent/15 border-accent shadow-md ring-2 ring-accent/20'
              : 'bg-card border-border hover:border-accent/40'
          }`}
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Companies</p>
            <span className="text-[10px] font-mono font-bold text-accent bg-accent/15 px-2 py-0.5 rounded">
              {activeFilter === 'all' ? 'Filtered' : 'View All'}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{feeds.length}</p>
          <p className="text-xs text-muted-foreground">being watched for you</p>
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl border bg-card border-border hover:border-accent/40 transition-all flex flex-col gap-1"
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sources read</p>
            <Globe size={14} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{totalSources}</p>
          <p className="text-xs text-muted-foreground">{totalSources === 0 ? 'no pages read yet' : 'pages checked each run'}</p>
        </div>

        <div
          onClick={() => setActiveFilter(activeFilter === 'changes' ? 'all' : 'changes')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
            activeFilter === 'changes'
              ? 'bg-accent/15 border-accent shadow-md ring-2 ring-accent/20'
              : 'bg-card border-border hover:border-accent/40'
          }`}
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Changes</p>
            <span className="text-[10px] font-mono font-bold text-accent bg-accent/15 px-2 py-0.5 rounded">
              {activeFilter === 'changes' ? 'Active Filter' : 'Filter Changes'}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{totalChanges}</p>
          <p className="text-xs text-muted-foreground">worth your attention</p>
        </div>

        <div
          onClick={() => setActiveFilter(activeFilter === 'stale' ? 'all' : 'stale')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1 ${
            activeFilter === 'stale'
              ? 'bg-amber-500/15 border-amber-500 shadow-md'
              : 'bg-card border-border hover:border-accent/40'
          }`}
          style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Health Status</p>
            <ShieldCheck size={14} className={totalStale > 0 ? 'text-amber-500' : 'text-emerald-500'} />
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{totalStale}</p>
          <p className="text-xs text-muted-foreground">{totalStale === 0 ? 'every source responded' : 'sources that failed'}</p>
        </div>
      </div>

      {/* 4. Interactive Project Cards List */}
      {filteredFeeds.map((feed) => (
        <div
          key={feed.project.id}
          className="rounded-2xl p-5 sm:p-6 bg-card border border-border flex flex-col gap-4 shadow-sm hover:border-accent/40 transition-colors"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground truncate">
                  {feed.project.product}
                </h2>
                <span className="text-[10px] font-mono font-bold text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/25">
                  Tracked Baseline
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {feed.project.competitors.length > 0
                  ? `Compared against ${feed.project.competitors.join(', ')}`
                  : 'No competitors added yet'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onLaunchQuery?.(`Run full competitor benchmark for ${feed.project.product}`)}
                className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/25 text-xs text-accent font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Search size={12} /> Quick Research
              </button>
              <button
                type="button"
                onClick={() => onOpenProject(feed.project)}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              >
                Open <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {!feed.loaded ? (
            <div className="h-3 w-1/3 rounded bg-accent/10 animate-pulse" />
          ) : !feed.ok ? (
            <p className="flex items-start gap-2 text-xs text-amber-500 font-medium">
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span>Could not read this company&apos;s history — {feed.error}</span>
            </p>
          ) : feed.itemCount === 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <Check size={16} className="text-emerald-500 shrink-0" />
              <span>Nothing changed. We checked and everything is where you left it.</span>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">{feed.headline}</p>
              <ul className="flex flex-col gap-2.5">
                {feed.items.map((item) => {
                  const importance = importanceOf(item.materiality);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-2.5 rounded-xl bg-accent/5 border border-border/50 px-3.5 py-2.5 hover:border-accent/30 transition-colors"
                    >
                      <Circle size={8} className="mt-1.5 shrink-0 fill-current text-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-foreground">
                          <span className="font-bold">{item.entityLabel}</span>
                          {item.beforeValue && item.afterValue ? (
                            <> — {item.beforeValue} → {item.afterValue}</>
                          ) : (
                            <> — {item.eventType.replace(/_/g, ' ')}</>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                          <span title={importance.meaning} className="font-semibold text-accent">{importance.label}</span>
                          {' · '}
                          {relativeTime(item.observedAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {feed.itemCount > feed.items.length && (
                <button
                  type="button"
                  onClick={() => onOpenProject(feed.project)}
                  className="self-start text-xs font-bold text-accent hover:underline cursor-pointer"
                >
                  {feed.itemCount - feed.items.length} more updates →
                </button>
              )}
            </>
          )}
        </div>
      ))}

      {/* 5. Interactive "Pick up where you left off" Recent Sessions Card */}
      {sessions.length > 0 && (
        <div
          className="rounded-2xl p-5 sm:p-6 bg-card border border-border flex flex-col gap-4 shadow-sm"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div>
              <h2 className="text-base font-bold text-foreground">Pick up where you left off</h2>
              <p className="text-xs text-muted-foreground">Click any past research session to resume instantly</p>
            </div>
            <span className="text-xs font-mono font-bold text-accent bg-accent/15 px-2.5 py-1 rounded-full border border-accent/25">
              {sessions.length} Recent Sessions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onOpenSession?.(session.id)}
                className="group relative p-3.5 rounded-xl bg-accent/5 border border-border/50 hover:border-accent/40 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-accent/10"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0 group-hover:scale-105 transition-transform">
                    <Search size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-semibold text-foreground block truncate group-hover:text-accent transition-colors">
                      {session.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                      {relativeTime(session.updated_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-lg transition-all cursor-pointer"
                    title="Delete research session"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ArrowRight size={14} className="text-accent opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
