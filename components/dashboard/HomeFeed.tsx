'use client';

/**
 * The screen the product opens on.
 *
 * Veracity used to land in a chat box, which framed it as a question-answering
 * toy: you ask, you read, you leave. Nothing brought anyone back, and the work
 * that makes it worth returning to — continuous monitoring, change detection, an
 * evidence ledger that accumulates — was invisible on arrival.
 *
 * So the landing screen answers one question: **what changed while I was away?**
 * Companies you track, what moved, and what is worth acting on. Asking a question
 * is somewhere you go deliberately, not where you are dumped.
 *
 * Everything here is already-collected data. This screen never triggers research
 * and never calls a model — opening the app should not cost money.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Plus, RefreshCw, Circle, AlertCircle, Check,
} from 'lucide-react';
import { listMarketProjects, type MarketProject } from '@/lib/projects';

interface ResearchSession {
  id: string;
  title: string;
  updated_at: string;
}
import { importanceOf } from '@/lib/ux/vocabulary';

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
  /** Null when the read failed — distinct from "nothing changed". */
  ok: boolean;
  /** Why it failed, verbatim. A generic message hides the actual cause. */
  error?: string;
  /** False while this company's own read is still in flight. */
  loaded: boolean;
  /** Distinct sources we have read for this company. */
  sourcesChecked: number;
  /** Sources whose last fetch did not succeed — "we could not look". */
  staleCount: number;
}

interface HomeFeedProps {
  onOpenProject: (project: MarketProject) => void;
  onStartTracking: () => void;
  /** Reopen a past piece of research. */
  onOpenSession?: (sessionId: string) => void;
}

/**
 * One number and what it means.
 *
 * A figure with no unit and no explanation is decoration. Every tile says what
 * it counts, so nobody has to guess whether "9" is good.
 */
function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="veracity-card p-4 sm:p-5 flex flex-col gap-1">
      <p className="ui-section-label text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
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

export function HomeFeed({ onOpenProject, onStartTracking, onOpenSession }: HomeFeedProps) {
  const [feeds, setFeeds] = useState<ProjectFeed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);

  // Past research is how people navigate back to what they were doing. It was
  // only reachable from the sidebar, which is hidden outside the Research tab.
  useEffect(() => {
    fetch('/api/sessions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const rows = payload?.data?.sessions ?? payload?.sessions ?? payload?.data ?? [];
        if (Array.isArray(rows)) setSessions(rows.slice(0, 6));
      })
      .catch(() => setSessions([]));
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const projects = await listMarketProjects();

      // Paint the companies straight away. Waiting on Promise.all meant the
      // whole page sat on a skeleton until the slowest read finished, so the
      // app felt broken before it had shown anything at all.
      setFeeds(
        projects.map((project) => ({
          project, headline: '', itemCount: 0, items: [], ok: true, loaded: false,
          sourcesChecked: 0, staleCount: 0,
        })),
      );

      // Then fill each row in as its own read lands. One slow or failing
      // company degrades its own row and nothing else.
      projects.forEach(async (project) => {
        let next: ProjectFeed;
        try {
          const response = await fetch(`/api/projects/${project.id}/dashboard`, {
            credentials: 'include',
          });
          if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(
              `${response.status}${body ? ` — ${body.slice(0, 140)}` : ''}`,
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

  if (feeds === null) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="veracity-card p-6 flex flex-col gap-3">
            <div className="h-4 w-1/3 rounded skeleton" />
            <div className="h-3 w-2/3 rounded skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (feeds.length === 0) {
    return (
      <div className="veracity-card p-8 sm:p-12 flex flex-col items-center text-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">Nothing tracked yet</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
          Add a company and we start watching its pages. Next time you open
          Veracity, this screen tells you what moved.
        </p>
        <button
          type="button"
          onClick={onStartTracking}
          className="bg-gradient-signature text-white rounded-xl py-3 px-6 font-bold transition-transform hover:-translate-y-[1px] flex items-center gap-2 text-sm cursor-pointer shadow-md"
        >
          <Plus size={16} /> Track a company
        </button>
      </div>
    );
  }

  const totalChanges = feeds.reduce((sum, feed) => sum + feed.itemCount, 0);
  const stillLoading = feeds.some((feed) => !feed.loaded);
  const totalSources = feeds.reduce((sum, feed) => sum + feed.sourcesChecked, 0);
  const totalStale = feeds.reduce((sum, feed) => sum + feed.staleCount, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
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
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onStartTracking}
            className="flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-accent hover:bg-accent/10 transition-colors"
          >
            <Plus size={13} /> Track another
          </button>
        </div>
      </div>

      {/*
        The numbers first. The landing screen was a headline and one card, so on a
        quiet week it looked like a blank page and gave no sense that anything was
        being watched at all. These four say what the system is doing for you even
        when the answer is "nothing moved".
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Companies"
          value={String(feeds.length)}
          detail="being watched for you"
        />
        <StatTile
          label="Sources read"
          value={String(totalSources)}
          detail={totalSources === 0 ? 'no pages read yet' : 'pages we check each run'}
        />
        <StatTile
          label="Changes"
          value={String(totalChanges)}
          detail="worth your attention"
        />
        <StatTile
          label="Could not read"
          value={String(totalStale)}
          detail={totalStale === 0 ? 'every source responded' : 'sources that failed'}
        />
      </div>

      {feeds.map((feed) => (
        <div key={feed.project.id} className="veracity-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground truncate">
                {feed.project.product}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {feed.project.competitors.length > 0
                  ? `Compared against ${feed.project.competitors.join(', ')}`
                  : 'No competitors added yet'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenProject(feed.project)}
              className="flex items-center gap-1.5 text-xs text-accent hover:underline shrink-0"
            >
              Open <ArrowRight size={13} />
            </button>
          </div>

          {!feed.loaded ? (
            <div className="h-3 w-1/3 rounded skeleton" />
          ) : !feed.ok ? (
            // A failed read is said plainly, with the actual reason. "Something
            // went wrong" is unactionable and hides bugs from us as well.
            <p className="flex items-start gap-2 text-xs text-[var(--evidence-unsupported)]">
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span>Could not read this company&apos;s history — {feed.error}</span>
            </p>
          ) : feed.itemCount === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check size={15} className="text-[var(--evidence-measured)]" />
              Nothing changed. We checked and everything is where you left it.
            </p>
          ) : (
            <>
              <p className="text-sm text-foreground">{feed.headline}</p>
              <ul className="flex flex-col gap-2.5">
                {feed.items.map((item) => {
                  const importance = importanceOf(item.materiality);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5"
                    >
                      <Circle size={8} className="mt-1.5 shrink-0 fill-current text-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{item.entityLabel}</span>
                          {item.beforeValue && item.afterValue ? (
                            <> — {item.beforeValue} → {item.afterValue}</>
                          ) : (
                            <> — {item.eventType.replace(/_/g, ' ')}</>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {/* Wording comes from the shared vocabulary, so a user
                              learns each cue once. Never the raw score. */}
                          <span title={importance.meaning}>{importance.label}</span>
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
                  className="self-start text-xs text-accent hover:underline"
                >
                  {feed.itemCount - feed.items.length} more
                </button>
              )}
            </>
          )}
        </div>
      ))}

      {/*
        Past research, so the landing screen is somewhere you navigate *from*.
        This list previously existed only in the sidebar, which is hidden outside
        the Research tab — so from Home there was no way back to your own work.
      */}
      {sessions.length > 0 && (
        <div className="veracity-card p-5 sm:p-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Pick up where you left off</h2>
            <span className="text-xs text-muted-foreground">{sessions.length} recent</span>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onOpenSession?.(session.id)}
                  className="w-full text-left py-2.5 flex items-center justify-between gap-3 group"
                >
                  <span className="text-sm text-foreground truncate group-hover:text-accent transition-colors">
                    {session.title}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {relativeTime(session.updated_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
