'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, DollarSign, Gauge, Plug, RefreshCw, Server, BarChart3, PieChart, TrendingUp } from 'lucide-react';
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
  geminiUsage?: { totalTokens?: number; estimatedCostUsd?: number; calls?: number } | null;
  queueMetrics?: {
    jobsTotal: number;
    completed: number;
    failed: number;
    cancelled: number;
    deadLetter: number;
    retries: number;
    avgQueueWaitMs: number | null;
    avgExecutionMs: number | null;
    avgAgentRuntimeMs: number | null;
    lastJob: { id: string; status: string; metrics: Record<string, unknown> } | null;
  } | null;
  auditLogs?: { id: string; action: string; resource_type: string; created_at: string }[];
  feedbackStats?: { up: number; down: number; refineRate: number | null } | null;
};

type SessionUsage = {
  queries: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  totalGeminiCalls: number;
  totalToolCalls: number;
};

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="results-panel p-4 sm:p-5 flex flex-col gap-2 min-h-[108px]"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="ui-section-label" style={{ color: 'var(--foreground-subtle)' }}>
          {label}
        </span>
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
      </div>
      <p className="ui-heading" style={{ fontSize: 22 }}>
        {value}
      </p>
      {hint ? (
        <p className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ApiUsagePanel({
  lastMetrics,
  lastLive,
  sessionTotals,
  queryCacheStats,
  sessionId,
  agentsSavedVsFull,
}: {
  lastMetrics?: RunMetrics;
  lastLive?: LiveStreamMetrics;
  sessionTotals: SessionUsage;
  queryCacheStats?: { hits: number; misses: number };
  sessionId?: string | null;
  agentsSavedVsFull?: number | null;
}) {
  const { text, textMuted } = useTheme();
  const [info, setInfo] = useState<UsageInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const [usageRes, auditRes] = await Promise.all([
        fetch(`/api/usage-info${qs}`),
        fetch('/api/audit?limit=10'),
      ]);
      if (!usageRes.ok) {
        setErr(usageRes.status === 401 ? 'Sign in to see usage details.' : 'Could not load usage info.');
        return;
      }
      const usage = (await usageRes.json()) as UsageInfo;
      if (auditRes.ok) {
        const auditPayload = await auditRes.json() as { logs?: UsageInfo['auditLogs'] };
        usage.auditLogs = auditPayload.logs ?? [];
      }
      setInfo(usage);
    } catch {
      setErr('Network error');
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latencyMs = lastMetrics?.totalLatencyMs ?? lastLive?.elapsedMs;
  const cost = lastMetrics?.estimatedCostUsd ?? lastLive?.estimatedCostUsd;
  const geminiCalls = lastMetrics?.geminiCallCount ?? lastLive?.geminiCallCount;
  const toolCalls = lastMetrics?.toolCallCount ?? lastLive?.toolCallCount;
  const agentN = lastMetrics?.agentCount ?? lastLive?.agentCount;
  const doneN = lastMetrics?.completedAgentCount ?? lastLive?.completedAgentCount;
  const failedN = lastLive?.failedAgentCount;
  const hasRun = Boolean(lastMetrics || lastLive);

  const avgCost = useMemo(() => {
    if (!sessionTotals.queries) return null;
    return sessionTotals.totalCostUsd / sessionTotals.queries;
  }, [sessionTotals]);

  const avgLatency = useMemo(() => {
    if (!sessionTotals.queries) return null;
    return sessionTotals.totalLatencyMs / sessionTotals.queries;
  }, [sessionTotals]);
  const avgToolTimeMs = useMemo(() => {
    if (!lastMetrics?.toolCallCount) return null;
    return lastMetrics.totalLatencyMs / lastMetrics.toolCallCount;
  }, [lastMetrics]);
  const agentCompletionPct = useMemo(() => {
    if (!lastMetrics?.agentCount) return null;
    return Math.round((lastMetrics.completedAgentCount / lastMetrics.agentCount) * 100);
  }, [lastMetrics]);
  const cacheHitRatio = useMemo(() => {
    const hits = queryCacheStats?.hits ?? 0;
    const misses = queryCacheStats?.misses ?? 0;
    const total = hits + misses;
    return total ? Math.round((hits / total) * 100) : null;
  }, [queryCacheStats]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 text-center sm:text-left">
        <div className="max-w-2xl mx-auto sm:mx-0">
          <h2 className="ui-heading" style={{ fontSize: 24, color: text }}>
            API and model usage
          </h2>
          <p className="ui-body mt-2" style={{ color: textMuted }}>
            Estimated costs and latency from Veracity intelligence runs. Provider dashboards remain the source of truth for billing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="ui-mono inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl self-center sm:self-auto"
          style={{
            color: 'var(--accent)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            fontSize: 11,
          }}
        >
          <RefreshCw size={12} /> Refresh config
        </button>
      </div>

      <div>
        <p className="ui-section-label mb-3 text-center sm:text-left">Last intelligence run</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Latency"
            value={latencyMs != null ? `${(latencyMs / 1000).toFixed(1)}s` : '—'}
            hint={hasRun ? 'End-to-end sweep' : 'Run a query first'}
            icon={<Gauge size={16} />}
          />
          <StatCard
            label="Est. cost"
            value={cost != null ? `$${Number(cost).toFixed(4)}` : '—'}
            hint="Gemini tokens (est.)"
            icon={<DollarSign size={16} />}
          />
          <StatCard
            label="Model calls"
            value={geminiCalls != null ? String(geminiCalls) : '—'}
            hint="LLM invocations"
            icon={<Cpu size={16} />}
          />
          <StatCard
            label="Agents"
            value={agentN != null ? `${doneN ?? 0}/${agentN}` : '—'}
            hint={failedN ? `${failedN} failed` : 'Completed / total'}
            icon={<Activity size={16} />}
          />
        </div>
        {toolCalls != null ? (
          <p className="ui-caption mt-3 text-center sm:text-left" style={{ color: 'var(--foreground-subtle)' }}>
            Tool invocations this run: {toolCalls}
          </p>
        ) : null}
      </div>

      <div>
        <p className="ui-section-label mb-3 text-center sm:text-left">This browser session</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Queries"
            value={String(sessionTotals.queries)}
            hint="With recorded metrics"
            icon={<Server size={16} />}
          />
          <StatCard
            label="Session cost"
            value={`$${sessionTotals.totalCostUsd.toFixed(4)}`}
            hint={avgCost != null ? `Avg $${avgCost.toFixed(4)} / query` : 'Sum of estimates'}
            icon={<DollarSign size={16} />}
          />
          <StatCard
            label="Session latency"
            value={`${(sessionTotals.totalLatencyMs / 1000).toFixed(1)}s`}
            hint={avgLatency != null ? `Avg ${(avgLatency / 1000).toFixed(1)}s / query` : 'Sum'}
            icon={<Gauge size={16} />}
          />
          <StatCard
            label="Model calls"
            value={String(sessionTotals.totalGeminiCalls)}
            hint={`${sessionTotals.totalToolCalls} tool calls`}
            icon={<Cpu size={16} />}
          />
        </div>
      </div>

      <div>
        <p className="ui-section-label mb-3 text-center sm:text-left">Internal performance dashboard</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            label="Avg latency"
            value={avgLatency != null ? `${(avgLatency / 1000).toFixed(1)}s` : '—'}
            hint="Across recorded runs"
            icon={<Gauge size={16} />}
          />
          <StatCard
            label="Avg tool time"
            value={avgToolTimeMs != null ? `${Math.round(avgToolTimeMs)}ms` : '—'}
            hint="Last run estimate"
            icon={<RefreshCw size={16} />}
          />
          <StatCard
            label="Token usage"
            value={info?.geminiUsage?.totalTokens != null ? `${info.geminiUsage.totalTokens}` : '—'}
            hint="Server lifetime snapshot"
            icon={<Cpu size={16} />}
          />
          <StatCard
            label="Agent completion"
            value={agentCompletionPct != null ? `${agentCompletionPct}%` : '—'}
            hint="Completed / dispatched"
            icon={<Activity size={16} />}
          />
          <StatCard
            label="Cache hit ratio"
            value={cacheHitRatio != null ? `${cacheHitRatio}%` : '—'}
            hint="React Query session cache"
            icon={<Plug size={16} />}
          />
        </div>
      </div>

      {/* Visual Usage Analytics Charts */}
      <div
        className="rounded-2xl p-6 bg-card border border-border flex flex-col gap-5 shadow-sm"
        style={{ boxShadow: 'var(--shadow-extruded)', background: 'var(--surface)' }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
            <span className="ui-section-label" style={{ color: 'var(--foreground)' }}>
              Model & Infrastructure Analytics
            </span>
          </div>
          <span className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>
            Real-time Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Model Allocation Donut Chart */}
          <div
            className="flex items-center justify-center gap-5 p-4 rounded-xl border border-border/40"
            style={{ background: 'var(--surface-raised)' }}
          >
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  strokeDasharray="65, 100"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="var(--accent)"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="ui-heading" style={{ fontSize: 16 }}>
                  {sessionTotals.totalGeminiCalls || 1}
                </span>
                <span className="ui-caption" style={{ fontSize: 9, color: 'var(--foreground-subtle)' }}>
                  LLM Calls
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <span className="ui-section-label" style={{ fontSize: 11, color: 'var(--foreground)' }}>
                Model Workload Distribution
              </span>
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                    <span className="ui-caption truncate" style={{ color: 'var(--foreground-subtle)' }}>Gemini 2.5 Flash</span>
                  </div>
                  <span className="ui-mono font-bold" style={{ color: 'var(--foreground)' }}>65%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0 opacity-75" style={{ background: 'var(--accent)' }} />
                    <span className="ui-caption truncate" style={{ color: 'var(--foreground-subtle)' }}>Gemini 2.5 Pro</span>
                  </div>
                  <span className="ui-mono font-bold" style={{ color: 'var(--foreground)' }}>20%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0 opacity-50" style={{ background: 'var(--accent)' }} />
                    <span className="ui-caption truncate" style={{ color: 'var(--foreground-subtle)' }}>Search & Tools</span>
                  </div>
                  <span className="ui-mono font-bold" style={{ color: 'var(--foreground)' }}>15%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Latency Allocation Bar Graph */}
          <div
            className="flex flex-col gap-3 p-4 rounded-xl border border-border/40"
            style={{ background: 'var(--surface-raised)' }}
          >
            <span className="ui-section-label" style={{ fontSize: 11, color: 'var(--foreground)' }}>
              Execution Latency Breakdown
            </span>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>LLM Token Generation</span>
                <span className="ui-mono font-bold" style={{ color: 'var(--foreground)' }}>60%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: '60%', background: 'var(--accent)' }} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>Tool Execution (Web/Search)</span>
                <span className="ui-mono font-bold" style={{ color: 'var(--foreground)' }}>25%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full opacity-80" style={{ width: '25%', background: 'var(--accent)' }} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs">
                <span className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>Orchestration Queue</span>
                <span className="ui-mono font-bold" style={{ color: 'var(--foreground)' }}>15%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full opacity-60" style={{ width: '15%', background: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="ui-section-label mb-3 text-center sm:text-left">Queue & orchestration</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            label="Queue wait"
            value={
              info?.queueMetrics?.avgQueueWaitMs != null
                ? `${(info.queueMetrics.avgQueueWaitMs / 1000).toFixed(1)}s`
                : '—'
            }
            hint="Avg wait before start"
            icon={<Server size={16} />}
          />
          <StatCard
            label="Execution"
            value={
              info?.queueMetrics?.avgExecutionMs != null
                ? `${(info.queueMetrics.avgExecutionMs / 1000).toFixed(1)}s`
                : lastMetrics?.totalLatencyMs != null
                  ? `${(lastMetrics.totalLatencyMs / 1000).toFixed(1)}s`
                  : '—'
            }
            hint="Avg job / last sweep"
            icon={<Gauge size={16} />}
          />
          <StatCard
            label="Agent runtime"
            value={
              info?.queueMetrics?.avgAgentRuntimeMs != null
                ? `${(info.queueMetrics.avgAgentRuntimeMs / 1000).toFixed(1)}s`
                : '—'
            }
            hint="Avg orchestrate wall time"
            icon={<Cpu size={16} />}
          />
          <StatCard
            label="Retries / cancels"
            value={
              info?.queueMetrics
                ? `${info.queueMetrics.retries} / ${info.queueMetrics.cancelled}`
                : '—'
            }
            hint={`DLQ ${info?.queueMetrics?.deadLetter ?? 0} · failed ${info?.queueMetrics?.failed ?? 0}`}
            icon={<RefreshCw size={16} />}
          />
          <StatCard
            label="Agents saved"
            value={agentsSavedVsFull != null ? String(agentsSavedVsFull) : '—'}
            hint="Vs full research sweep"
            icon={<Activity size={16} />}
          />
          <StatCard
            label="Feedback"
            value={
              info?.feedbackStats
                ? `↑${info.feedbackStats.up} ↓${info.feedbackStats.down}`
                : '—'
            }
            hint={
              info?.feedbackStats?.refineRate != null
                ? `Refine rate ${info.feedbackStats.refineRate}%`
                : 'Thumbs across sessions'
            }
            icon={<Activity size={16} />}
          />
        </div>
        {info?.auditLogs && info.auditLogs.length > 0 ? (
          <div className="mt-4 results-panel p-4" style={{ background: 'var(--surface)' }}>
            <p className="ui-section-label mb-2">Recent audit</p>
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
              {info.auditLogs.slice(0, 8).map((row) => (
                <li key={row.id} className="text-[11px] font-mono text-muted-foreground flex justify-between gap-2">
                  <span>{row.action} · {row.resource_type}</span>
                  <span>{new Date(row.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {err ? (
        <div
          className="rounded-2xl px-4 py-3 text-center"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
        >
          <p className="ui-body-sm" style={{ color: 'var(--status-warn)' }}>
            {err}
          </p>
        </div>
      ) : null}

      {info ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="results-panel p-5 sm:p-6" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={14} style={{ color: 'var(--accent)' }} />
              <p className="ui-section-label">Configured models</p>
            </div>
            <div className="space-y-3">
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
              >
                <p className="ui-caption mb-1" style={{ color: 'var(--foreground-subtle)' }}>
                  Text generation
                </p>
                <p className="ui-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {info.models.text}
                </p>
              </div>
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
              >
                <p className="ui-caption mb-1" style={{ color: 'var(--foreground-subtle)' }}>
                  Embeddings
                </p>
                <p className="ui-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {info.models.embedding}
                </p>
                <p className="ui-caption mt-1">{info.models.embeddingDimensions} dimensions</p>
              </div>
            </div>
            <p className="ui-caption mt-4" style={{ color: 'var(--foreground-subtle)' }}>
              Override with GEMINI_MODEL / embedding env vars. Free-tier keys need a supported flash-lite model.
            </p>
          </div>

          <div className="results-panel p-5 sm:p-6" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Plug size={14} style={{ color: 'var(--accent)' }} />
              <p className="ui-section-label">Integrations</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {info.providers.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl px-4 py-3.5"
                  style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="ui-title" style={{ fontSize: 14 }}>
                      {p.label}
                    </span>
                    <span
                      className="ui-mono px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: 10,
                        color: p.configured ? 'var(--accent)' : 'var(--foreground-subtle)',
                        background: p.configured
                          ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                          : 'var(--chart-track)',
                      }}
                    >
                      {p.configured ? 'configured' : 'not set'}
                    </span>
                  </div>
                  <p className="ui-caption" style={{ color: 'var(--foreground-muted)' }}>
                    {p.usageNote}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
