'use client';

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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

  useLayoutEffect(() => {
    if ((phase === 'hidden' || phase === 'exiting') && onHidden) {
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
      className={`results-panel p-5 sm:p-6 mb-2 shadow-lg border border-accent/15 rounded-2xl transition-all duration-300 ${
        phase === 'exiting' ? 'agent-converge-exit' : ''
      }`}
      style={{ background: cardBg }}
      aria-busy={phase === 'running'}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="shrink-0 flex flex-col items-center gap-1">
          <img
            src="/robot.avif"
            alt=""
            width={64}
            height={76}
            className="brand-mascot w-12 h-auto sm:w-14 animate-float drop-shadow-md"
            draggable={false}
          />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-section-label mb-1 uppercase tracking-wider text-[11px] font-semibold" style={{ color: textSubtle }}>
                {totalCount === 0 ? 'THINKING' : phase === 'running' ? 'RESEARCHING' : 'ANALYSIS COMPLETE'}
              </p>
              <p className="ui-title truncate font-semibold text-base sm:text-lg" style={{ color: textMain }}>
                {queryLabel}
              </p>
            </div>
            {showMeta && totalCount > 0 ? (
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="ui-mono px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    color: accentInk,
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                  }}
                >
                  {typeof progressPct === 'number'
                    ? `${progressPct}% · ${completedCount}/${denom}`
                    : `${completedCount}/${denom}`}
                </span>
                {activeJobId && onCancelJob ? (
                  <button
                    type="button"
                    onClick={onCancelJob}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Cancel
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
                  className="h-8 w-8 object-cover rounded-lg"
                  style={{ boxShadow: 'var(--shadow-extruded-sm)' }}
                />
              ))}
            </div>
          ) : null}

          {/* Running Animation */}
          {totalCount === 0 || convergeAgents.filter(a => a.status === 'running' || a.status === 'done' || a.status === 'failed').length === 0 ? (
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-accent/5 border border-accent/15 mt-1">
              <div className="wf-track flex items-end gap-1 h-5">
                {[40, 75, 30, 90, 50, 85, 45, 95, 60, 30, 80, 50, 70, 40].map((h, i) => (
                  <span
                    key={i}
                    className="wf-bar bg-accent rounded-full"
                    style={{
                      width: 3,
                      height: `${h}%`,
                      animationDelay: `${(i % 5) * 0.15}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono font-medium text-accent animate-pulse">
                Thinking and drafting direct response...
              </span>
            </div>
          ) : (
            <AgentTeamConverge
              agents={convergeAgents}
              phase={phase as AgentTeamConvergePhase}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const AgentProgressGrid = React.memo(AgentProgressGridInner);
