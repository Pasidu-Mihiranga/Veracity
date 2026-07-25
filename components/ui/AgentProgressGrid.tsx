'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AgentRun, AgentOutput } from '@/lib/agents/types';
import type { PipelineStage } from '@/types/chat-ui';
import { ALL_DOMAINS, type Domain } from '@/lib/domain-meta';
import { mapRunsToConvergeAgents } from '@/lib/agent-progress';
import { AgentTeamConverge, type AgentTeamConvergePhase } from '@/components/ui/AgentTeamConverge';
import { ThinkingTimeline } from '@/components/ui/ThinkingTimeline';
import { LiveOrchestratorView } from '@/components/ui/LiveOrchestratorView';
import { AgentCollaborationGraph } from '@/components/ui/AgentCollaborationGraph';
import { MissionSummaryCard } from '@/components/ui/MissionSummaryCard';
import { featureFlags } from '@/lib/feature-flags';

export type AgentProgressGridProps = {
  queryLabel: string;
  userImages?: Array<{ dataUrl: string; name: string }>;
  isLoading: boolean;
  pipelineStages: PipelineStage[];
  orchLogLen: number;
  visibleTabDomains: Domain[];
  expandedDomain: Domain | null;
  onSelectDomain: (domain: Domain) => void;
  getRunForDomain: (domain: Domain) => AgentRun | undefined;
  getOutputForDomain: (domain: Domain) => AgentOutput | undefined;
  completedCount: number;
  totalCount: number;
  isDark: boolean;
  cardBg: string;
  cardBg2: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  accentInk: string;
  borderC: string;
  neuExtrudedSm: string;
  orchestrationLines?: string[];
  selectedAgentIds?: string[];
  product?: string;
  competitor?: string;
  progressPct?: number;
  missionSummary?: Record<string, unknown> | null;
  missionSteps?: Array<{ id: string; label: string; agentId: string; dependsOn?: string[]; rationale?: string }>;
  activeJobId?: string | null;
  onCancelJob?: () => void;
  onHidden?: () => void;
};

type GridPhase = 'hidden' | AgentTeamConvergePhase;

/**
 * Live agent-team converge view while research runs.
 * Holds a ~1s completion checklist after isLoading flips false, then fades out.
 */
function AgentProgressGridInner({
  queryLabel,
  userImages,
  isLoading,
  pipelineStages,
  orchLogLen,
  orchestrationLines,
  visibleTabDomains,
  getRunForDomain,
  getOutputForDomain,
  completedCount,
  totalCount,
  isDark,
  cardBg,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
  selectedAgentIds,
  product,
  competitor,
  progressPct,
  missionSummary,
  missionSteps,
  activeJobId,
  onCancelJob,
  onHidden,
}: AgentProgressGridProps) {
  const [phase, setPhase] = useState<GridPhase>('hidden');
  const [tick, setTick] = useState(0);

  // Soft progress estimates refresh while running
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (isLoading) {
      setPhase('running');
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading || phase !== 'running') return;
    setPhase('complete');
  }, [isLoading, phase]);

  useEffect(() => {
    if (phase !== 'complete') return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const holdMs = reduce ? 200 : 400;
    const fadeMs = reduce ? 0 : 200;
    const t1 = window.setTimeout(() => setPhase('exiting'), holdMs);
    const t2 = window.setTimeout(() => setPhase('hidden'), holdMs + fadeMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'hidden' && onHidden) {
      onHidden();
    }
  }, [phase, onHidden]);

  const domains = visibleTabDomains.length ? visibleTabDomains : [...ALL_DOMAINS];

  const convergeAgents = useMemo(
    () =>
      mapRunsToConvergeAgents({
        domains,
        getRunForDomain,
        getOutputForDomain,
        orchestrationLines,
        isDark,
        now: Date.now(),
      }),
    // tick forces soft-progress refresh while running
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domains, getRunForDomain, getOutputForDomain, orchestrationLines, isDark, tick, phase],
  );

  const agentRuns = useMemo(
    () =>
      domains
        .map((d) => getRunForDomain(d))
        .filter((r): r is AgentRun => Boolean(r)),
    [domains, getRunForDomain, tick, phase],
  );

  const denom = Math.max(totalCount, domains.length, 1);

  if (phase === 'hidden') return null;

  const showMeta = phase === 'running';

  return (
    <div
      className={`results-panel p-5 sm:p-6 ${phase === 'exiting' ? 'agent-converge-exit' : ''}`}
      style={{ background: cardBg }}
      aria-busy={phase === 'running'}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="shrink-0 flex flex-col items-center gap-1">
          <img
            src="/robot.avif"
            alt=""
            width={72}
            height={84}
            className="brand-mascot w-14 h-auto sm:w-16 animate-float drop-shadow-md"
            draggable={false}
          />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-section-label mb-1.5" style={{ color: textSubtle }}>
                {phase === 'running' ? 'Researching' : 'Agents complete'}
              </p>
              <p className="ui-title truncate" style={{ color: textMain }}>
                {queryLabel}
              </p>
            </div>
            {showMeta ? (
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="ui-mono" style={{ color: accentInk, fontSize: 11 }}>
                  {typeof progressPct === 'number'
                    ? `${progressPct}% · ${completedCount}/${denom}`
                    : `${completedCount}/${denom}`}
                </span>
                {activeJobId && onCancelJob ? (
                  <button
                    type="button"
                    onClick={onCancelJob}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600"
                  >
                    Cancel job
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {userImages && userImages.length > 0 && showMeta ? (
            <div className="flex flex-wrap gap-2">
              {userImages.map((img, i) => (
                <img
                  key={i}
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-9 w-9 object-cover rounded-lg"
                  style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
                />
              ))}
            </div>
          ) : null}

          <AgentTeamConverge
            agents={convergeAgents}
            phase={phase as AgentTeamConvergePhase}
          />

          {missionSummary && showMeta ? (
            <MissionSummaryCard summary={missionSummary} />
          ) : null}

          {featureFlags.orchestratorView ? (
            <div className="grid grid-cols-1 gap-3 pt-1">
              <LiveOrchestratorView
                agentRuns={agentRuns}
                pipelineStages={pipelineStages}
                selectedAgentIds={selectedAgentIds}
                isLoading={phase === 'running'}
              />
              <ThinkingTimeline lines={orchestrationLines} agentRuns={agentRuns} />
              <AgentCollaborationGraph
                product={product}
                competitor={competitor}
                agentRuns={agentRuns}
                selectedAgentIds={selectedAgentIds}
                missionSteps={missionSteps}
              />
            </div>
          ) : null}

          {showMeta ? (
            <div
              className="veracity-card flex flex-col gap-4 p-4 sm:p-5 mt-1"
              style={{ background: isDark ? 'var(--surface-raised)' : 'var(--card)' }}
            >
              {/* Pipeline stepper — clear active vs pending vs done */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="ui-section-label" style={{ color: textSubtle }}>
                    Pipeline
                  </span>
                  <span className="ui-mono" style={{ color: accentInk, fontSize: 10 }}>
                    {pipelineStages.filter((s) => s.state === 'completed').length}/
                    {pipelineStages.length} stages
                  </span>
                </div>
                <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  {pipelineStages.map((stage, i) => {
                    const isRunning = stage.state === 'running';
                    const isDone = stage.state === 'completed';
                    const isFailed = stage.state === 'failed';
                    const isPending = stage.state === 'pending';
                    return (
                      <li key={stage.id} className="flex items-center gap-1.5">
                        {i > 0 ? (
                          <span
                            aria-hidden
                            className="hidden sm:block w-4 h-px shrink-0"
                            style={{
                              background: isDone || isRunning || isFailed
                                ? 'color-mix(in srgb, var(--accent) 45%, transparent)'
                                : 'var(--border)',
                            }}
                          />
                        ) : null}
                        <span
                          className="inline-flex items-center gap-1.5 ui-mono px-2.5 py-1.5 rounded-full border transition-colors"
                          style={{
                            fontSize: 10,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: isRunning || isDone
                              ? accentInk
                              : isFailed
                                ? 'var(--destructive, #DC2626)'
                                : textSubtle,
                            background: isRunning
                              ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                              : isDone
                                ? 'color-mix(in srgb, var(--accent) 8%, transparent)'
                                : isFailed
                                  ? 'rgba(220,38,38,0.08)'
                                  : 'transparent',
                            borderColor: isRunning
                              ? 'color-mix(in srgb, var(--accent) 40%, transparent)'
                              : isDone
                                ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                                : isFailed
                                  ? 'rgba(220,38,38,0.28)'
                                  : 'var(--border)',
                            boxShadow: isRunning
                              ? '0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)'
                              : 'none',
                            opacity: isPending ? 0.55 : 1,
                          }}
                        >
                          <span
                            className={`inline-block shrink-0 ${isRunning ? 'live-dot' : 'w-1.5 h-1.5 rounded-full'}`}
                            style={
                              isRunning
                                ? undefined
                                : {
                                    background: isDone
                                      ? '#10B981'
                                      : isFailed
                                        ? '#DC2626'
                                        : 'var(--foreground-subtle)',
                                  }
                            }
                          />
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Orchestration log — inset well with real padding, not a stadium pill */}
              <div
                className="rounded-xl px-4 py-3.5 flex flex-col gap-3"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.22)' : 'var(--muted)',
                  boxShadow: 'var(--shadow-inset-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="ui-section-label" style={{ color: textSubtle }}>
                    Orchestration log
                  </span>
                  <span
                    className="ui-mono px-2 py-0.5 rounded-md"
                    style={{
                      fontSize: 10,
                      color: accentInk,
                      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                    }}
                  >
                    {orchLogLen} events
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
                  {(orchestrationLines ?? []).slice(-4).map((line, idx, arr) => {
                    const isLatest = idx === arr.length - 1;
                    return (
                      <li
                        key={`${idx}-${line}`}
                        className="flex items-start gap-2.5"
                      >
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            background: isLatest ? accentInk : 'var(--foreground-subtle)',
                            opacity: isLatest ? 1 : 0.45,
                          }}
                        />
                        <p
                          className="ui-caption m-0"
                          style={{
                            color: isLatest ? textMain : textMuted,
                            fontWeight: isLatest ? 500 : 400,
                          }}
                        >
                          {line}
                        </p>
                      </li>
                    );
                  })}
                  {(orchestrationLines ?? []).length === 0 ? (
                    <li className="ui-caption" style={{ color: textSubtle }}>
                      Waiting for orchestration events…
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const AgentProgressGrid = React.memo(AgentProgressGridInner);
