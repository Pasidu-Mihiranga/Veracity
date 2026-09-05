'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Target,
  Calendar,
  Layers,
  ShieldCheck,
  Zap,
  Wand2,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Check,
  FileText,
  Printer,
  Compass,
  FolderTree,
  CornerDownRight,
  GitBranch,
  Send,
  MessageSquare,
  TrendingUp,
  LayoutGrid,
  ListFilter,
  Award,
  Milestone,
  SlidersHorizontal,
  ChevronRightCircle,
  HelpCircle,
  BarChart3,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import type {
  GrowthPlaybookResult,
  SuggestedLeader,
  CompanyTimelineMilestone,
} from '@/app/api/steal-strategy/route';

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

const BADGE_COLOR_MAP: Record<string, { bg: string; text: string; border: string; circleBg: string }> = {
  orange: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', circleBg: 'bg-amber-500' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', circleBg: 'bg-amber-500' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', circleBg: 'bg-rose-500' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/30', circleBg: 'bg-pink-500' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', circleBg: 'bg-purple-500' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', circleBg: 'bg-blue-500' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30', circleBg: 'bg-cyan-500' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', circleBg: 'bg-emerald-500' },
  lime: { bg: 'bg-lime-500/10', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/30', circleBg: 'bg-lime-500' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/30', circleBg: 'bg-yellow-500' },
};

function getPhaseIcon(index: number) {
  if (index === 0) return <Compass size={18} />;
  if (index === 1) return <TrendingUp size={18} />;
  return <Award size={18} />;
}

export function StealStrategyPanel() {
  const { text, textMuted } = useTheme();

  // Generator form inputs
  const [company, setCompany] = useState('Buffer');
  const [market, setMarket] = useState('Software & Apps (SaaS)');
  const [customMarket, setCustomMarket] = useState('');
  const [stage, setStage] = useState(STAGES[0]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [customContext, setCustomContext] = useState('');

  // Suggestions & Async States
  const [suggestedLeaders, setSuggestedLeaders] = useState<SuggestedLeader[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correctionSuggestion, setCorrectionSuggestion] = useState<string | null>(null);

  // Active Plan Data
  const [data, setData] = useState<GrowthPlaybookResult | null>(null);

  // Layout View Mode: 'tree' | 'grid' | 'list'
  const [roadmapViewMode, setRoadmapViewMode] = useState<'tree' | 'grid' | 'list'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Collapsible Accordion States for Form & Generated Main Sections
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({
    overview: false,
    milestones: false,
    execution: false,
    levers: false,
    update: false,
  });

  // User input for updating the roadmap
  const [userProgressInput, setUserProgressInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const effectiveMarket =
    market === 'Other / Custom Field' && customMarket.trim() ? customMarket.trim() : market;

  // Initialize expanded nodes when new data arrives
  useEffect(() => {
    if (data?.executionTimeline) {
      const initial: Record<string, boolean> = {};
      data.executionTimeline.forEach((phase) => {
        initial[phase.id] = true;
      });
      setExpandedNodes(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  // Dynamically fetch top benchmark leaders for the active category
  const fetchLeadersForCategory = useCallback(
    async (categoryName: string, autoSelectFirst = false) => {
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
            if (autoSelectFirst || !company || company === 'Stripe' || company === 'Buffer') {
              setCompany(j.leaders[0].name);
            }
          }
        }
      } catch {
        // ignore, fallback gracefully
      } finally {
        setLoadingLeaders(false);
      }
    },
    [goal, customContext, company]
  );

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

  // Generate brand-new roadmap
  const run = async (overrideCompany?: string) => {
    const targetCompany = (overrideCompany || company).trim();
    if (!targetCompany) return;
    setLoading(true);
    setError(null);
    setCorrectionSuggestion(null);
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

      const newPlan = j as GrowthPlaybookResult;
      setData(newPlan);
      // Auto-expand all main sections for fresh results
      setSectionsCollapsed({
        overview: false,
        milestones: false,
        execution: false,
        levers: false,
        update: false,
      });
    } catch {
      setError('Network connection error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update roadmap based on user's written feedback / progress
  const adaptRoadmap = async () => {
    if (!data || !userProgressInput.trim()) return;
    setAdapting(true);
    setError(null);

    try {
      const res = await fetch('/api/steal-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'adapt_roadmap',
          company: data.company,
          market: data.market,
          stage: data.stage,
          goal: data.goal,
          customContext: customContext.trim() || undefined,
          weeklyNotes: userProgressInput.trim(),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? 'Failed to update roadmap');
        return;
      }

      const updatedPlan = j as GrowthPlaybookResult;
      setData(updatedPlan);
      setUserProgressInput('');
    } catch {
      setError('Network error while updating roadmap.');
    } finally {
      setAdapting(false);
    }
  };

  // Toggle tree node expanded/collapsed
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Expand / Collapse all nodes in tree
  const expandAllNodes = (expand: boolean) => {
    if (!data) return;
    const next: Record<string, boolean> = {};
    data.executionTimeline.forEach((p) => {
      next[p.id] = expand;
    });
    setExpandedNodes(next);
  };

  // Toggle individual main section collapse
  const toggleSection = (sectionKey: string) => {
    setSectionsCollapsed((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Expand / Collapse all main sections
  const setAllSectionsCollapsed = (collapsed: boolean) => {
    setSectionsCollapsed({
      overview: collapsed,
      milestones: collapsed,
      execution: collapsed,
      levers: collapsed,
      update: collapsed,
    });
  };

  const areAllSectionsCollapsed = Object.values(sectionsCollapsed).every(Boolean);

  // Guarantee at least 3-4 rich growth levers for rendering
  const activeGrowthLevers = (() => {
    if (!data) return [];
    const levers = [...(data.growthLevers || [])];
    if (levers.length < 3) {
      const defaultLevers = [
        {
          leverName: 'Simple & Frictionless Value Proposition',
          howToApplyNow: `Focus on the one core problem ${data.company} solved brilliantly, removing all unnecessary friction for new users.`,
          actionableTactics: [
            'Make your initial onboarding fast and simple with zero confusion.',
            'Deliver visible customer value within the first 3 minutes of use.',
            'Interview early trial users to learn exactly which feature they value most.',
          ],
        },
        {
          leverName: 'Organic Word-of-Mouth & Referral Loops',
          howToApplyNow: `Incentivize happy customers to naturally share your product with their friends and colleagues.`,
          actionableTactics: [
            'Prompt for a referral or review right after a customer reaches a positive milestone.',
            'Share transparent build-in-public updates and practical guides in your niche.',
            'Provide double-sided referral incentives (e.g. discount or perk for both parties).',
          ],
        },
        {
          leverName: 'Transparent Pricing & Value-Driven Upgrades',
          howToApplyNow: `Structure simple, clear tiers that make buying a no-brainer decision for early customers.`,
          actionableTactics: [
            'Offer a straightforward starter tier with clear feature boundaries.',
            'Align premium pricing with business growth metrics (seats, volume, or speed).',
            'Offer a money-back satisfaction guarantee to eliminate buying hesitation.',
          ],
        },
        {
          leverName: 'Customer Retention & High-Touch Care',
          howToApplyNow: `Turn early buyers into long-term champions by providing personal, exceptional service.`,
          actionableTactics: [
            'Send personal welcome emails from the founder to every new user.',
            'Proactively check in on accounts that have not been active for 7 days.',
            'Build a private feedback channel or group where early users can request features.',
          ],
        },
      ];
      for (const def of defaultLevers) {
        if (levers.length < 3) {
          levers.push(def);
        }
      }
    }
    return levers;
  })();

  // Copy plan to clipboard
  const copyPlanToClipboard = () => {
    if (!data) return;
    const lines = [
      `# ${data.company} Growth Strategy Playbook`,
      `Field: ${data.market} | Goal: ${data.goal}`,
      ``,
      `## Summary`,
      data.summary,
      ``,
      `## The Breakthrough Move`,
      data.evolutionStages?.breakthroughMove || '',
      ``,
      `## Step-by-Step Execution Roadmap`,
      ...data.executionTimeline.map((phase) => {
        return [
          `### ${phase.phase} (${phase.timeframe}): ${phase.title}`,
          `Objectives:`,
          ...(phase.objectives || []).map((o) => `  - ${o}`),
          `Deliverables:`,
          ...(phase.deliverables || []).map((d) => `  - ${d.text}`),
          `Action Steps:`,
          ...(phase.weeklyActions || []).map((w) => `  - ${w.text}`),
          ``,
        ].join('\n');
      }),
      `## Growth Recommendations`,
      ...activeGrowthLevers.map((gl) => `### ${gl.leverName}\n${gl.howToApplyNow}\n${gl.actionableTactics.map((t) => `- ${t}`).join('\n')}\n`),
    ];

    void navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Direct Vector PDF Export
  const downloadExecutivePdf = async () => {
    if (!data || exportingPdf) return;
    setExportingPdf(true);
    try {
      const [{ pdf }, { StrategyPlaybookPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/export/StrategyPlaybookPdfDocument'),
      ]);
      const blob = await pdf(<StrategyPlaybookPdfDocument data={{ ...data, growthLevers: activeGrowthLevers }} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.company.replace(/\s+/g, '_')}_Growth_Playbook_Veracity.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
          Discover how market leaders grew and won customers. Get an interactive step-by-step roadmap tailored to your team size and goals.
        </p>
      </div>

      {/* ─── INPUT FORM CARD (COLLAPSIBLE UP & DOWN) ─── */}
      <div className="veracity-card flex flex-col shadow-sm border border-border/80 transition-all overflow-hidden">
        {/* Form Collapsible Header */}
        <div
          onClick={() => setIsFormCollapsed((prev) => !prev)}
          className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-foreground">
                  Strategy Generator & Parameters
                </span>
                {isFormCollapsed && (
                  <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-secondary text-xs font-mono text-muted-foreground border border-border">
                    {effectiveMarket} · {stage.split('(')[0].trim()} · {company || 'Custom'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFormCollapsed
                  ? 'Click to expand and edit your industry, team size, goal, or benchmark company'
                  : 'Customize your target market, stage, and benchmark company'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
              {isFormCollapsed ? 'Expand' : 'Collapse'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
              {isFormCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </div>
        </div>

        {/* Collapsible Form Body */}
        {!isFormCollapsed && (
          <div className="p-6 sm:p-8 pt-2 flex flex-col gap-6 border-t border-border/50 animate-fadeIn">
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
                    className="neu-input w-full h-11 pl-3.5 pr-10 text-sm rounded-xl bg-card text-foreground appearance-none cursor-pointer"
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
                    className="neu-input w-full h-11 pl-3.5 pr-10 text-sm rounded-xl bg-card text-foreground appearance-none cursor-pointer"
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
                    className="neu-input w-full h-11 pl-3.5 pr-10 text-sm rounded-xl bg-card text-foreground appearance-none cursor-pointer"
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
                    className="neu-input flex-1 h-11 px-3.5 text-sm rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => void fetchLeadersForCategory(customMarket, true)}
                    disabled={!customMarket.trim() || loadingLeaders}
                    className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-xl shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loadingLeaders ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                    Find Examples
                  </button>
                </div>
              </div>
            )}

            {/* Benchmark Leader Selection & Recommendations */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-foreground">
                  4. Successful Company to Learn From *
                </label>
                <button
                  type="button"
                  onClick={() => void fetchLeadersForCategory(effectiveMarket, true)}
                  disabled={loadingLeaders}
                  className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                >
                  {loadingLeaders ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Recommend Examples for {effectiveMarket.slice(0, 20)}
                </button>
              </div>

              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Buffer, Stripe, Notion, Figma, Shopify, Daraz"
                className="neu-input w-full h-11 px-4 text-sm font-medium rounded-xl"
              />

              {/* Dynamic Category Benchmark Chips */}
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <Lightbulb size={13} /> Recommended:
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
                    {item.name} <span className="opacity-75">({item.tagline})</span>
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
                className="neu-input w-full h-11 px-3.5 text-sm rounded-xl"
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
        )}
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
        <div className="flex flex-col gap-6 animate-fadeIn printable-strategy-area">
          {/* Top Control Bar: Master Expand/Collapse All + Export Actions */}
          <div className="veracity-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border border-border bg-card shadow-sm rounded-2xl">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-foreground">
                {data.company} Strategic Growth Playbook
              </span>
              <span className="hidden md:inline-flex px-2 py-0.5 rounded-md bg-secondary text-xs font-mono text-muted-foreground border border-border">
                {data.stage}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Expand / Collapse All Sections */}
              <button
                type="button"
                onClick={() => setAllSectionsCollapsed(!areAllSectionsCollapsed)}
                className="px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-xs font-semibold text-foreground border border-border flex items-center gap-1.5 transition-all"
                title={areAllSectionsCollapsed ? 'Expand All Generated Sections' : 'Collapse All Generated Sections'}
              >
                {areAllSectionsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                <span>{areAllSectionsCollapsed ? 'Expand All Sections' : 'Collapse All Sections'}</span>
              </button>

              {/* Action Buttons: Export PDF, Print, Export Text */}
              <button
                type="button"
                onClick={() => void downloadExecutivePdf()}
                disabled={exportingPdf}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-95 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                title="Download High-Quality Executive PDF"
              >
                {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                <span>{exportingPdf ? 'PDF…' : 'Export PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:border-accent/40 flex items-center gap-1.5 transition-all shadow-sm"
                title="Print or Save via Browser"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                type="button"
                onClick={copyPlanToClipboard}
                className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:border-accent/40 flex items-center gap-1.5 transition-all shadow-sm"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Export Text'}</span>
              </button>
            </div>
          </div>

          {/* Progress Feedback Alert if adaptive */}
          {data.progressFeedback && (
            <div className="veracity-card p-5 bg-accent/10 border border-accent/30 rounded-2xl flex items-start gap-3">
              <Zap size={20} className="text-accent shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-foreground">Roadmap Updated with Your Input</h4>
                <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{data.progressFeedback}</p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 1: Strategy Profile & Executive Summary (Collapsible)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="veracity-card flex flex-col border border-border overflow-hidden transition-all">
            {/* Section Accordion Header */}
            <div
              onClick={() => toggleSection('overview')}
              className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Compass size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                      Section 1
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      Strategy Overview & Executive Summary
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Foundational takeaways and core strategic principles from {data.company}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                  {sectionsCollapsed.overview ? 'Expand' : 'Collapse'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                  {sectionsCollapsed.overview ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </div>
            </div>

            {/* Section Content */}
            {!sectionsCollapsed.overview && (
              <div className="p-6 sm:p-8 pt-0 flex flex-col gap-6 border-t border-border/50 animate-fadeIn mt-2 pt-6">
                {/* Profile Meta Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                    <span className="block text-xs font-mono uppercase text-muted-foreground font-semibold">Your Field</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{data.market}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                    <span className="block text-xs font-mono uppercase text-muted-foreground font-semibold">Current Stage</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{data.stage}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                    <span className="block text-xs font-mono uppercase text-muted-foreground font-semibold">Primary Goal</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{data.goal}</span>
                  </div>
                </div>

                {/* Summary Text */}
                <p className="text-sm sm:text-base leading-relaxed text-foreground font-normal">
                  {data.summary}
                </p>

                {/* Top Core Success Principle */}
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 flex items-start gap-3">
                  <ShieldCheck size={20} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider font-bold text-accent">Core Success Principle</p>
                    <p className="text-xs sm:text-sm text-foreground/90 mt-1 leading-relaxed">
                      {data.ethicalGuardrails}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 2: Chronological Evolution Milestones Timeline (Collapsible)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="veracity-card flex flex-col border border-border overflow-hidden transition-all">
            {/* Section Accordion Header */}
            <div
              onClick={() => toggleSection('milestones')}
              className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Calendar size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                      Section 2
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      History & Milestones of {data.company}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Step-by-step evolution from early launch to market leadership
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                  {sectionsCollapsed.milestones ? 'Expand' : 'Collapse'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                  {sectionsCollapsed.milestones ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </div>
            </div>

            {/* Section Content */}
            {!sectionsCollapsed.milestones && (
              <div className="p-6 sm:p-8 pt-0 flex flex-col gap-8 border-t border-border/50 animate-fadeIn mt-2 pt-6">
                {/* Visual Alternating Timeline Chart */}
                <div className="relative py-4 max-w-3xl mx-auto w-full">
                  {/* Central Vertical Dashed Line */}
                  <div className="absolute left-6 md:left-1/2 top-4 bottom-4 w-0.5 border-l-2 border-dashed border-border -translate-x-1/2 pointer-events-none" />

                  <div className="flex flex-col gap-8">
                    {(data.companyMilestones || [
                      {
                        stepNumber: 1,
                        yearOrTimeframe: 'Launch',
                        categoryTag: 'Foundation',
                        badgeColor: 'orange',
                        title: 'Foundation & Core Problem',
                        description: `The founder started ${data.company} by validating demand with a simple test before building extensive features.`,
                      },
                      {
                        stepNumber: 2,
                        yearOrTimeframe: 'Year 1',
                        categoryTag: 'First Product',
                        badgeColor: 'amber',
                        title: 'Simple Initial Offer',
                        description: 'They launched with a single clear workflow that solved one specific frustration for early adopters.',
                      },
                      {
                        stepNumber: 3,
                        yearOrTimeframe: 'Year 2–3',
                        categoryTag: 'Early Traction',
                        badgeColor: 'rose',
                        title: 'Winning First 1,000 Customers',
                        description: 'Word-of-mouth and transparent community engagement fueled steady customer growth and retention.',
                      },
                      {
                        stepNumber: 4,
                        yearOrTimeframe: 'Year 4–5',
                        categoryTag: 'Expansion',
                        badgeColor: 'purple',
                        title: 'Expanding Product Offerings',
                        description: 'Introduced higher-tier packages and additional services to increase lifetime customer value.',
                      },
                      {
                        stepNumber: 5,
                        yearOrTimeframe: 'Present',
                        categoryTag: 'Market Leader',
                        badgeColor: 'blue',
                        title: 'Industry Standard',
                        description: 'Achieved sustainable market leadership backed by long-term customer trust and brand loyalty.',
                      },
                    ]).map((milestone: CompanyTimelineMilestone, index: number) => {
                      const isLeft = index % 2 === 0;
                      const colorConfig = BADGE_COLOR_MAP[milestone.badgeColor] || BADGE_COLOR_MAP.blue;

                      return (
                        <div
                          key={index}
                          className={`relative flex items-center w-full ${
                            isLeft ? 'md:flex-row-reverse' : 'md:flex-row'
                          }`}
                        >
                          {/* Left or Right Content Card */}
                          <div className="w-full md:w-1/2 pl-14 md:pl-0 md:px-8">
                            <div
                              className={`p-5 rounded-2xl bg-card border border-border shadow-sm hover:border-accent/40 transition-all ${
                                isLeft ? 'md:text-right' : 'md:text-left'
                              }`}
                            >
                              <div
                                className={`flex items-center gap-2 mb-2 ${
                                  isLeft ? 'md:justify-end' : 'md:justify-start'
                                }`}
                              >
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${colorConfig.bg} ${colorConfig.text} border ${colorConfig.border}`}
                                >
                                  {milestone.categoryTag}
                                </span>
                                <span className="text-xs font-mono font-bold text-muted-foreground">
                                  {milestone.yearOrTimeframe}
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-foreground mb-1.5">
                                {milestone.title}
                              </h4>
                              <p className="text-sm text-foreground/85 leading-relaxed">
                                {milestone.description}
                              </p>
                            </div>
                          </div>

                          {/* Numbered Center Circle Badge */}
                          <div className="absolute left-6 md:left-1/2 -translate-x-1/2 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-card border-2 border-accent text-accent font-bold text-sm flex items-center justify-center shadow-md ring-4 ring-background">
                              {milestone.stepNumber || index + 1}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* The #1 Breakthrough Move Callout */}
                {data.evolutionStages?.breakthroughMove && (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-accent/10 via-card to-accent/5 border border-accent/30 flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Zap size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider font-bold text-accent">The #1 Breakthrough Move</p>
                      <p className="text-sm sm:text-base text-foreground font-medium mt-1 leading-relaxed">
                        {data.evolutionStages.breakthroughMove}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              SECTION 3: Step-by-Step Execution Plan (Collapsible with Views)
          ════════════════════════════════════════════════════════════════════ */}
          <div className="veracity-card flex flex-col border border-border overflow-hidden transition-all">
            {/* Section Accordion Header */}
            <div
              onClick={() => toggleSection('execution')}
              className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Milestone size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                      Section 3
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      Step-by-Step Execution Plan
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sequential phases, deliverables, and weekly tactical execution actions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* View Mode Switcher: Tree, Grid, List */}
                {!sectionsCollapsed.execution && (
                  <div className="flex items-center bg-secondary/60 rounded-xl p-1 border border-border">
                    <button
                      type="button"
                      onClick={() => setRoadmapViewMode('tree')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        roadmapViewMode === 'tree'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FolderTree size={12} />
                      <span className="hidden sm:inline">Tree Flow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoadmapViewMode('grid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        roadmapViewMode === 'grid'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <LayoutGrid size={12} />
                      <span className="hidden sm:inline">Grid View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoadmapViewMode('list')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                        roadmapViewMode === 'list'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ListFilter size={12} />
                      <span className="hidden sm:inline">List View</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleSection('execution')}
                  className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground ml-1"
                >
                  {sectionsCollapsed.execution ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
            </div>

            {/* Section Content */}
            {!sectionsCollapsed.execution && (
              <div className="p-6 sm:p-8 pt-0 flex flex-col gap-6 border-t border-border/50 animate-fadeIn mt-2 pt-6">
                {/* Sub-toolbar for Tree view expansion */}
                {roadmapViewMode !== 'grid' && (
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <span className="text-muted-foreground">Tree nodes:</span>
                    <button
                      type="button"
                      onClick={() => expandAllNodes(true)}
                      className="px-2.5 py-1 rounded-lg text-accent hover:underline font-medium"
                    >
                      Expand All
                    </button>
                    <span className="text-muted-foreground">/</span>
                    <button
                      type="button"
                      onClick={() => expandAllNodes(false)}
                      className="px-2.5 py-1 rounded-lg text-muted-foreground hover:text-foreground font-medium"
                    >
                      Collapse All
                    </button>
                  </div>
                )}

                {/* ─── 3A: TREE STRUCTURE VIEW ─── */}
                {roadmapViewMode === 'tree' && (
                  <div className="flex flex-col gap-6 pl-2 sm:pl-4">
                    {data.executionTimeline.map((phase, pIdx) => {
                      const isExpanded = expandedNodes[phase.id] ?? true;
                      const phaseIcon = getPhaseIcon(pIdx);

                      return (
                        <div key={phase.id || pIdx} className="relative">
                          {/* Root Phase Branch Node */}
                          <div
                            onClick={() => toggleNode(phase.id)}
                            className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/80 hover:border-accent/40 cursor-pointer transition-all shadow-sm"
                          >
                            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                              {phaseIcon}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 flex-1">
                              <span className="px-2.5 py-0.5 rounded-md bg-accent text-white font-mono text-xs font-bold shrink-0">
                                {phase.phase} · {phase.timeframe}
                              </span>
                              <h4 className="text-sm sm:text-base font-bold text-foreground">
                                {phase.title}
                              </h4>
                            </div>

                            <div className="text-muted-foreground pr-2">
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                          </div>

                          {/* Sub-Branches (Branching Tree Lines) */}
                          {isExpanded && (
                            <div className="ml-5 sm:ml-7 mt-2 pl-4 sm:pl-6 border-l-2 border-border/70 flex flex-col gap-4 py-2 animate-fadeIn">
                              {/* 1. Core Objectives Sub-Branch */}
                              {phase.objectives && phase.objectives.length > 0 && (
                                <div className="relative flex flex-col gap-2">
                                  <div className="absolute -left-4 sm:-left-6 top-3.5 w-3 sm:w-4 border-t-2 border-border/70" />
                                  <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold text-accent">
                                    <Target size={14} /> Core Goals & Objectives
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {phase.objectives.map((obj, oIdx) => (
                                      <div key={oIdx} className="p-3.5 rounded-xl bg-card border border-border text-sm text-foreground flex items-start gap-2.5">
                                        <CornerDownRight size={15} className="text-accent shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{obj}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 2. Key Deliverables Sub-Branch */}
                              {phase.deliverables && phase.deliverables.length > 0 && (
                                <div className="relative flex flex-col gap-2">
                                  <div className="absolute -left-4 sm:-left-6 top-3.5 w-3 sm:w-4 border-t-2 border-border/70" />
                                  <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold text-accent">
                                    <Layers size={14} /> Key Deliverables & Offers
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {phase.deliverables.map((del) => (
                                      <div key={del.id} className="p-3.5 rounded-xl bg-card border border-border text-sm text-foreground flex items-start gap-2.5">
                                        <CornerDownRight size={15} className="text-accent shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{del.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 3. Tactical Action Steps Sub-Branch */}
                              {phase.weeklyActions && phase.weeklyActions.length > 0 && (
                                <div className="relative flex flex-col gap-2">
                                  <div className="absolute -left-4 sm:-left-6 top-3.5 w-3 sm:w-4 border-t-2 border-border/70" />
                                  <div className="flex items-center gap-2 text-xs font-mono uppercase font-bold text-accent">
                                    <GitBranch size={14} /> Action Steps to Execute
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {phase.weeklyActions.map((act) => (
                                      <div key={act.id} className="p-3.5 rounded-xl bg-card border border-border text-sm text-foreground flex items-start gap-2.5">
                                        <CornerDownRight size={15} className="text-accent shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{act.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─── 3B: HORIZONTAL GRID VIEW ─── */}
                {roadmapViewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {data.executionTimeline.map((phase, pIdx) => {
                      const phaseIcon = getPhaseIcon(pIdx);

                      return (
                        <div
                          key={phase.id || pIdx}
                          className="p-5 sm:p-6 rounded-2xl bg-card border border-border flex flex-col justify-between gap-5 shadow-sm hover:border-accent/40 transition-colors"
                        >
                          <div className="space-y-4">
                            {/* Top Line */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-mono text-xs font-bold">
                                {phase.phase} · {phase.timeframe}
                              </span>
                              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-accent">
                                {phaseIcon}
                              </div>
                            </div>

                            {/* Title */}
                            <h4 className="text-base font-bold text-foreground leading-snug">
                              {phase.title}
                            </h4>

                            {/* Core Objectives */}
                            {phase.objectives && phase.objectives.length > 0 && (
                              <div className="pt-2 border-t border-border/50">
                                <p className="text-xs font-mono uppercase font-bold text-muted-foreground mb-1.5">
                                  Core Goals
                                </p>
                                <ul className="space-y-1.5">
                                  {phase.objectives.map((obj, oIdx) => (
                                    <li key={oIdx} className="text-sm text-foreground/90 flex items-start gap-2 leading-relaxed">
                                      <span className="text-accent font-bold mt-0.5">•</span>
                                      <span>{obj}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Deliverables */}
                            {phase.deliverables && phase.deliverables.length > 0 && (
                              <div className="pt-2 border-t border-border/50">
                                <p className="text-xs font-mono uppercase font-bold text-muted-foreground mb-1.5">
                                  Key Deliverables
                                </p>
                                <ul className="space-y-1.5">
                                  {phase.deliverables.map((del) => (
                                    <li key={del.id} className="text-sm text-foreground/90 flex items-start gap-2 leading-relaxed">
                                      <span className="text-accent font-bold mt-0.5">•</span>
                                      <span>{del.text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Actions */}
                            {phase.weeklyActions && phase.weeklyActions.length > 0 && (
                              <div className="pt-2 border-t border-border/50">
                                <p className="text-xs font-mono uppercase font-bold text-muted-foreground mb-1.5">
                                  Action Steps
                                </p>
                                <ul className="space-y-1.5">
                                  {phase.weeklyActions.map((act) => (
                                    <li key={act.id} className="text-sm text-foreground/90 flex items-start gap-2 leading-relaxed">
                                      <span className="text-accent font-bold mt-0.5">•</span>
                                      <span>{act.text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─── 3C: VERTICAL LIST / ACCORDION VIEW ─── */}
                {roadmapViewMode === 'list' && (
                  <div className="flex flex-col gap-4">
                    {data.executionTimeline.map((phase, pIdx) => {
                      const isExpanded = expandedNodes[phase.id] ?? true;
                      const phaseIcon = getPhaseIcon(pIdx);

                      return (
                        <div
                          key={phase.id || pIdx}
                          className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm transition-all"
                        >
                          <div
                            onClick={() => toggleNode(phase.id)}
                            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-secondary/20"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                {phaseIcon}
                              </div>
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono text-xs font-bold mr-2">
                                  {phase.phase} · {phase.timeframe}
                                </span>
                                <span className="text-base font-bold text-foreground">
                                  {phase.title}
                                </span>
                              </div>
                            </div>

                            <div className="text-muted-foreground pr-1">
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-5 pt-0 border-t border-border/40 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 pt-4">
                              {/* Core Goals */}
                              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                                <p className="text-xs font-mono uppercase font-bold text-accent mb-2">Core Goals</p>
                                <ul className="space-y-1.5">
                                  {(phase.objectives || []).map((obj, oIdx) => (
                                    <li key={oIdx} className="text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                      <span className="text-accent font-bold mt-0.5">•</span>
                                      <span>{obj}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Deliverables */}
                              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                                <p className="text-xs font-mono uppercase font-bold text-accent mb-2">Key Deliverables</p>
                                <ul className="space-y-1.5">
                                  {(phase.deliverables || []).map((del) => (
                                    <li key={del.id} className="text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                      <span className="text-accent font-bold mt-0.5">•</span>
                                      <span>{del.text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Action Steps */}
                              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                                <p className="text-xs font-mono uppercase font-bold text-accent mb-2">Action Steps</p>
                                <ul className="space-y-1.5">
                                  {(phase.weeklyActions || []).map((act) => (
                                    <li key={act.id} className="text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                      <span className="text-accent font-bold mt-0.5">•</span>
                                      <span>{act.text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 4: Key Growth Levers & Recommendation Tips (3+ Cards)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="veracity-card flex flex-col border border-border overflow-hidden transition-all">
          {/* Section Accordion Header */}
          <div
            onClick={() => toggleSection('levers')}
            className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Lightbulb size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                    Section 4
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Key Growth Levers & Recommendations from {data.company}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent font-mono text-xs font-bold">
                    {activeGrowthLevers.length} Core Levers
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  High-leverage strategic tactics and execution tips tailored to your goal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                {sectionsCollapsed.levers ? 'Expand' : 'Collapse'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                {sectionsCollapsed.levers ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </div>
          </div>

          {/* Section Content */}
          {!sectionsCollapsed.levers && (
            <div className="p-6 sm:p-8 pt-0 flex flex-col gap-6 border-t border-border/50 animate-fadeIn mt-2 pt-6">
              {/* Strategic Tips Banner */}
              <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-accent">
                    Advisor Recommendation Tips
                  </h4>
                  <p className="text-sm text-foreground/90 mt-1 leading-relaxed">
                    Pick <strong>1 to 2 levers</strong> to focus on first before expanding. Consistent execution on one high-leverage channel produces significantly better traction than spreading resources thin.
                  </p>
                </div>
              </div>

              {/* Visual Component 1: Recommended Weekly Strategy Focus & Effort Allocation Bar */}
              <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={15} className="text-accent" />
                    <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-foreground">
                      Recommended Weekly Effort Allocation
                    </h4>
                  </div>
                  <span className="text-xs text-muted-foreground">Based on your {data.stage.split('(')[0].trim()} stage</span>
                </div>

                {/* Proportional Segment Bar */}
                <div className="w-full h-3 rounded-full bg-secondary/80 overflow-hidden flex shadow-inner">
                  <div className="h-full bg-accent transition-all" style={{ width: '40%' }} title="40% Value Prop & Setup" />
                  <div className="h-full bg-blue-400 transition-all" style={{ width: '30%' }} title="30% Pricing & Monetization" />
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: '30%' }} title="30% Retention & Referral" />
                </div>

                {/* Effort Legend Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-accent shrink-0" />
                    <span className="font-bold text-foreground">40% Focus:</span>
                    <span className="text-muted-foreground truncate">Value Prop & Onboarding</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
                    <span className="font-bold text-foreground">30% Focus:</span>
                    <span className="text-muted-foreground truncate">Pricing & Conversion Tiers</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-bold text-foreground">30% Focus:</span>
                    <span className="text-muted-foreground truncate">Customer Retention & Loops</span>
                  </div>
                </div>
              </div>

              {/* 3 or More Growth Lever Cards Grid (Balanced Layout) */}
              <div
                className={`grid grid-cols-1 ${
                  activeGrowthLevers.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'
                } gap-5`}
              >
                {activeGrowthLevers.map((lever, i) => (
                  <div
                    key={i}
                    className="p-5 sm:p-6 rounded-2xl bg-card border border-border flex flex-col justify-between gap-5 hover:border-accent/40 transition-all shadow-sm hover:shadow-md group"
                  >
                    <div>
                      {/* Lever Header with High-Contrast Number Badge */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-sm ring-2 ring-accent/20">
                          {i + 1}
                        </span>
                        <h4 className="text-base font-bold text-foreground leading-snug">
                          {lever.leverName.replace(/^\d+\.\s*/, '')}
                        </h4>
                      </div>

                      {/* Explanation */}
                      <p className="text-sm text-foreground/85 leading-relaxed mb-4">
                        {lever.howToApplyNow}
                      </p>

                      {/* Actionable Tactics */}
                      <div className="space-y-2.5 pt-4 border-t border-border/70">
                        <p className="text-xs font-mono uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Check size={13} className="text-accent stroke-[2.5]" /> Practical Action Steps:
                        </p>
                        <div className="space-y-2">
                          {lever.actionableTactics.map((tactic, j) => (
                            <div key={j} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                              <span className="text-accent font-bold mt-0.5">•</span>
                              <span>{tactic}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Visual Component 2: Key Target Metrics & Velocity Gauges */}
              <div className="p-6 rounded-2xl bg-secondary/30 border border-border flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-accent">
                      Key Growth Velocity Targets
                    </h4>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      Recommended Pace to Reach: {data.goal}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-accent/10 text-accent font-mono text-xs font-bold">
                    Target Scorecard
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
                  {(data.keyMetrics || [
                    {
                      id: 'metric-1',
                      metric: 'Customer Discovery Conversations',
                      target: '20 per week',
                      whyItMatters: 'Talking directly to potential buyers teaches you what they really want.',
                    },
                    {
                      id: 'metric-2',
                      metric: 'New Paying Customers',
                      target: '5–10 per week',
                      whyItMatters: 'Proves that buyers find enough value to pay for your solution.',
                    },
                    {
                      id: 'metric-3',
                      metric: 'Organic Referrals',
                      target: '2–3 per month',
                      whyItMatters: 'Indicates high customer delight and fuels organic growth.',
                    },
                  ]).map((m, idx) => {
                    const gaugeValues = [75, 60, 50];
                    const gaugeVal = gaugeValues[idx % gaugeValues.length];

                    return (
                      <div
                        key={m.id || idx}
                        className="p-5 rounded-xl bg-card border border-border flex flex-col justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Mini SVG Gauge Ring */}
                          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <path
                                className="text-secondary stroke-current"
                                strokeWidth="3.5"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className="text-accent stroke-current"
                                strokeDasharray={`${gaugeVal}, 100`}
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <span className="absolute font-mono font-bold text-xs text-foreground">
                              {idx + 1}
                            </span>
                          </div>

                          <div>
                            <span className="text-xs font-mono uppercase font-bold text-muted-foreground block">
                              {m.metric}
                            </span>
                            <span className="text-base font-bold text-foreground">
                              {m.target}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/50">
                          {m.whyItMatters}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 5: Interactive Input Field to Update Roadmap (Collapsible)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="veracity-card flex flex-col border border-accent/30 bg-gradient-to-r from-card via-accent/5 to-card overflow-hidden transition-all">
          {/* Section Accordion Header */}
          <div
            onClick={() => toggleSection('update')}
            className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shrink-0">
                <MessageSquare size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                    Section 5
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <h4 className="text-base sm:text-lg font-bold text-foreground">
                    Update Roadmap with Your Latest Progress
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Input customer feedback or bottlenecks to adapt and recalibrate the plan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                {sectionsCollapsed.update ? 'Expand' : 'Collapse'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                {sectionsCollapsed.update ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </div>
          </div>

          {/* Section Content */}
          {!sectionsCollapsed.update && (
            <div className="p-6 sm:p-8 pt-0 flex flex-col gap-3 border-t border-accent/20 animate-fadeIn mt-2 pt-6">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Share what you’ve launched, real user conversion numbers, or new bottlenecks, and the AI will adapt your tree roadmap with refreshed priorities.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-1">
                <input
                  value={userProgressInput}
                  onChange={(e) => setUserProgressInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void adaptRoadmap();
                  }}
                  placeholder="e.g. We launched our landing page and got 25 signups, but need ideas on pricing packages..."
                  className="neu-input flex-1 h-12 px-4 text-sm rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => void adaptRoadmap()}
                  disabled={adapting || !userProgressInput.trim()}
                  className="bg-accent text-white flex items-center justify-center gap-2 px-6 h-12 rounded-xl text-sm font-semibold hover:opacity-95 transition-all shrink-0 shadow-sm disabled:opacity-50"
                >
                  {adapting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {adapting ? 'Updating Roadmap…' : 'Update Roadmap with My Input'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    ) : null}
    </div>
  );
}
