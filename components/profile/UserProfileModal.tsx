'use client';

import React, { useState, useEffect } from 'react';
import { loadUserProfile, saveUserProfile, UserProfile } from '@/lib/user-profile';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (profile: UserProfile) => void;
}

export function UserProfileModal({ isOpen, onClose, onSave }: UserProfileModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [company, setCompany] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitors, setCompetitors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const p = loadUserProfile();
      setRole(p.role || '');
      setIndustry(p.industry || '');
      setCompany(p.company || '');
      setWebsiteUrl(p.websiteUrl || '');
      setCompetitors(p.competitors || []);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleComplete = () => {
    const updated = saveUserProfile({
      role: role.trim(),
      industry: industry.trim(),
      company: company.trim(),
      websiteUrl: websiteUrl.trim(),
      competitors,
    });
    if (onSave) onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 sm:p-8 flex flex-col gap-6"
        style={{ boxShadow: 'var(--shadow-extruded)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-lg font-bold">
              🎯
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Personalize Your Growth Intelligence</h2>
              <p className="text-xs text-muted-foreground">Step {step} of 3 — Tailor benchmarks to your company</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-btn text-sm" aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-accent/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Step 1: Role & Industry */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Your Role / Title
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Target Industry / Category
              </label>
              <input
                type="text"
                placeholder="e.g. B2B SaaS, AI/ML, Developer Tools, FinTech"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {/* Step 2: Company & Website */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Your Company / Product Name
              </label>
              <input
                type="text"
                placeholder="e.g. Vector Agents, Notion, Figma"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Official Website URL
              </label>
              <input
                type="url"
                placeholder="e.g. https://vectoragents.ai"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {/* Step 3: Key Competitors */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Primary Competitors to Track
              </label>
              <div className="flex gap-2">
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
                  className="px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Competitor Chips */}
            <div className="flex flex-wrap gap-2 min-h-[48px] p-3 rounded-xl bg-accent/5 border border-border/50">
              {competitors.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No competitors added yet. Type a name above.</span>
              ) : (
                competitors.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/15 border border-accent/25 text-xs font-medium text-accent"
                  >
                    {c}
                    <button
                      onClick={() => handleRemoveCompetitor(c)}
                      className="hover:text-destructive text-xs font-bold"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-opacity shadow-md"
            >
              Save Profile & Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
