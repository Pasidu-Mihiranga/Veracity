'use client';

import { useState } from 'react';
import { AlertTriangle, Crosshair, Loader2, Sparkles, Shield } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

type Result = {
  summary: string;
  historicalCompetitiveMoves: { move: string; context: string; effectOnRivals: string }[];
  modernEntrantPlaybook: { analogy: string; applicationToday: string; exampleTactics: string[] }[];
  guardrails: string;
  grounding: {
    status: 'ungrounded-educational';
    label: string;
    enterpriseEligible: false;
    sources: [];
    limitations: string[];
  };
};

const EXAMPLE_COMPANIES = ['Salesforce', 'Notion', 'Stripe', 'HubSpot', 'Figma'];

export function StealStrategyPanel() {
  const { text, textMuted } = useTheme();
  const [company, setCompany] = useState('');
  const [market, setMarket] = useState('');
  const [newContext, setNewContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);

  const run = async () => {
    if (!company.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/steal-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          market: market.trim() || undefined,
          newCompanyContext: newContext.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? 'Request failed');
        return;
      }
      setData(j as Result);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-8">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="ui-heading flex items-center justify-center gap-3" style={{ fontSize: 24, color: text }}>
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-raised)', boxShadow: 'var(--shadow-extruded-sm)' }}
          >
            <Crosshair size={18} style={{ color: 'var(--accent)' }} />
          </span>
          Steal strategy
        </h2>
        <p className="ui-body mt-3" style={{ color: textMuted }}>
          Educational analogy only. This surface does not retrieve sources and is excluded from enterprise decision evidence.
        </p>
      </div>

      <div className="results-panel p-5 sm:p-8" style={{ background: 'var(--surface)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="ui-section-label block mb-1.5">Company to analyse *</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Salesforce, Notion, Stripe"
              className="neu-input w-full h-11 px-3.5 ui-body-sm"
            />
            <div className="flex flex-wrap gap-2 mt-2.5 justify-center md:justify-start">
              {EXAMPLE_COMPANIES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setCompany(ex)}
                  className="ui-mono px-2.5 py-1 rounded-lg"
                  style={{
                    fontSize: 10,
                    color: 'var(--foreground-subtle)',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="ui-section-label block mb-1.5">Market (optional)</label>
            <input
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. B2B CRM, headless CMS, fintech cards"
              className="neu-input w-full h-11 px-3.5 ui-body-sm"
            />
          </div>
          <div>
            <label className="ui-section-label block mb-1.5">Your angle (optional)</label>
            <input
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="e.g. 20-person PLG startup in Europe"
              className="neu-input w-full h-11 px-3.5 ui-body-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => {
              void run();
            }}
            disabled={loading || !company.trim()}
            className="bg-gradient-signature flex items-center justify-center gap-2 px-8 py-2.5 text-[14px] font-semibold disabled:opacity-40 min-h-11 min-w-[200px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'Generating…' : 'Generate educational analogies'}
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl px-4 py-3 text-center max-w-xl mx-auto"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
        >
          <p className="ui-body-sm" style={{ color: 'var(--status-fail)' }}>
            {error}
          </p>
        </div>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-5">
          <div className="veracity-card p-4 bg-amber-50 text-amber-700 border-amber-200 flex items-start gap-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider font-semibold">
                {data.grounding.label}
              </p>
              <p className="text-xs mt-1">
                No retrieval or primary sources were used. Verify every historical claim independently; this content cannot enter board packs.
              </p>
            </div>
          </div>
          <div className="results-panel p-5 sm:p-6 text-center sm:text-left" style={{ background: 'var(--surface)' }}>
            <p className="ui-section-label mb-3">Educational summary</p>
            <p className="ui-body max-w-3xl mx-auto sm:mx-0" style={{ color: textMuted }}>
              {data.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="results-panel p-5 sm:p-6" style={{ background: 'var(--surface)' }}>
              <p className="ui-section-label mb-4">Commonly cited historical analogies</p>
              <ul className="flex flex-col gap-3">
                {data.historicalCompetitiveMoves.map((h, i) => (
                  <li
                    key={i}
                    className="rounded-xl px-4 py-3.5"
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                  >
                    <span className="ui-title" style={{ fontSize: 14 }}>
                      {h.move}
                    </span>
                    <span className="ui-caption block mt-1.5" style={{ color: 'var(--foreground-muted)' }}>
                      {h.context}
                    </span>
                    <span className="ui-caption block mt-1.5" style={{ color: 'var(--foreground-subtle)' }}>
                      Effect on rivals: {h.effectOnRivals}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="results-panel p-5 sm:p-6" style={{ background: 'var(--surface)' }}>
              <p className="ui-section-label mb-4">Educational entrant patterns</p>
              <ul className="flex flex-col gap-3">
                {data.modernEntrantPlaybook.map((m, i) => (
                  <li
                    key={i}
                    className="rounded-xl px-4 py-3.5"
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                  >
                    <span className="ui-title" style={{ fontSize: 14 }}>
                      {m.analogy}
                    </span>
                    <p className="ui-body-sm mt-1.5" style={{ color: 'var(--foreground-muted)' }}>
                      {m.applicationToday}
                    </p>
                    {m.exampleTactics?.length > 0 ? (
                      <ul className="list-disc pl-5 mt-2 space-y-0.5">
                        {m.exampleTactics.map((t, j) => (
                          <li key={j} className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>
                            {t}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="rounded-2xl p-5 sm:p-6 max-w-3xl mx-auto w-full"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
            }}
          >
            <p className="ui-section-label mb-2 flex items-center justify-center sm:justify-start gap-2" style={{ color: 'var(--accent)' }}>
              <Shield size={12} /> Guardrails
            </p>
            <p className="ui-body-sm text-center sm:text-left" style={{ color: textMuted }}>
              {data.guardrails}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
