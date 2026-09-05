'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Target,
  Calendar,
  Layers,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Zap,
  Wand2,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import type { GrowthPlaybookResult, SuggestedLeader } from '@/app/api/steal-strategy/route';

const STAGES = [
  'Just Getting Started / Idea (1-3 people)',
  'Early Stage / Small Team (1-10 people)',
  'Growing Business (11-50 people)',
  'Established Company (50+ people)',
];

const GOALS = [
  'Get First 100 Paying Customers',
  'Turn Free Users into Paying Customers',
  'Sell to Larger Businesses & Companies',
  'Get More Word-of-Mouth Referrals',
  'Increase Prices & Average Order Value',
];

const CATEGORIES = [
  'Software & Apps (SaaS)',
  'AI Tools & Automation',
  'Online Store & E-Commerce',
  'Finance & Payment Services',
  'Healthcare & Medical Software',
  'Education & Online Courses',
  'Real Estate & Property Tech',
  'Logistics & Delivery Services',
  'Consulting & Agency Services',
  'Other / Custom Field',
];

export function StealStrategyPanel() {
  const { text, textMuted } = useTheme();
  const [company, setCompany] = useState('Stripe');
  const [market, setMarket] = useState('Software & Apps (SaaS)');
  const [customMarket, setCustomMarket] = useState('');
  const [stage, setStage] = useState(STAGES[1]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [customContext, setCustomContext] = useState('');
  
  const [suggestedLeaders, setSuggestedLeaders] = useState<SuggestedLeader[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correctionSuggestion, setCorrectionSuggestion] = useState<string | null>(null);
  const [data, setData] = useState<GrowthPlaybookResult | null>(null);

  const effectiveMarket = market === 'Other / Custom Field' && customMarket.trim() ? customMarket.trim() : market;

  // Dynamically fetch top benchmark leaders for the active category
  const fetchLeadersForCategory = useCallback(async (categoryName: string, autoSelectFirst = false) => {
    setLoadingLeaders(true);
    try {
      const res = await fetch('/api/steal-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'suggest_leaders',
          market: categoryName,
          goal,
          productDescription: customContext || undefined,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j.leaders) && j.leaders.length > 0) {
          setSuggestedLeaders(j.leaders);
          if (autoSelectFirst || !company || company === 'Stripe') {
            setCompany(j.leaders[0].name);
          }
        }
      }
    } catch {
      // ignore, fallback gracefully
    } finally {
      setLoadingLeaders(false);
    }
  }, [goal, customContext, company]);

  useEffect(() => {
    void fetchLeadersForCategory(effectiveMarket, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  const handleMarketChange = (newMarket: string) => {
    setMarket(newMarket);
    if (newMarket !== 'Other / Custom Field') {
      void fetchLeadersForCategory(newMarket, true);
    } else {
      setCompany('');
      setSuggestedLeaders([]);
    }
  };

  const run = async (overrideCompany?: string) => {
    const targetCompany = (overrideCompany || company).trim();
    if (!targetCompany) return;
    setLoading(true);
    setError(null);
    setCorrectionSuggestion(null);
    setData(null);
    try {
      const res = await fetch('/api/steal-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate_roadmap',
          company: targetCompany,
          market: effectiveMarket,
          stage: stage.trim(),
          goal: goal.trim(),
          customContext: customContext.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? 'Failed to generate growth plan');
        if (j.correctionSuggestion) {
          setCorrectionSuggestion(j.correctionSuggestion);
        }
        return;
      }
      setData(j as GrowthPlaybookResult);
    } catch {
      setError('Network connection error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
          <Zap size={14} /> Growth Playbook
        </div>
        <h2 className="ui-heading text-2xl sm:text-3xl font-bold" style={{ color: text }}>
          Learn from Winning Companies
        </h2>
        <p className="ui-body mt-2.5 text-sm sm:text-base leading-relaxed" style={{ color: textMuted }}>
          Discover how successful leaders grew and gained loyal customers. Get an easy, step-by-step roadmap tailored to your current team size and goals.
        </p>
      </div>

      {/* Input Form Card */}
      <div className="veracity-card p-6 sm:p-8 flex flex-col gap-6 shadow-sm border border-border/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Industry / Category */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground mb-1.5">
              1. Your Industry / Field *
            </label>
            <div className="relative">
              <select
                value={market}
                onChange={(e) => handleMarketChange(e.target.value)}
                className="neu-input w-full h-11 pl-3.5 pr-10 text-xs sm:text-sm rounded-xl bg-card text-foreground appearance-none cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Company Stage */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground mb-1.5">
              2. Your Current Team Size
            </label>
            <div className="relative">
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="neu-input w-full h-11 pl-3.5 pr-10 text-xs sm:text-sm rounded-xl bg-card text-foreground appearance-none cursor-pointer"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Primary Goal */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground mb-1.5">
              3. Main Goal Right Now
            </label>
            <div className="relative">
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="neu-input w-full h-11 pl-3.5 pr-10 text-xs sm:text-sm rounded-xl bg-card text-foreground appearance-none cursor-pointer"
              >
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {market === 'Other / Custom Field' && (
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground mb-1.5">
              Type Your Specific Business Type *
            </label>
            <div className="flex gap-2">
              <input
                value={customMarket}
                onChange={(e) => setCustomMarket(e.target.value)}
                placeholder="e.g. Online language tutoring, Organic pet food delivery"
                className="neu-input flex-1 h-11 px-3.5 text-xs sm:text-sm rounded-xl"
              />
              <button
                type="button"
                onClick={() => void fetchLeadersForCategory(customMarket)}
                disabled={!customMarket.trim() || loadingLeaders}
                className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-xl shrink-0 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingLeaders ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                Find Examples
              </button>
            </div>
          </div>
        )}

        {/* Benchmark Leader Selection & Dynamic Recommendations */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground">
              4. Successful Company to Learn From *
            </label>
            <button
              type="button"
              onClick={() => void fetchLeadersForCategory(effectiveMarket)}
              disabled={loadingLeaders}
              className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
            >
              {loadingLeaders ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Recommend Examples for {effectiveMarket.slice(0, 18)}
            </button>
          </div>

          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Stripe, Notion, Figma, Shopify, HubSpot"
            className="neu-input w-full h-11 px-4 text-sm font-medium rounded-xl"
          />

          {/* Dynamic Category Benchmark Chips */}
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Lightbulb size={11} /> Top Examples:
            </span>
            {suggestedLeaders.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setCompany(item.name)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer border ${
                  company === item.name
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-accent/40 hover:text-foreground'
                }`}
                title={item.whyModelThem}
              >
                {item.name} <span className="opacity-70 text-[10px]">({item.tagline})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Optional Custom Context */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground mb-1.5">
            More Details About Your Business (Optional)
          </label>
          <input
            value={customContext}
            onChange={(e) => setCustomContext(e.target.value)}
            placeholder="e.g. We have 30 trial users and want to launch simple pricing; looking for ideas on getting more word-of-mouth"
            className="neu-input w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl"
          />
        </div>

        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              void run();
            }}
            disabled={loading || !company.trim()}
            className="bg-gradient-signature text-white flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 shadow-md hover:opacity-95 transition-all min-w-[260px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'Creating Your Growth Plan…' : `Create My ${company || ''} Growth Plan`}
          </button>
        </div>
      </div>

      {/* Error & Typo Suggestion Box */}
      {error ? (
        <div className="veracity-card p-5 max-w-xl mx-auto bg-destructive/10 text-destructive border-destructive/20 rounded-xl flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Company name not recognized</p>
              <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
          {correctionSuggestion && (
            <div className="mt-2 pt-2 border-t border-destructive/20 flex items-center justify-between">
              <span className="text-xs text-foreground font-medium">
                Did you mean: <strong>{correctionSuggestion}</strong>?
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompany(correctionSuggestion);
                  void run(correctionSuggestion);
                }}
                className="px-3 py-1 bg-accent text-white text-xs font-medium rounded-lg hover:opacity-90"
              >
                Use {correctionSuggestion}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Generated Strategy Roadmap */}
      {data ? (
        <div className="flex flex-col gap-6 animate-fadeIn">
          {/* Executive Summary & Teardown */}
          <div className="veracity-card p-6 sm:p-8 flex flex-col gap-5 border border-accent/20 bg-gradient-to-br from-card to-accent/5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold">
                <Target size={18} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground">How {data.company || company} Succeeded</h3>
                <p className="text-xs text-muted-foreground">Key lessons and growth ideas you can apply today</p>
              </div>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-foreground/90 font-normal">
              {data.summary}
            </p>

            {/* Core Lessons Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-border">
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-[11px] font-mono uppercase font-semibold text-accent mb-1">How They Got First Customers</p>
                <p className="text-xs text-foreground font-medium">{data.leaderTeardown?.coreWedge}</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-[11px] font-mono uppercase font-semibold text-accent mb-1">Why People Chose Them</p>
                <p className="text-xs text-foreground font-medium">{data.leaderTeardown?.whyItWorked}</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-[11px] font-mono uppercase font-semibold text-accent mb-1">The Big Turning Point</p>
                <p className="text-xs text-foreground font-medium">{data.leaderTeardown?.keyMilestone}</p>
              </div>
            </div>
          </div>

          {/* Strategic Growth Levers */}
          <div className="veracity-card p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <Layers size={18} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground">Proven Growth Ideas for Your Team</h3>
                <p className="text-xs text-muted-foreground">Actionable steps designed for {stage} to reach: {goal}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.growthLevers.map((lever, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-card border border-border flex flex-col justify-between gap-4 hover:border-accent/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">{lever.leverName}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      {lever.howToApplyNow}
                    </p>
                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      <p className="text-[10px] font-mono uppercase font-semibold text-foreground/70">What to Do This Week:</p>
                      {lever.actionableTactics.map((tactic, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-xs text-foreground/80">
                          <CheckCircle2 size={12} className="text-accent shrink-0 mt-0.5" />
                          <span>{tactic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phased Execution Timeline */}
          <div className="veracity-card p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <Calendar size={18} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground">Step-by-Step Growth Timeline</h3>
                <p className="text-xs text-muted-foreground">Clear milestones from finding first customers to steady growth</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {data.executionTimeline.map((phase, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-mono text-[11px] font-bold">
                      {phase.phase} · {phase.timeframe}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-1">{phase.title}</h4>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">Main Goals</p>
                    <ul className="space-y-1">
                      {phase.objectives.map((obj, oIdx) => (
                        <li key={oIdx} className="text-xs text-foreground/85 flex items-start gap-1.5">
                          <span className="text-accent font-bold">•</span> {obj}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">Things to Deliver</p>
                    <ul className="space-y-1">
                      {phase.deliverables.map((del, dIdx) => (
                        <li key={dIdx} className="text-xs text-foreground/75 flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="text-accent shrink-0 mt-0.5" />
                          <span>{del}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Metric Targets */}
          <div className="veracity-card p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <BarChart3 size={18} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground">Key Numbers to Measure Progress</h3>
                <p className="text-xs text-muted-foreground">Helpful targets to check if your growth is on track</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {data.keyMetrics.map((km, i) => (
                <div key={i} className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono uppercase font-semibold">{km.metric}</p>
                    <p className="text-lg font-bold text-accent mt-1">{km.target}</p>
                  </div>
                  <p className="text-[11px] text-foreground/70 mt-2">{km.whyItMatters}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Best Practices / Guardrails */}
          <div className="p-4 rounded-xl bg-card border border-border flex items-start gap-3">
            <ShieldCheck size={18} className="text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Smart Tips for Success</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {data.ethicalGuardrails}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
