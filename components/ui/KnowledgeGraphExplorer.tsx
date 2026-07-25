'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, Search, X, Wrench } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';

type Hit = {
  node: {
    id: string;
    kind: string;
    label: string;
    confidence: number;
    key: string;
  };
  score: number;
  reasons: string[];
};

type Analytics = {
  mostReferencedCompetitors: Array<{ label: string; refs: number }>;
  mostTrustedEvidence: Array<{ label: string; confidence: number }>;
  emergingCompanies: Array<{ label: string; created_at: string }>;
  frequentlyChanging: Array<{ label: string; versions: number }>;
  centralEntities: Array<{ label: string; degree: number }>;
};

type Props = { open: boolean; onClose: () => void };

export function KnowledgeGraphExplorer({ open, onClose }: Props) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit['node'] | null>(null);
  const [neighbors, setNeighbors] = useState<{ nodes: Hit['node'][]; edges: unknown[] }>({
    nodes: [],
    edges: [],
  });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [maintMsg, setMaintMsg] = useState('');

  const search = useCallback(async () => {
    if (!q.trim()) return;
    const res = await fetch(`/api/kg/search?q=${encodeURIComponent(q)}`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    setHits(data.hits ?? []);
  }, [q]);

  const loadNode = async (nodeId: string) => {
    const res = await fetch(`/api/kg/neighborhood?nodeId=${nodeId}&depth=1`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    setNeighbors({ nodes: data.nodes ?? [], edges: data.edges ?? [] });
  };

  useEffect(() => {
    if (!open) return;
    if (featureFlags.kgAnalytics) {
      void fetch('/api/kg/analytics', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setAnalytics(d?.analytics ?? null))
        .catch(() => undefined);
    }
  }, [open]);

  if (!open || !featureFlags.kgExplorer) return null;

  const runMaintenance = async () => {
    const res = await fetch('/api/kg/maintenance/run', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    setMaintMsg(res.ok ? JSON.stringify(data.report) : data.error ?? 'failed');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <div className="w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-accent" />
            <div className="text-sm font-serif">Knowledge Graph</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
            placeholder="Hybrid search…"
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-background"
          />
          <button
            type="button"
            onClick={() => void search()}
            className="bg-gradient-signature text-white rounded-lg px-3"
          >
            <Search size={14} />
          </button>
        </div>

        {featureFlags.kgMaintenance && (
          <button
            type="button"
            onClick={() => void runMaintenance()}
            className="flex items-center gap-1.5 text-[11px] font-mono border border-border rounded-lg px-2 py-1.5 hover:bg-muted"
          >
            <Wrench size={12} /> Run entity resolution
          </button>
        )}
        {maintMsg && (
          <div className="text-[10px] font-mono bg-muted border border-border rounded p-2 break-all">
            {maintMsg}
          </div>
        )}

        {analytics && (
          <div className="veracity-card p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Analytics
            </div>
            <AnalyticsLine
              label="Most referenced"
              items={analytics.mostReferencedCompetitors.map((c) => `${c.label} (${c.refs})`)}
            />
            <AnalyticsLine
              label="Trusted evidence"
              items={analytics.mostTrustedEvidence.map(
                (c) => `${c.label.slice(0, 40)} · ${c.confidence.toFixed(2)}`,
              )}
            />
            <AnalyticsLine
              label="Emerging"
              items={analytics.emergingCompanies.map((c) => c.label)}
            />
            <AnalyticsLine
              label="Central"
              items={analytics.centralEntities.map((c) => `${c.label} (${c.degree})`)}
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          {hits.map((h) => (
            <button
              key={h.node.id}
              type="button"
              className="veracity-card p-2 text-left text-xs hover:bg-muted"
              onClick={() => {
                setSelected(h.node);
                void loadNode(h.node.id);
              }}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium truncate">{h.node.label}</span>
                <span className="font-mono text-[9px] uppercase text-muted-foreground">
                  {h.node.kind}
                </span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                score {h.score.toFixed(1)} · {h.reasons.join('+')} · conf{' '}
                {Number(h.node.confidence).toFixed(2)}
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="veracity-card p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Neighborhood · {selected.label.slice(0, 48)}
            </div>
            <ul className="text-xs space-y-1">
              {neighbors.nodes.map((n) => (
                <li key={n.id} className="flex justify-between gap-2 font-mono text-[11px]">
                  <span className="truncate">{n.label}</span>
                  <span className="text-muted-foreground uppercase">{n.kind}</span>
                </li>
              ))}
            </ul>
            <div className="text-[10px] text-muted-foreground mt-2 font-mono">
              {neighbors.edges.length} edges
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsLine({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[10px] font-mono text-muted-foreground">{label}</div>
      <div className="text-[11px]">{items.slice(0, 3).join(' · ')}</div>
    </div>
  );
}
