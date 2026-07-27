'use client';

import React, { useState, useEffect } from 'react';
import { User, Building2, Globe, Crosshair, Sparkles, CheckCircle2, ShieldCheck, AlertCircle, Brain, Tag } from 'lucide-react';
import { loadUserProfile, saveUserProfile, UserProfile } from '@/lib/user-profile';
import type { UserMemory } from '@/lib/memory';

interface ProfileSettingsViewProps {
  userEmail: string | null;
  userMemory?: UserMemory | null;
}

export function ProfileSettingsView({
  userEmail,
  userMemory,
}: ProfileSettingsViewProps) {
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [role, setRole] = useState(() => profile.role || userMemory?.role || '');
  const [industry, setIndustry] = useState(() => profile.industry || '');
  const [company, setCompany] = useState(() => profile.company || userMemory?.company || '');
  const [websiteUrl, setWebsiteUrl] = useState(() => profile.websiteUrl || '');
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitors, setCompetitors] = useState<string[]>(() =>
    profile.competitors?.length ? profile.competitors : (userMemory?.competitors || []),
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (userMemory) {
      if (!role && userMemory.role) setRole(userMemory.role);
      if (!company && userMemory.company) setCompany(userMemory.company);
      if (competitors.length === 0 && userMemory.competitors?.length) setCompetitors(userMemory.competitors);
    }
  }, [userMemory, role, company, competitors.length]);

  const handleAddCompetitor = () => {
    const trimmed = competitorInput.trim();
    if (trimmed && !competitors.includes(trimmed)) {
      setCompetitors([...competitors, trimmed]);
      setCompetitorInput('');
    }
  };

  const handleRemoveCompetitor = (name: string) => {
    setCompetitors(competitors.filter((c) => c !== name));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = saveUserProfile({
      role: role.trim(),
      industry: industry.trim(),
      company: company.trim(),
      websiteUrl: websiteUrl.trim(),
      competitors,
    });
    setProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const isProfileIncomplete = !company || !role || competitors.length === 0;
  const factsList = userMemory?.facts ?? [];
  const interestsList = userMemory?.interests ?? [];
  const productsList = userMemory?.products ?? [];

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 animate-fadeIn pb-24">
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
          className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-all shadow-md shrink-0 flex items-center gap-1.5"
        >
          <CheckCircle2 size={14} />
          {savedSuccess ? 'Saved!' : 'Save Baseline'}
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
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Account Identity */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border/50">
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

        {/* Card 2: Company & Product Baseline */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border/50">
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

        {/* Card 3: Tracked Competitors */}
        <div
          className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm md:col-span-2"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
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
                className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Add Competitor
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
      </form>

      {/* Card 4: AI-Extracted Personalized Memory Facts */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-4 shadow-sm"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-foreground">AI-Extracted Personalized Memory</h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {factsList.length} extracted facts
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Below are durable facts automatically extracted by Veracity AI from explicit user statements across your research sessions.
        </p>

        {/* Fact Cards */}
        {factsList.length === 0 ? (
          <div className="p-4 rounded-xl bg-accent/5 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground italic">
              No cross-session facts extracted yet. Ask research questions stating your business context (e.g. &quot;We build B2B SDR tools...&quot;) to populate.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {factsList.map((f, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-accent/5 border border-border/60 flex items-start gap-3">
                <Tag size={14} className="text-accent shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium">{f.fact}</p>
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">
                    Recorded {new Date(f.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product & Interest Topics */}
        {(productsList.length > 0 || interestsList.length > 0) && (
          <div className="pt-2 border-t border-border/40 flex flex-col gap-3">
            {productsList.length > 0 && (
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Extracted Products
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {productsList.map((p, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {interestsList.length > 0 && (
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Strategic Focus Topics
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {interestsList.map((interest, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Notification Toast */}
      {savedSuccess && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl bg-accent text-accent-foreground text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={16} /> Profile settings updated & saved!
        </div>
      )}
    </div>
  );
}
