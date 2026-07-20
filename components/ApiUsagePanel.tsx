'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-provider';
import type { RunMetrics } from '@/lib/agents/types';

/** Mirrors chat stream `liveMetrics` in page.tsx. */
type LiveStreamMetrics = {
  elapsedMs: number;
  agentCount: number;
  completedAgentCount: number;
  failedAgentCount: number;
  runningAgentCount: number;
  estimatedCostUsd: number;
  geminiCallCount: number;
  toolCallCount: number;
};

type UsageInfo = {
  models: { text: string; embedding: string; embeddingDimensions: number };
  providers: { id: string; label: string; kind: string; configured: boolean; usageNote: string }[];
};

type SessionUsage = {
  queries: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  totalGeminiCalls: number;
  totalToolCalls: number;
};

export function ApiUsagePanel({
  lastMetrics,
  lastLive,
  sessionTotals,
}: {
  lastMetrics?: RunMetrics;
  lastLive?: LiveStreamMetrics;
  sessionTotals: SessionUsage;
}) {
  const { text, textMuted, textSubtle } = useTheme();
  const [info, setInfo] = useState<UsageInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch('/api/usage-info');
      if (!res.ok) {
        setErr(res.status === 401 ? 'Sign in to see usage details.' : 'Could not load usage info.');
        return;
      }
      setInfo(await res.json() as UsageInfo);
    } catch {
      setErr('Network error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const latencyMs = lastMetrics?.totalLatencyMs ?? lastLive?.elapsedMs;
  const cost = lastMetrics?.estimatedCostUsd ?? lastLive?.estimatedCostUsd;
  const geminiCalls = lastMetrics?.geminiCallCount ?? lastLive?.geminiCallCount;
  const toolCalls = lastMetrics?.toolCallCount ?? lastLive?.toolCallCount;
  const agentN = lastMetrics?.agentCount ?? lastLive?.agentCount;
  const doneN = lastMetrics?.completedAgentCount ?? lastLive?.completedAgentCount;

  return (
    <div className="flex flex-col gap-6 max-w-3xl w-full">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight" style={{ color: text }}>
          API and model usage
        </h2>
        <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: textMuted }}>
          In-app numbers are estimated from the last intelligence run and your session. Provider dashboards are authoritative for billing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="veracity-card p-5">
          <p className="label-mono mb-3">Last run</p>
          {lastMetrics || lastLive ? (
            <ul className="text-[13px] font-mono space-y-2" style={{ color: textMuted }}>
              {latencyMs != null && <li>Latency: {(latencyMs / 1000).toFixed(1)}s</li>}
              {cost != null && <li>Est. model cost: ${Number(cost).toFixed(4)}</li>}
              {geminiCalls != null && <li>Model calls (est.): {geminiCalls}</li>}
              {toolCalls != null && <li>Tool invocations (est.): {toolCalls}</li>}
              {agentN != null && <li>Agents: {doneN ?? '—'}/{agentN}</li>}
            </ul>
          ) : (
            <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
              Run a query on the Intelligence tab to populate metrics.
            </p>
          )}
        </div>
        <div className="veracity-card p-5">
          <p className="label-mono mb-3">Session</p>
          <ul className="text-[13px] font-mono space-y-2" style={{ color: textMuted }}>
            <li>Queries with metrics: {sessionTotals.queries}</li>
            <li>Sum est. cost: ${sessionTotals.totalCostUsd.toFixed(4)}</li>
            <li>Sum latency: {(sessionTotals.totalLatencyMs / 1000).toFixed(1)}s</li>
            <li>Sum model calls (est.): {sessionTotals.totalGeminiCalls}</li>
            <li>Sum tool calls (est.): {sessionTotals.totalToolCalls}</li>
          </ul>
        </div>
      </div>

      {err && (
        <div className="neu-inset rounded-2xl px-4 py-3 flex items-start gap-2">
          <p className="text-[12px] text-sky-700 dark:text-sky-300">{err}</p>
        </div>
      )}

      {info && (
        <div className="space-y-4">
          <div className="veracity-card p-5">
            <p className="label-mono mb-3">Configured models</p>
            <p className="text-[13px] font-mono leading-relaxed" style={{ color: textMuted }}>
              Text: {info.models.text}
            </p>
            <p className="text-[13px] font-mono mt-1.5 leading-relaxed" style={{ color: textMuted }}>
              Embeddings: {info.models.embedding} ({info.models.embeddingDimensions}d)
            </p>
          </div>

          <div className="veracity-card p-5">
            <p className="label-mono mb-4">Integrations</p>
            <ul className="flex flex-col gap-3">
              {info.providers.map(p => (
                <li key={p.id} className="neu-inset rounded-2xl px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: text }}>{p.label}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 ${p.configured ? 'neu-pill-positive' : 'neu-pill'}`}>
                      {p.configured ? 'configured' : 'not set'}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: textSubtle }}>{p.usageNote}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
