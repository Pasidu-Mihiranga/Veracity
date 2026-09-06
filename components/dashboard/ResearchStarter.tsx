'use client';

/**
 * The empty state of the Research tab.
 * Leads with dynamic prompts based on user preferences and recent research,
 * completely dynamic with zero hardcoded sample companies.
 */

import { useEffect, useState } from 'react';
import {
  ArrowRight, Building2, GitCompare, Radar, Search, Wand2,
} from 'lucide-react';

interface CompanyFact {
  label: string;
  what: string;
  shareNow: number;
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

const DEFAULT_EXAMPLE_PROMPTS = [
  'Compare two industry rivals side by side on pricing, product, and strategy.',
  'Analyze a target company’s current enterprise packaging and pricing tiers.',
  'What recent product and positioning shifts have occurred in my market?',
  'Conduct a competitive gap analysis to find unserved market opportunities.',
];

/** The three core questions users arrive with. */
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

function rise(index: number): React.CSSProperties {
  return {
    animation: 'starter-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
    animationDelay: `${index * 55}ms`,
  };
}

export function ResearchStarter({ onAsk, onTrackNew }: ResearchStarterProps) {
  const [groups, setGroups] = useState<MarketGroup[]>([]);
  const [recent, setRecent] = useState<RecentMove[]>([]);
  const [examplePrompts, setExamplePrompts] = useState<string[]>(DEFAULT_EXAMPLE_PROMPTS);
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
        if (Array.isArray(data?.examplePrompts) && data.examplePrompts.length > 0) {
          setExamplePrompts(data.examplePrompts);
        }
      })
      .catch(() => {
        setGroups([]);
        setRecent([]);
      });
  }, []);

  const [customInputA, setCustomInputA] = useState('');
  const [customInputB, setCustomInputB] = useState('');

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
    const targetA = picked[0] || customInputA.trim();
    const targetB = picked[1] || customInputB.trim();

    if (chosen.id === 'market') {
      const market = markets.find(([id]) => id === picked[0])?.[1] || targetA;
      if (market) onAsk(chosen.build('', '', market));
    } else if (chosen.id === 'compare') {
      if (targetA && targetB) onAsk(chosen.build(targetA, targetB));
    } else {
      if (targetA) onAsk(chosen.build(targetA));
    }
    setIntent(null);
    setPicked([]);
    setCustomInputA('');
    setCustomInputB('');
  }

  const canSend = chosen && (
    picked.length === needs ||
    (chosen.id === 'compare' && customInputA.trim() && customInputB.trim()) ||
    (chosen.id !== 'compare' && (picked.length > 0 || customInputA.trim()))
  );

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

      {/* What this is, in one sentence */}
      <div data-starter style={rise(0)} className="veracity-card p-5 sm:p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/robot.avif"
            alt="Robot"
            width={32}
            height={34}
            className="brand-mascot h-8 w-auto shrink-0 object-contain drop-shadow-sm"
            draggable={false}
          />
          <h2 className="text-lg font-semibold text-foreground">What do you want to research?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          We read companies&apos; own pages — pricing, product notes, announcements, and executive moves — keep watching, and tell you what changed with grounded citations.
        </p>
      </div>

      {/* Pick the shape of the question */}
      <div className="grid gap-3 sm:grid-cols-3">
        {INTENTS.map((option, i) => {
          const Icon = option.icon;
          const active = intent === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setIntent(active ? null : option.id);
                setPicked([]);
              }}
              data-starter
              style={rise(i + 1)}
              className={`veracity-card p-4 text-left transition-all flex flex-col justify-between gap-3 ${
                active
                  ? 'ring-2 ring-accent border-accent/40 shadow-md'
                  : 'hover:border-accent/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-xl ${
                    active
                      ? 'bg-accent text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon size={16} />
                </span>
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  {option.id === 'compare' ? '2 companies' : '1 entity'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{option.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {option.detail}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Target selector when an intent is selected and companies exist */}
      {chosen && (
        <div data-starter style={rise(4)} className="veracity-card p-5 flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {chosen.id === 'compare'
                  ? `Pick two targets (${picked.length}/2)`
                  : chosen.id === 'market'
                  ? 'Pick a project or market'
                  : 'Pick a target company'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {chosen.id === 'market'
                  ? 'Choose a market project you track.'
                  : 'Select from your tracked targets or type below.'}
              </p>
            </div>
            {picked.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {companies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chosen.id === 'market'
                ? markets.map(([id, label]) => {
                    const isPicked = picked.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => choose(id)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                          isPicked
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-card border-border text-foreground hover:border-accent/40'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })
                : companies.map((c) => {
                    const isPicked = picked.includes(c.label);
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => choose(c.label)}
                        onMouseEnter={() => setHovered(c.label)}
                        onMouseLeave={() => setHovered(null)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                          isPicked
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-card border-border text-foreground hover:border-accent/40'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {chosen.id === 'compare' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="First company (e.g. Linear)"
                    value={customInputA}
                    onChange={(e) => setCustomInputA(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && customInputA.trim() && customInputB.trim() && send()}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="Second company (e.g. Jira)"
                    value={customInputB}
                    onChange={(e) => setCustomInputB(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && customInputA.trim() && customInputB.trim() && send()}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder={chosen.id === 'market' ? 'Enter market name (e.g. B2B Sales AI)' : 'Enter company name (e.g. Snowflake)'}
                    value={customInputA}
                    onChange={(e) => setCustomInputA(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && customInputA.trim() && send()}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              )}
            </div>
          )}

          {hovered && factFor(hovered) && (
            <p className="text-xs text-muted-foreground italic">
              {factFor(hovered)!.what}
            </p>
          )}

          {canSend && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-foreground font-mono truncate mr-2">
                {chosen.id === 'compare'
                  ? `Ready: ${picked[0] || customInputA} vs ${picked[1] || customInputB}`
                  : `Target: ${picked[0] || customInputA}`}
              </span>
              <button
                type="button"
                onClick={send}
                className="bg-accent text-white rounded-xl py-2 px-4 text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                Run Research <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Recent Events (rendered ONLY if real 2-day events exist) */}
      {recent.length > 0 && (
        <div data-starter style={rise(4)} className="veracity-card p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Recently Observed Moves (Last 48h)</p>
            <span className="text-xs text-muted-foreground">tap to research</span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {recent.slice(0, 4).map((move) => (
              <button
                key={`${move.company}-${move.headline}`}
                type="button"
                onClick={() =>
                  onAsk(`${move.company} — ${move.headline}. What does this mean for competitive positioning?`)
                }
                className="group flex items-start gap-3 py-2.5 text-left"
              >
                <span className="mt-0.5 shrink-0 text-[11px] font-mono uppercase tracking-wider text-muted-foreground w-16">
                  {move.month}
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

      {/* Dynamic Suggested Questions based on User Memory & Search History */}
      <div data-starter style={rise(5)} className="veracity-card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-accent" />
          <p className="text-sm font-medium text-foreground">Suggested Research Prompts</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Tailored to your tracked targets and growth questions:
        </p>
        <div className="flex flex-col gap-2">
          {examplePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onAsk(prompt)}
              className="group flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-left text-sm text-foreground hover:border-accent/40 transition-colors"
            >
              <span className="flex-1 text-xs sm:text-sm">{prompt}</span>
              <ArrowRight
                size={13}
                className="shrink-0 text-muted-foreground group-hover:text-accent transition-colors"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Note */}
      <div
        data-starter
        style={rise(6)}
        className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search size={13} />
          Type any company, competitor, or pricing question in the input box below.
        </p>
        <button
          type="button"
          onClick={onTrackNew}
          className="self-start text-xs text-accent hover:underline"
        >
          Track a new company
        </button>
      </div>
    </div>
  );
}
