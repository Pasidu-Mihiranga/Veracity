'use client';

/**
 * The way into the product, without a form.
 *
 * Tracking a company used to mean filling in three fields before you knew what
 * you wanted — a form asks for structured input at the exact moment a person is
 * still deciding what to ask. This is the other pattern: you tap the thing you
 * want to do, and the assistant asks the one question it needs, in words, with
 * the answers already on screen as chips.
 *
 * Everything rendered here is already-collected data. Choosing a market or
 * comparing two companies costs nothing and calls no model; only tapping a
 * follow-up sends you into research, which is the point at which a person has
 * decided the question is worth it.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, GitCompare, Gavel, Loader2,
  Plus, Radar, Sparkles,
} from 'lucide-react';
import {
  ActivityByCompany, ComparisonTable, DecisionTimeline, MarketShareDonut, ShareTrend,
} from '@/components/artifacts/MarketCharts';

interface CompanyIndexEntry {
  label: string;
  what: string;
  domainId: string;
  domainLabel: string;
}

interface DomainIndexEntry {
  id: string;
  label: string;
  home: string;
  geography: string;
  companies: Array<{ label: string; what: string }>;
}

interface Briefing {
  domainId: string;
  label: string;
  geography: string;
  home: string;
  readOut: string;
  months: string[];
  companies: Array<{
    label: string; what: string; homeUrl: string; share: number[];
    shareNow: number; shareMove: number; moveCount: number;
    scale: { label: string; value: string };
    strengths: string[]; watchOuts: string[];
  }>;
  shareNow: Array<{ label: string; value: number }>;
  projection: { months: string[]; byCompany: Record<string, number[]>; method: string };
  timeline: Array<{
    month: string; company: string; kind: string;
    headline: string; soWhat: string; sourceUrl: string;
  }>;
  regulations: Array<{
    month: string; authority: string; headline: string; soWhat: string; sourceUrl: string;
  }>;
  outlook: { call: string; because: string; breaksIf: string };
  followUps: string[];
}

interface Comparison {
  briefing: Briefing | null;
  companies: Briefing['companies'];
  sameMarket: boolean;
  unknown: string[];
  timeline: Briefing['timeline'];
  followUps: string[];
}

type View =
  | { mode: 'start' }
  | { mode: 'pick-market' }
  | { mode: 'pick-companies' }
  | { mode: 'briefing'; domainId: string }
  | { mode: 'comparison'; names: string[] };

interface MarketExplorerProps {
  /** Send a question into the conversation. This is the only path that costs. */
  onAsk: (question: string) => void;
}

async function readJson(response: Response) {
  const payload = await response.json();
  return payload?.data ?? payload;
}

/** One thing you can do, said as a thing you would say. */
function EntryCard({
  icon: Icon, title, detail, onClick,
}: {
  icon: typeof Radar;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="veracity-card veracity-card-hover p-4 text-left flex items-start gap-3 group"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{detail}</span>
      </span>
      <ArrowRight
        size={15}
        className="ml-auto mt-1 shrink-0 text-muted-foreground group-hover:text-accent transition-colors"
      />
    </button>
  );
}

/** The assistant's line, so a question reads as being asked rather than demanded. */
function AssistantAsk({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-signature text-white">
        <Sparkles size={13} />
      </span>
      <p className="text-sm text-foreground pt-1">{children}</p>
    </div>
  );
}

function Chip({
  children, onClick, selected, tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
  tone?: 'default' | 'accent';
}) {
  const base =
    'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5';
  const look = selected
    ? 'bg-accent text-white border-accent'
    : tone === 'accent'
      ? 'text-accent border-accent/25 bg-accent/5 hover:bg-accent/10'
      : 'text-foreground border-border bg-card hover:border-accent/40';
  return (
    <button type="button" onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

export function MarketExplorer({ onAsk }: MarketExplorerProps) {
  const [view, setView] = useState<View>({ mode: 'start' });
  const [domains, setDomains] = useState<DomainIndexEntry[] | null>(null);
  const [index, setIndex] = useState<CompanyIndexEntry[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/market', { credentials: 'include' }).then(readJson),
      fetch('/api/market/compare', { credentials: 'include' }).then(readJson),
    ])
      .then(([marketData, compareData]) => {
        setDomains(marketData?.domains ?? []);
        setIndex(compareData?.companies ?? []);
      })
      .catch(() => setDomains([]));
  }, []);

  const openBriefing = useCallback(async (domainId: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/market/${domainId}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`${response.status}`);
      setBriefing(await readJson(response));
      setView({ mode: 'briefing', domainId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const runComparison = useCallback(async (names: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/market/compare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: names }),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      setComparison(await readJson(response));
      setView({ mode: 'comparison', names });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const back = () => {
    setView({ mode: 'start' });
    setPicked([]);
  };

  if (domains === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="veracity-card p-4 h-20 skeleton rounded-xl" />
        ))}
      </div>
    );
  }
  if (domains.length === 0) return null;

  // ── The front door ────────────────────────────────────────────────────────

  if (view.mode === 'start') {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <EntryCard
            icon={Radar}
            title="See how a market looks"
            detail="Who holds it, which way it is going, what moved"
            onClick={() => setView({ mode: 'pick-market' })}
          />
          <EntryCard
            icon={GitCompare}
            title="Compare companies"
            detail="Two or three, side by side, on everything"
            onClick={() => setView({ mode: 'pick-companies' })}
          />
          <EntryCard
            icon={Building2}
            title="Look into one company"
            detail="What they have been doing and what it means"
            onClick={() => setView({ mode: 'pick-companies' })}
          />
        </div>
      </div>
    );
  }

  // ── Which market? ─────────────────────────────────────────────────────────

  if (view.mode === 'pick-market') {
    return (
      <div className="veracity-card p-5 flex flex-col gap-4">
        <BackRow onBack={back} />
        <AssistantAsk>Which market do you want to look at?</AssistantAsk>
        <div className="flex flex-wrap gap-2 pl-10">
          {domains.map((domain) => (
            <Chip key={domain.id} onClick={() => void openBriefing(domain.id)}>
              {domain.label}
              {busy && <Loader2 size={11} className="animate-spin" />}
            </Chip>
          ))}
        </div>
        {error && <ErrorLine detail={error} />}
      </div>
    );
  }

  // ── Which companies? ──────────────────────────────────────────────────────

  if (view.mode === 'pick-companies') {
    const grouped = domains.map((domain) => ({
      domain,
      companies: index.filter((entry) => entry.domainId === domain.id),
    }));
    return (
      <div className="veracity-card p-5 flex flex-col gap-4">
        <BackRow onBack={back} />
        <AssistantAsk>
          Which companies should I put side by side? Pick two or three.
        </AssistantAsk>
        <div className="flex flex-col gap-3 pl-10">
          {grouped.map(({ domain, companies }) => (
            <div key={domain.id} className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{domain.label}</p>
              <div className="flex flex-wrap gap-2">
                {companies.map((entry) => {
                  const selected = picked.includes(entry.label);
                  return (
                    <Chip
                      key={entry.label}
                      selected={selected}
                      onClick={() =>
                        setPicked((prev) =>
                          selected
                            ? prev.filter((name) => name !== entry.label)
                            : [...prev, entry.label],
                        )
                      }
                    >
                      {entry.label}
                      {selected && <Check size={11} />}
                    </Chip>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={picked.length === 0 || busy}
              onClick={() => void runComparison(picked)}
              className="bg-gradient-signature text-white rounded-xl py-2 px-4 text-sm font-medium disabled:opacity-40 flex items-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {picked.length <= 1 ? 'Look into it' : `Compare these ${picked.length}`}
            </button>
            <button
              type="button"
              onClick={() => onAsk('I want to track a company that is not on your list yet.')}
              className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1"
            >
              <Plus size={12} /> Someone else
            </button>
          </div>
        </div>
        {error && <ErrorLine detail={error} />}
      </div>
    );
  }

  // ── A market briefing ─────────────────────────────────────────────────────

  if (view.mode === 'briefing' && briefing) {
    return (
      <div className="flex flex-col gap-4">
        <BackRow onBack={back} label="All markets" />
        <div className="veracity-card p-5 flex flex-col gap-2">
          <p className="ui-section-label text-muted-foreground">{briefing.geography}</p>
          <h2 className="text-xl font-semibold text-foreground">{briefing.label}</h2>
          <p className="text-sm text-foreground leading-relaxed">{briefing.readOut}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <MarketShareDonut
            slices={briefing.shareNow}
            basis={`Share of the ${briefing.label.toLowerCase()} market, latest month.`}
          />
          <ActivityByCompany companies={briefing.companies} />
        </div>

        <ShareTrend
          months={briefing.months}
          companies={briefing.companies}
          projection={briefing.projection}
        />

        <ComparisonTable companies={briefing.companies} />

        <div className="grid gap-3 lg:grid-cols-2">
          <DecisionTimeline items={briefing.timeline} />
          <div className="flex flex-col gap-3">
            <Outlook outlook={briefing.outlook} />
            <Regulations items={briefing.regulations} />
          </div>
        </div>

        <FollowUps items={briefing.followUps} onAsk={onAsk} />
      </div>
    );
  }

  // ── A comparison ──────────────────────────────────────────────────────────

  if (view.mode === 'comparison' && comparison) {
    const one = comparison.companies.length === 1;
    return (
      <div className="flex flex-col gap-4">
        <BackRow onBack={back} label="Start over" />

        {comparison.unknown.length > 0 && (
          <div className="veracity-card p-4 flex items-center gap-3">
            <p className="text-sm text-foreground">
              I do not follow {comparison.unknown.join(' or ')} yet.
            </p>
            <button
              type="button"
              onClick={() => onAsk(`Start tracking ${comparison.unknown.join(' and ')}.`)}
              className="ml-auto text-xs text-accent hover:underline"
            >
              Start tracking
            </button>
          </div>
        )}

        {comparison.companies.length > 0 && (
          <>
            <ComparisonTable companies={comparison.companies} />
            {comparison.sameMarket && comparison.briefing && (
              <ShareTrend
                months={comparison.briefing.months}
                companies={comparison.companies}
                projection={comparison.briefing.projection}
              />
            )}
            {!comparison.sameMarket && !one && (
              <p className="px-1 text-xs text-muted-foreground">
                These are in different markets, so there is no shared share of
                anything to chart. Everything above still compares.
              </p>
            )}
            <DecisionTimeline items={comparison.timeline} />
            {comparison.sameMarket && comparison.briefing && (
              <Outlook outlook={comparison.briefing.outlook} />
            )}
          </>
        )}

        <FollowUps items={comparison.followUps} onAsk={onAsk} />
      </div>
    );
  }

  return null;
}

function BackRow({ onBack, label = 'Back' }: { onBack: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
    >
      <ArrowLeft size={13} /> {label}
    </button>
  );
}

function ErrorLine({ detail }: { detail: string }) {
  return (
    <p className="text-xs text-[var(--evidence-unsupported)]">
      That did not load — {detail}
    </p>
  );
}

/**
 * Where this is heading, and the thing that would prove it wrong.
 *
 * A call without a break condition is a horoscope. Stating what would change
 * our mind is what makes it usable in a decision.
 */
function Outlook({ outlook }: { outlook: Briefing['outlook'] }) {
  return (
    <div className="veracity-card p-5 flex flex-col gap-2">
      <h3 className="text-base font-semibold text-foreground">Where this is heading</h3>
      <p className="text-sm text-foreground">{outlook.call}</p>
      <p className="text-sm text-muted-foreground">Because {outlook.because}</p>
      <p className="text-sm text-muted-foreground">
        We would change our mind if {outlook.breaksIf}
      </p>
    </div>
  );
}

function Regulations({ items }: { items: Briefing['regulations'] }) {
  if (items.length === 0) return null;
  return (
    <div className="veracity-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Gavel size={14} className="text-accent" />
        <h3 className="text-base font-semibold text-foreground">Rules that affect this</h3>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((rule) => (
          <li key={rule.headline} className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">
              {new Date(`${rule.month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
                month: 'long', year: 'numeric', timeZone: 'UTC',
              })}
              {' · '}{rule.authority}
            </p>
            <p className="text-sm font-medium text-foreground">{rule.headline}</p>
            <p className="text-sm text-muted-foreground">{rule.soWhat}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The next question, offered rather than waited for. */
function FollowUps({ items, onAsk }: { items: string[]; onAsk: (q: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 px-1">
      <p className="text-xs text-muted-foreground">You could ask</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Chip key={item} tone="accent" onClick={() => onAsk(item)}>
            {item} <ArrowRight size={11} />
          </Chip>
        ))}
      </div>
    </div>
  );
}
