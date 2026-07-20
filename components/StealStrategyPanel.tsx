'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme-provider';
import { Crosshair, Loader2, Sparkles } from 'lucide-react';

type Result = {
  summary: string;
  historicalCompetitiveMoves: { move: string; context: string; effectOnRivals: string }[];
  modernEntrantPlaybook: { analogy: string; applicationToday: string; exampleTactics: string[] }[];
  guardrails: string;
};

export function StealStrategyPanel() {
  const { text, textMuted, textSubtle } = useTheme();
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
    <div className="flex flex-col gap-6 max-w-3xl w-full">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight flex items-center gap-3" style={{ color: text }}>
          <span className="neu-well w-10 h-10 shrink-0">
            <Crosshair size={18} className="text-accent" />
          </span>
          Steal strategy
        </h2>
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: textMuted }}>
          Case-study view: how a company historically competed against same-type rivals, and how a new entrant might apply those patterns ethically today. Not legal advice; verify facts for your market.
        </p>
      </div>

      <div className="veracity-card p-6 space-y-4">
        <div>
          <label className="label-mono block mb-1.5">Company to analyse *</label>
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="e.g. Salesforce, Notion, Stripe"
            className="neu-input w-full h-11 px-3.5 text-[13px]"
          />
        </div>
        <div>
          <label className="label-mono block mb-1.5">Market (optional)</label>
          <input
            value={market}
            onChange={e => setMarket(e.target.value)}
            placeholder="e.g. B2B CRM, headless CMS, fintech cards"
            className="neu-input w-full h-11 px-3.5 text-[13px]"
          />
        </div>
        <div>
          <label className="label-mono block mb-1.5">Your new company or angle (optional)</label>
          <input
            value={newContext}
            onChange={e => setNewContext(e.target.value)}
            placeholder="e.g. 20-person PLG startup in Europe"
            className="neu-input w-full h-11 px-3.5 text-[13px]"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !company.trim()}
          className="bg-gradient-signature flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-semibold disabled:opacity-40 min-h-11"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Generate
        </button>
      </div>

      {error && (
        <div className="neu-inset rounded-2xl px-4 py-3">
          <p className="text-[13px] text-slate-900 dark:text-sky-100">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="veracity-card p-5">
            <p className="label-mono mb-3">Summary</p>
            <p className="text-[14px] leading-relaxed" style={{ color: textMuted }}>{data.summary}</p>
          </div>

          <div className="veracity-card p-5">
            <p className="label-mono mb-4">Historical competitive moves</p>
            <ul className="flex flex-col gap-3">
              {data.historicalCompetitiveMoves.map((h, i) => (
                <li key={i} className="neu-inset rounded-2xl px-4 py-3.5">
                  <span className="font-semibold text-[13px]" style={{ color: text }}>{h.move}</span>
                  <span className="text-[12px] block mt-1 leading-relaxed" style={{ color: textMuted }}>{h.context}</span>
                  <span className="text-[12px] block mt-1.5" style={{ color: textSubtle }}>Effect on rivals: {h.effectOnRivals}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="veracity-card p-5">
            <p className="label-mono mb-4">Modern entrant playbook</p>
            <ul className="flex flex-col gap-3">
              {data.modernEntrantPlaybook.map((m, i) => (
                <li key={i} className="neu-inset rounded-2xl px-4 py-3.5">
                  <span className="font-semibold text-[13px]" style={{ color: text }}>{m.analogy}</span>
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: textMuted }}>{m.applicationToday}</p>
                  {m.exampleTactics?.length > 0 && (
                    <ul className="list-disc pl-5 mt-2 text-[12px] space-y-0.5" style={{ color: textSubtle }}>
                      {m.exampleTactics.map((t, j) => <li key={j}>{t}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="neu-inset rounded-3xl p-5">
            <p className="label-mono mb-2" style={{ color: 'var(--accent)' }}>Guardrails</p>
            <p className="text-[12px] leading-relaxed" style={{ color: textMuted }}>{data.guardrails}</p>
          </div>
        </div>
      )}
    </div>
  );
}
