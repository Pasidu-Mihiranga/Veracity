'use client';

/**
 * The empty state of the Research tab.
 *
 * It used to open on a three-field form headed "Compare companies" — name them,
 * give a website, add anyone else, press Start tracking. That asks someone to
 * structure a question before they know what they want to ask, and it says
 * nothing about what the product will do with it. On a chat surface it reads as
 * a signup step standing between you and the thing you came for.
 *
 * So this leads with what happens ("we read their pages and tell you what
 * changed, with the sentence behind every number"), offers the three questions
 * people actually arrive with, and shows the companies we already watch as
 * chips — tap one and the question writes itself. Typing is still there for
 * anyone who wants it, and the original form is one quiet link away for the
 * case it was built for: adding a company we do not follow yet.
 */

import { useEffect, useState } from 'react';
import {
  ArrowRight, Building2, GitCompare, Radar, Search, Sparkles, Wand2,
} from 'lucide-react';

interface CompanyFact {
  label: string;
  what: string;
  shareNow: number;
  /** Points gained or lost since the window opened. */
  shareMove: number;
  lastMove: string | null;
}

interface MarketGroup {
  id: string;
  label: string;
  geography: string;
  companies: CompanyFact[];
}

interface RecentMove {
  month: string;
  company: string;
  kind: string;
  headline: string;
  soWhat: string;
  market: string;
  marketId: string;
}

interface ResearchStarterProps {
  /** Send a question into the conversation. */
  onAsk: (question: string) => void;
  /** Open the original tracking form, for a company we do not hold. */
  onTrackNew: () => void;
}

/**
 * Prompts that show the shape of a good question.
 *
 * Not a feature list — four sentences someone could have typed themselves.
 * People copy the pattern far more readily than they follow instructions about
 * it, so the guidance is the examples, and each one is one tap from running.
 */
const EXAMPLE_PROMPTS = [
  'Compare Dialog Axiata and SLT-Mobitel. Who is winning and why?',
  'What has PickMe done in the last six months, and how did Uber respond?',
  'Which tea exporter is best placed for the new EU rules?',
  'Where is the ride-hailing market heading, and what would change that?',
];

/** The three questions people actually arrive with. */
const INTENTS = [
  {
    id: 'compare',
    icon: GitCompare,
    title: 'Compare two companies',
    detail: 'Side by side on price, product, people and what they just did',
    build: (a: string, b: string) => `Compare ${a} and ${b}. Where does each one win?`,
  },
  {
    id: 'company',
    icon: Building2,
    title: 'Look into one company',
    detail: 'What they have been doing, and what it means for you',
    build: (a: string) => `What has ${a} been doing, and what does it mean for their rivals?`,
  },
  {
    id: 'market',
    icon: Radar,
    title: 'See a whole market',
    detail: 'Who holds it, which way it is moving, what is coming',
    build: (_a: string, _b: string, market?: string) =>
      `How does the ${market ?? 'market'} look right now, and where is it heading?`,
  },
] as const;

type IntentId = (typeof INTENTS)[number]['id'];

/**
 * Entrance motion.
 *
 * Deliberately small: a short rise and fade, staggered by position, once. It
 * gives the panel a sense of being assembled for you rather than sitting there
 * waiting, and it stops well short of anything that would delay a person who
 * already knows what they want to click.
 */
function rise(index: number): React.CSSProperties {
  return {
    animation: 'starter-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
    animationDelay: `${index * 55}ms`,
  };
}

export function ResearchStarter({ onAsk, onTrackNew }: ResearchStarterProps) {
  const [groups, setGroups] = useState<MarketGroup[]>([]);
  const [recent, setRecent] = useState<RecentMove[]>([]);
  const [intent, setIntent] = useState<IntentId | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/market/highlights', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const data = payload?.data ?? payload;
        setGroups(data?.markets ?? []);
        setRecent(data?.recent ?? []);
      })
      .catch(() => setGroups([]));
  }, []);

  const chosen = INTENTS.find((i) => i.id === intent);
  const needs = intent === 'compare' ? 2 : 1;
  const companies = groups.flatMap((group) => group.companies);
  const markets: Array<[string, string]> = groups.map((group) => [group.id, group.label]);
  const factFor = (label: string) => companies.find((c) => c.label === label);

  function choose(name: string) {
    setPicked((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      const next = [...prev, name];
      return next.slice(-needs);
    });
  }

  function send() {
    if (!chosen) return;
    if (chosen.id === 'market') {
      const market = markets.find(([id]) => id === picked[0])?.[1];
      onAsk(chosen.build('', '', market));
    } else {
      onAsk(chosen.build(picked[0], picked[1] ?? ''));
    }
    setIntent(null);
    setPicked([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes starter-rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-starter] { animation: none !important; }
        }
      `}</style>

      {/* What this is, in one sentence, before anything is asked of you. */}
      <div data-starter style={rise(0)} className="veracity-card p-5 sm:p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Sparkles size={15} />
          </span>
          <h2 className="text-lg font-semibold text-foreground">What do you want to know?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          We read companies&apos; own pages — prices, product notes, announcements,
          who runs them — keep watching, and tell you what changed. Every number
          comes with the sentence it came from.
        </p>
      </div>

      {/* Pick the shape of the question first. Three, because a longer list is
          a menu to read rather than a decision to make. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {INTENTS.map((option, i) => {
          const Icon = option.icon;
          const active = intent === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-starter
              style={rise(i + 1)}
              onClick={() => {
                setIntent(active ? null : option.id);
                setPicked([]);
              }}
              className={`veracity-card p-4 text-left flex flex-col gap-2 transition-colors ${
                active ? 'border-accent bg-accent/5' : 'hover:border-accent/40'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                active ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
              }`}>
                <Icon size={15} />
              </span>
              <span className="text-sm font-medium text-foreground">{option.title}</span>
              <span className="text-xs text-muted-foreground">{option.detail}</span>
            </button>
          );
        })}
      </div>

      {/* Then say who. The chips are the answer sheet — nobody has to know how
          to spell a company name or guess whether we follow it. */}
      {chosen && (
        <div data-starter style={rise(0)} className="veracity-card p-5 flex flex-col gap-3">
          <p className="text-sm text-foreground">
            {chosen.id === 'market'
              ? 'Which market?'
              : chosen.id === 'compare'
                ? 'Which two?'
                : 'Which company?'}
          </p>

          {/* An empty chip row with no explanation reads as a broken screen.
              If the list did not load, say so and point at the thing that
              always works — typing. */}
          {companies.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              We could not load the list of companies just now. Type the names
              in the box below instead — that works either way.
            </p>
          ) : chosen.id === 'market' ? (
            <div className="flex flex-wrap gap-2">
              {markets.map(([id, label]) => {
                const selected = picked.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => choose(id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:-translate-y-px ${
                      selected
                        ? 'bg-accent text-white border-accent'
                        : 'border-border text-foreground hover:border-accent/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            /*
              Grouped by market, because fifteen names in one row is a list to
              read rather than a choice to make — and because who a company
              competes with is the most useful thing to know while picking.

              Each chip carries its current share and which way it has moved, so
              the row answers "who is worth asking about?" before anything is
              clicked.
            */
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <div key={group.id} className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.companies.map((company) => {
                      const selected = picked.includes(company.label);
                      return (
                        <button
                          key={company.label}
                          type="button"
                          onClick={() => choose(company.label)}
                          onMouseEnter={() => setHovered(company.label)}
                          onMouseLeave={() => setHovered(null)}
                          className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all hover:-translate-y-px ${
                            selected
                              ? 'bg-accent text-white border-accent'
                              : 'border-border text-foreground hover:border-accent/40'
                          }`}
                        >
                          {company.label}
                          <span className={`tabular-nums ${selected ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {company.shareNow}%
                          </span>
                          {company.shareMove !== 0 && (
                            <span
                              className={
                                selected
                                  ? 'text-white/70'
                                  : company.shareMove > 0
                                    ? 'status-good'
                                    : 'status-bad'
                              }
                            >
                              {company.shareMove > 0 ? '↑' : '↓'}
                              {Math.abs(company.shareMove)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* What the chip under the cursor is, before committing to it. */}
              <p className="min-h-[18px] text-xs text-muted-foreground">
                {hovered && factFor(hovered)
                  ? `${hovered} — ${factFor(hovered)!.what}${
                      factFor(hovered)!.lastMove ? `. Latest: ${factFor(hovered)!.lastMove}` : ''
                    }`
                  : ''}
              </p>
            </div>
          )}

          {/* The question builds as you pick, so the panel reads as one
              sentence being assembled rather than a form being validated. The
              placeholder slots show what is still missing. */}
          {picked.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {chosen.id === 'compare' ? (
                <>
                  Compare{' '}
                  <span className="text-foreground font-medium">{picked[0]}</span>
                  {' and '}
                  {picked[1] ? (
                    <span className="text-foreground font-medium">{picked[1]}</span>
                  ) : (
                    <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                      pick one more
                    </span>
                  )}
                </>
              ) : null}
            </p>
          )}

          {picked.length >= needs && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-muted-foreground italic">
                “{chosen.id === 'market'
                  ? chosen.build('', '', markets.find(([id]) => id === picked[0])?.[1])
                  : chosen.build(picked[0], picked[1] ?? '')}”
              </p>
              <button
                type="button"
                onClick={send}
                className="bg-gradient-signature text-white rounded-xl py-2.5 px-4 text-sm font-medium flex items-center justify-center gap-2 shrink-0"
              >
                Ask this <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/*
        Proof that something is being watched.

        A first-time visitor has no reason to believe a monitoring product is
        monitoring anything. These are real moves we recorded, newest first, and
        each one is a question waiting to be asked — which is also the fastest
        way to show what the product is for.
      */}
      {recent.length > 0 && (
        <div data-starter style={rise(4)} className="veracity-card p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Recently, in markets we watch</p>
            <span className="text-xs text-muted-foreground">tap to ask about one</span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {recent.slice(0, 4).map((move) => (
              <button
                key={`${move.month}-${move.headline}`}
                type="button"
                onClick={() =>
                  onAsk(`${move.company} — ${move.headline}. What does this mean for their competitors?`)
                }
                className="group flex items-start gap-3 py-2.5 text-left"
              >
                <span className="mt-0.5 shrink-0 text-[11px] font-mono uppercase tracking-wider text-muted-foreground w-16">
                  {new Date(`${move.month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
                    month: 'short', year: '2-digit', timeZone: 'UTC',
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">
                    <span className="font-medium">{move.company}</span> — {move.headline}
                  </span>
                  <span className="block text-xs text-muted-foreground">{move.soWhat}</span>
                </span>
                <ArrowRight
                  size={13}
                  className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What a good question looks like. Shown rather than explained. */}
      <div data-starter style={rise(5)} className="veracity-card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-accent" />
          <p className="text-sm font-medium text-foreground">Or ask it in your own words</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Name the companies or the market, and say what you want to decide.
          Questions like these work well:
        </p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onAsk(prompt)}
              className="group flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm text-foreground hover:border-accent/40 transition-colors"
            >
              <span className="flex-1">{prompt}</span>
              <ArrowRight
                size={13}
                className="shrink-0 text-muted-foreground group-hover:text-accent transition-colors"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Typing was always allowed; it just was not obvious next to a form. */}
      <div
        data-starter
        style={rise(6)}
        className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search size={13} />
          Or type your own question in the box below — plain English is fine.
        </p>
        <button
          type="button"
          onClick={onTrackNew}
          className="self-start text-xs text-accent hover:underline"
        >
          Track a company we don&apos;t follow yet
        </button>
      </div>
    </div>
  );
}
