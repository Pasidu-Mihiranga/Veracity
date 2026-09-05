'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Plus, RefreshCw, Circle, AlertCircle, Check,
  Search, Sparkles, TrendingUp, Play, Trash2, Globe, ShieldCheck,
  Zap, DollarSign, Rocket, Target, Building2, History, type LucideIcon
} from 'lucide-react';
import { listMarketProjects, type MarketProject } from '@/lib/projects';
import { importanceOf } from '@/lib/ux/vocabulary';
import { CoverageBar } from '@/components/dashboard/HomeCharts';
import { HomeInsightCharts } from '@/components/dashboard/HomeInsightCharts';
import { IntelligenceStories } from '@/components/dashboard/IntelligenceStories';
import { MarketExplorer } from '@/components/dashboard/MarketExplorer';

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
  /** Put a question into the conversation. The only path here that costs. */
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

/*
  A section label that names the block that follows it. Static — it scrolls with
  its section rather than pinning, so it never overlaps the cards beneath it.
*/
function SectionHeader({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon size={15} className="text-accent shrink-0" />
      <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">{title}</h2>
      {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
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
          /*
            A project that no longer exists is not an error to report — it is a
            row that should not be on screen. This happens whenever the list was
            fetched before something was deleted elsewhere: the page kept
            rendering the stale row and showed a 404 against it forever.

            Returning null drops it from the feed instead.
          */
          if (response.status === 404) {
            setFeeds((prev) => (prev ?? []).filter((feed) => feed.project.id !== project.id));
            return;
          }
          if (!response.ok) {
            // The raw response body is JSON meant for a developer. Keep it in
            // the console, where it is useful, and tell the reader what it
            // means for them.
            const body = await response.text().catch(() => '');
            console.error(`dashboard ${project.id} failed: ${response.status} ${body}`);
            throw new Error(
              response.status >= 500
                ? 'the server had a problem'
                : `we could not load it (${response.status})`,
            );
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

  /*
    The page used to return nothing but two skeleton bars until the project list
    arrived, so a slow response blanked the search box, the entry cards and the
    recent conversations — none of which depend on that request. One pending
    fetch should cost you one pending section, not the screen.

    `loading` is now handled where the project rows render, further down.
  */
  const loadingProjects = feeds === null;
  const feedList = feeds ?? [];

  const totalChanges = feedList.reduce((sum, feed) => sum + feed.itemCount, 0);
  const stillLoading = feedList.some((feed) => !feed.loaded);
  const totalSources = feedList.reduce((sum, feed) => sum + feed.sourcesChecked, 0);
  const totalStale = feedList.reduce((sum, feed) => sum + feed.staleCount, 0);

  const filteredFeeds = feedList.filter((feed) => {
    if (activeFilter === 'changes') return feed.itemCount > 0;
    if (activeFilter === 'stale') return feed.staleCount > 0 || !feed.ok;
    return true;
  });

  const DEMO_STARTER_PROMPTS = [
    { label: 'Compare Dialog Axiata and SLT-Mobitel. Who is winning?', icon: Zap },
    { label: 'What has PickMe done lately, and how did Uber respond?', icon: Rocket },
    { label: 'Which tea exporter is ready for the new EU rules?', icon: Target },
    { label: 'Where is the telecom market heading?', icon: DollarSign },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 0. Personalised, AI-generated intelligence stories — Home only */}
      <IntelligenceStories onAsk={(query) => onLaunchQuery?.(query)} />

      {/* 1. Quick Interactive Executive Intelligence Search Box */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm relative overflow-hidden"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/robot.avif"
              alt="Robot"
              width={32}
              height={34}
              className="brand-mascot h-8 w-auto shrink-0 object-contain drop-shadow-sm"
              draggable={false}
            />
            <div>
              <h2 className="text-base font-bold text-foreground">Ask about your market</h2>
              <p className="text-xs text-muted-foreground">Name a company or a market and say what you want to decide</p>
            </div>
          </div>
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
                className="px-3 py-1.5 rounded-xl border border-border hover:border-accent/40 text-xs text-foreground font-medium transition-colors cursor-pointer flex items-center gap-1.5"
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
            {loadingProjects
              ? 'Loading the companies you track…'
              : `Across ${feedList.length} tracked ${feedList.length === 1 ? 'company' : 'companies'}. ` +
                'We checked every source and compared it against what we already had.'}
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
            className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors cursor-pointer"
          >
            <Plus size={13} /> Track another
          </button>
        </div>
      </div>



      {/* 3. Market at a glance — KPI strip + momentum + share of voice */}
      <HomeInsightCharts />

      {/*
        The front door into a market. Everything behind these cards is
        already-collected data; only a follow-up costs anything.
      */}
      <MarketExplorer onAsk={(question) => onLaunchQuery?.(question)} />

      {/* 4. Interactive Project Cards List */}
      <section className="relative flex flex-col gap-5">
        <SectionHeader
          icon={Building2}
          title="Companies you're tracking"
          hint={loadingProjects ? undefined : `${feedList.length} tracked · what changed while you were away`}
        />
      {loadingProjects && [0, 1].map((i) => (
        <div key={`skeleton-${i}`} className="veracity-card p-5 sm:p-6 flex flex-col gap-3">
          <div className="h-4 w-1/3 rounded skeleton" />
          <div className="h-3 w-2/3 rounded skeleton" />
        </div>
      ))}

      {!loadingProjects && filteredFeeds.length === 0 && (
        <div
          className="rounded-2xl p-6 sm:p-8 bg-card border border-border shadow-sm flex flex-col items-center justify-center text-center gap-3"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">No tracked companies yet</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Start monitoring your primary product and rivals. We check competitor websites and pricing changes daily and notify you when shifts happen.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartTracking}
            className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} /> Track your first company
          </button>
        </div>
      )}

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
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border px-2 py-0.5 rounded">
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
                className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 font-medium transition-colors cursor-pointer flex items-center gap-1"
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
            <div className="h-3 w-1/3 rounded skeleton" />
          ) : !feed.ok ? (
            <p className="flex items-start gap-2 text-xs text-[var(--evidence-unsupported)]">
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span>
                We could not load this company&apos;s history — {feed.error}.
                {' '}
                <button
                  type="button"
                  onClick={() => void load()}
                  className="underline hover:no-underline"
                >
                  Try again
                </button>
              </span>
            </p>
          ) : feed.itemCount === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check size={15} className="text-[var(--evidence-measured)] shrink-0" />
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
      </section>

      {/* 5. Interactive "Pick up where you left off" Recent Sessions Card */}
      {sessions.length > 0 && (
        <section className="relative flex flex-col gap-4">
        <SectionHeader icon={History} title="Pick up where you left off" hint={`${sessions.length} recent sessions`} />
        <div
          className="rounded-2xl p-5 sm:p-6 bg-card border border-border flex flex-col gap-4 shadow-sm"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <p className="text-xs text-muted-foreground">Click any past research session to resume instantly</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onOpenSession?.(session.id)}
                className="group relative p-3.5 rounded-xl border border-border hover:border-accent/40 flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-[var(--evidence-unsupported)] rounded-lg transition-colors cursor-pointer"
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
        </section>
      )}
    </div>
  );
}
