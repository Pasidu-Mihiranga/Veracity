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
}

interface HomeFeedProps {
  onOpenProject: (project: MarketProject) => void;
  onStartTracking: () => void;
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

export function HomeFeed({ onOpenProject, onStartTracking }: HomeFeedProps) {
  const [feeds, setFeeds] = useState<ProjectFeed[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const projects = await listMarketProjects();

      // One read per tracked company, in parallel. A company whose read fails
      // must not blank the others — a broken row is better than a broken page.
      const results = await Promise.all(
        projects.map(async (project): Promise<ProjectFeed> => {
          try {
            const response = await fetch(`/api/projects/${project.id}/dashboard`, {
              credentials: 'include',
            });
            if (!response.ok) throw new Error(String(response.status));
            const payload = await response.json();
            const digest = payload?.data?.digest ?? payload?.digest;
            const items: DigestItem[] = (digest?.sections ?? []).flatMap(
              (section: { items: DigestItem[] }) => section.items ?? [],
            );
            return {
              project,
              headline: digest?.headline ?? 'Nothing has changed yet.',
              itemCount: digest?.itemCount ?? 0,
              items: items.slice(0, 4),
              ok: true,
            };
          } catch {
            return { project, headline: '', itemCount: 0, items: [], ok: false };
          }
        }),
      );
      setFeeds(results);
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
      <div className="veracity-card p-8 sm:p-10 flex flex-col items-center text-center gap-4">
        <h2 className="text-xl font-semibold text-foreground">Nothing tracked yet</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Add a company and we start watching its pages. Next time you open
          Veracity, this screen tells you what moved.
        </p>
        <button
          type="button"
          onClick={onStartTracking}
          className="bg-gradient-signature text-white rounded-xl py-2.5 px-5 font-medium transition-transform hover:-translate-y-[1px] flex items-center gap-2"
        >
          <Plus size={15} /> Track a company
        </button>
      </div>
    );
  }

  const totalChanges = feeds.reduce((sum, feed) => sum + feed.itemCount, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {totalChanges > 0
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

          {!feed.ok ? (
            // A failed read is said plainly. Showing "nothing changed" here would
            // be a lie the user cannot detect.
            <p className="flex items-center gap-2 text-xs text-[var(--evidence-unsupported)]">
              <AlertCircle size={14} />
              We could not read this company&apos;s history just now.
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
    </div>
  );
}
