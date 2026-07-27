'use client';

import React, { useState, useEffect } from 'react';
import { loadUserProfile, saveUserProfile, UserProfile } from '@/lib/user-profile';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (profile: UserProfile) => void;
}

export function UserProfileDrawer({ isOpen, onClose, onSave }: UserProfileDrawerProps) {
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [company, setCompany] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const p = loadUserProfile();
      setRole(p.role || '');
      setIndustry(p.industry || '');
      setCompany(p.company || '');
      setWebsiteUrl(p.websiteUrl || '');
      setCompetitors(p.competitors || []);
      setSavedNotice(false);
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

  const handleSave = () => {
    const updated = saveUserProfile({
      role: role.trim(),
      industry: industry.trim(),
      company: company.trim(),
      websiteUrl: websiteUrl.trim(),
      competitors,
    });
    if (onSave) onSave(updated);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-md bg-card border-l border-border shadow-2xl p-6 flex flex-col gap-6"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-base font-bold">
                👤
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">User Profile & Settings</h2>
                <p className="text-xs text-muted-foreground">Manage your company baseline and competitor radar</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-sm font-medium p-1.5 rounded-lg hover:bg-accent/10 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1">
            {savedNotice && (
              <div className="p-3 rounded-xl bg-accent/15 border border-accent/30 text-xs font-semibold text-accent text-center animate-pulse">
                ✓ Profile settings saved successfully!
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Executive Role / Title
              </label>
              <input
                type="text"
                placeholder="e.g. VP of Product, CEO, Head of Strategy"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Target Industry / Category
              </label>
              <input
                type="text"
                placeholder="e.g. B2B SaaS, AI/ML, Developer Tools"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Your Company / Product Name
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Tracked Competitors
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. Clay, Apollo"
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
              <div className="flex flex-wrap gap-2 min-h-[48px] p-3 rounded-xl bg-accent/5 border border-border/50">
                {competitors.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No competitors tracked. Type above to add.</span>
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
          </div>

          {/* Footer Save */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-opacity shadow-md"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
