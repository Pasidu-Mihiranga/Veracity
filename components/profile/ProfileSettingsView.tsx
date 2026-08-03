'use client';

import React, { useState, useEffect } from 'react';
import { User, Building2, Globe, Crosshair, Sparkles, CheckCircle2, ShieldCheck, AlertCircle, Brain, Tag, Sun, Moon, Palette, Trash2, Bot, ToggleLeft, ToggleRight } from 'lucide-react';
import { loadUserProfile, saveUserProfile, UserProfile } from '@/lib/user-profile';
import { getFactText, updateUserMemoryFacts, type MemoryFact, type UserMemory } from '@/lib/memory';
import { useTheme } from '@/lib/theme-provider';
import { ALL_DOMAINS, DOMAIN_META, type Domain } from '@/lib/domain-meta';

interface ProfileSettingsViewProps {
  userEmail: string | null;
  userMemory?: UserMemory | null;
  selectedAgents?: Record<Domain, boolean>;
  onToggleAgent?: (domain: Domain) => void;
  forceFullSweep?: boolean;
  onToggleForceFullSweep?: () => void;
}

export function ProfileSettingsView({
  userEmail,
  userMemory,
  selectedAgents: initialSelectedAgents,
  onToggleAgent,
  forceFullSweep: initialForceFullSweep = false,
  onToggleForceFullSweep,
}: ProfileSettingsViewProps) {
  const { theme, setThemeMode } = useTheme();
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [role, setRole] = useState(() => profile.role || userMemory?.role || '');
  const [industry, setIndustry] = useState(() => profile.industry || '');
  const [company, setCompany] = useState(() => profile.company || userMemory?.company || '');
  const [websiteUrl, setWebsiteUrl] = useState(() => profile.websiteUrl || '');
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitors, setCompetitors] = useState<string[]>(() =>
    profile.competitors?.length ? profile.competitors : (userMemory?.competitors || []),
  );
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>(() => userMemory?.facts ?? []);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [agentState, setAgentState] = useState<Record<Domain, boolean>>(() => {
    if (initialSelectedAgents) return initialSelectedAgents;
    return ALL_DOMAINS.reduce((acc, d) => ({ ...acc, [d]: true }), {} as Record<Domain, boolean>);
  });

  const [forceFullSweep, setForceFullSweep] = useState(initialForceFullSweep);

  const toggleAgent = (domain: Domain) => {
    setAgentState((prev) => ({ ...prev, [domain]: !prev[domain] }));
    onToggleAgent?.(domain);
  };

  const handleToggleForceFullSweep = () => {
    setForceFullSweep((v) => !v);
    onToggleForceFullSweep?.();
  };

  useEffect(() => {
    if (userMemory) {
      if (!role && userMemory.role) setRole(userMemory.role);
      if (!company && userMemory.company) setCompany(userMemory.company);
      if (competitors.length === 0 && userMemory.competitors?.length) setCompetitors(userMemory.competitors);
      if (userMemory.facts) setMemoryFacts(userMemory.facts);
    }
  }, [userMemory, role, company, competitors.length]);

  const handleAddCompetitor = () => {
    const trimmed = competitorInput.trim();
    if (trimmed && !competitors.includes(trimmed)) {
      setCompetitors((prev) => [...prev, trimmed]);
      setCompetitorInput('');
    }
  };

  const handleRemoveCompetitor = (name: string) => {
    setCompetitors((prev) => prev.filter((c) => c !== name));
  };

  const handleDeleteFact = async (indexToDelete: number) => {
    const updated = memoryFacts.filter((_, idx) => idx !== indexToDelete);
    setMemoryFacts(updated);
    await updateUserMemoryFacts(updated);
  };

  const handleClearAllFacts = async () => {
    setMemoryFacts([]);
    await updateUserMemoryFacts([]);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: UserProfile = {
      ...profile,
      role: role.trim(),
      industry: industry.trim(),
      company: company.trim(),
      websiteUrl: websiteUrl.trim(),
      competitors,
    };
    setProfile(updated);
    saveUserProfile(updated);

    // Also persist baseline updates into backend user_memory table
    void updateUserMemoryFacts(memoryFacts);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const isProfileIncomplete = !company || !role || competitors.length === 0;

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn pb-24">
      {/* Top Header Card */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-2xl font-bold shrink-0">
            {userEmail ? userEmail[0].toUpperCase() : <User size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Executive Profile & Personal Memory</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-[11px] font-semibold text-accent">
                Executive SaaS
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your company baseline and inspect AI-extracted personalized memory facts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSave()}
          className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCircle2 size={14} className="text-white" />
          <span className="text-white">{savedSuccess ? 'Saved!' : 'Save Baseline'}</span>
        </button>
      </div>

      {/* Setup Warning Alert (If profile incomplete) */}
      {isProfileIncomplete && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Context Baseline Recommended</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in your Company Name, Role, and primary competitors to personalize all research swarms automatically.
            </p>
          </div>
        </div>
      )}

      {/* Main Editable Profile Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Card 1: Account Identity */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col justify-between gap-4 shadow-sm h-full"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
              <ShieldCheck size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-foreground">Account Identity</h3>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Account Email
                </label>
                <input
                  type="text"
                  disabled
                  value={userEmail || 'Executive User'}
                  className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-xs font-mono text-muted-foreground cursor-not-allowed opacity-80"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Executive Role / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. VP of Product, CEO, GTM Director"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Target Category / Industry
                </label>
                <input
                  type="text"
                  placeholder="e.g. B2B SaaS, AI/ML, FinTech"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Theme & Visual Mode */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col justify-between gap-4 shadow-sm h-full"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-accent" />
                <h3 className="text-sm font-bold text-foreground">Theme & Visual Mode</h3>
              </div>
              <span className="text-[11px] font-mono capitalize px-2 py-0.5 rounded bg-accent/10 text-accent font-semibold">
                {theme} mode active
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Select Preferred Theme
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`p-4.5 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all cursor-pointer min-h-[140px] ${
                    theme === 'light'
                      ? 'border-accent bg-accent/15 text-accent shadow-sm font-bold'
                      : 'border-border bg-accent/5 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center">
                    <Sun size={20} />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block">Light Mode</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">Crisp daylight theme</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`p-4.5 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all cursor-pointer min-h-[140px] ${
                    theme === 'dark'
                      ? 'border-accent bg-accent/15 text-accent shadow-sm font-bold'
                      : 'border-border bg-accent/5 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center">
                    <Moon size={20} />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block">Dark Mode</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">Executive dark theme</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Company & Product Baseline */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col justify-between gap-4 shadow-sm h-full"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
              <Building2 size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-foreground">Company Baseline</h3>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Company / Product Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vector Agents"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Official Website URL
                </label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3.5 top-3.5 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder="https://vectoragents.ai"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Tracked Competitors Radar */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col justify-between gap-4 shadow-sm h-full"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
              <div className="flex items-center gap-2">
                <Crosshair size={16} className="text-accent" />
                <h3 className="text-sm font-bold text-foreground">Competitor Intelligence Radar</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {competitors.length} tracked entities
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Monitored Competitors
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="e.g. Clay, Apollo, Gong"
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompetitor())}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddCompetitor}
                  className="px-4.5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                >
                  <span className="text-white">Add Competitor</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[56px] p-3 rounded-xl bg-accent/5 border border-border/50">
                {competitors.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 p-1">
                    <Sparkles size={13} /> No competitors added yet. Type a name above to build your radar.
                  </span>
                ) : (
                  competitors.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-xs font-semibold text-accent shadow-xs"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => handleRemoveCompetitor(c)}
                        className="hover:text-destructive text-xs font-bold transition-colors ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Card: Swarm Agent Roster & Engine Configuration */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-5 shadow-sm"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Swarm Agent Roster & Engine Configuration</h3>
              <p className="text-xs text-muted-foreground">Select active specialist engines for web research sweeps</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-accent bg-accent/15 px-3 py-1 rounded-full border border-accent/30">
            {Object.values(agentState).filter(Boolean).length}/{ALL_DOMAINS.length} Agents Active
          </span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/5 border border-border/60">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-accent" />
            <div>
              <p className="text-xs font-bold text-foreground">Force Full Sweep Mode</p>
              <p className="text-[11px] text-muted-foreground">Bypass adaptive selection to run all active specialist agents unconditionally</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleForceFullSweep}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
              forceFullSweep
                ? 'bg-accent/15 text-accent border-accent/30 shadow-2xs'
                : 'bg-muted/50 text-muted-foreground border-border'
            }`}
          >
            {forceFullSweep ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}
            <span>{forceFullSweep ? 'Active' : 'Auto'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_DOMAINS.map((domain) => {
            const meta = DOMAIN_META[domain];
            const isSelected = agentState[domain] ?? true;
            return (
              <div
                key={domain}
                onClick={() => toggleAgent(domain)}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-accent/10 border-accent/40 shadow-2xs ring-1 ring-accent/20'
                    : 'bg-accent/5 border-border/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent">
                    {meta.short}
                  </span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAgent(domain)}
                    className="accent-accent cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">{meta.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 5: AI-Extracted Personalized Memory Facts */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-foreground">AI-Extracted Personalized Memory</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {memoryFacts.length} extracted facts
            </span>
            {memoryFacts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllFacts}
                className="text-[11px] text-red-500 hover:text-red-600 hover:underline font-semibold transition-colors cursor-pointer"
              >
                Clear Memory
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Below are durable facts automatically extracted by Veracity AI from explicit user statements across your research sessions.
        </p>

        {memoryFacts.length === 0 ? (
          <div className="p-4 rounded-xl bg-accent/5 border border-border/40 text-xs text-muted-foreground italic">
            No durable facts extracted yet. Ask research questions in Intelligence mode to build domain memory automatically.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {memoryFacts.map((fact, idx) => {
              const text = getFactText(fact);
              return (
                <div
                  key={idx}
                  className="group relative p-3.5 rounded-xl bg-accent/5 border border-border/40 flex items-start justify-between gap-2.5 text-xs hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <Tag size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="text-foreground leading-relaxed break-words">{text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteFact(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-md transition-all cursor-pointer shrink-0"
                    title="Remove fact"
                  >
                    <Trash2 size={12} className="text-red-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
