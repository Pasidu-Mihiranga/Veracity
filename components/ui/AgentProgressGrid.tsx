'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AgentRun, AgentOutput } from '@/lib/agents/types';
import type { PipelineStage } from '@/types/chat-ui';
import { ALL_DOMAINS, type Domain } from '@/lib/domain-meta';
import { mapRunsToConvergeAgents } from '@/lib/agent-progress';
import { AgentTeamConverge, type AgentTeamConvergePhase } from '@/components/ui/AgentTeamConverge';

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
    const holdMs = reduce ? 700 : 1000;
    const fadeMs = reduce ? 0 : 300;
    const t1 = window.setTimeout(() => setPhase('exiting'), holdMs);
    const t2 = window.setTimeout(() => setPhase('hidden'), holdMs + fadeMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase]);

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
              <span className="ui-mono shrink-0" style={{ color: accentInk, fontSize: 11 }}>
                {completedCount}/{denom}
              </span>
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

          {showMeta ? (
            <>
              <div className="flex flex-wrap gap-2 pt-1">
                {pipelineStages.map((stage) => {
                  const tone =
                    stage.state === 'completed'
                      ? 'neu-pill-accent'
                      : stage.state === 'running'
                        ? 'neu-pill-positive'
                        : stage.state === 'failed'
                          ? 'neu-pill-negative'
                          : 'neu-pill';
                  return (
                    <span
                      key={stage.id}
                      className={`${tone} ui-mono px-2.5 py-1 rounded-full`}
                      style={{ fontSize: 10, color: stage.state === 'pending' ? textSubtle : undefined }}
                    >
                      {stage.label}
                    </span>
                  );
                })}
              </div>

              <div className="neu-inset-sm rounded-2xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="ui-section-label" style={{ color: textSubtle }}>
                    Orchestration log
                  </span>
                  <span className="ui-mono" style={{ color: accentInk, fontSize: 10 }}>
                    {orchLogLen} events
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {(orchestrationLines ?? []).slice(-3).map((line, idx) => (
                    <p key={`${idx}-${line}`} className="ui-caption" style={{ color: textMuted }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const AgentProgressGrid = React.memo(AgentProgressGridInner);
