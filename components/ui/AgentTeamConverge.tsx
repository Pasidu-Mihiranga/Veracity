'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Circle, CheckCircle2, Loader2, AlertCircle, Ban } from 'lucide-react';
import type { ConvergeAgent, ConvergeAgentStatus } from '@/lib/agent-progress';
import { useTheme } from '@/lib/theme-provider';

const MESSAGE_SETS: Record<string, string[]> = {
  'market-trends|competitive': ['trend signals shared', 'category vector ready', 'demand cues synced'],
  'competitive|win-loss': ['feature bets attached', 'rival moves synced', 'win themes ready'],
  'win-loss|pricing': ['buyer objections shared', 'switch triggers ready'],
  'pricing|positioning': ['WTP signals shared', 'packaging cues ready'],
  'positioning|adjacent': ['messaging gaps shared', 'whitespace mapped'],
  'adjacent|execution-engine': ['threat map attached', 'ready for action'],
};

const GENERIC_MESSAGES = ['sending update', 'data shared', 'sync complete'];

function useElapsed(startedAt?: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt || !now) return '—';
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function useTick(intervalMs: number, enabled: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return tick;
}

function Waveform({
  colorFg,
  active,
  seed,
}: {
  colorFg: string;
  active: boolean;
  seed: number;
}) {
  const bars = new Array(14).fill(0);
  const duration = 0.85 + (seed % 7) * 0.08;
  const ampMin = 12 + (seed % 5) * 2;
  const ampMax = 88 + (seed % 9);

  return (
    <div
      className="wf-track flex items-end justify-center gap-[3px] h-9 w-full overflow-hidden"
      style={{
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
        ['--wf-min' as string]: `${ampMin}%`,
        ['--wf-max' as string]: `${ampMax}%`,
      }}
    >
      {bars.map((_, i) => {
        const delay = ((i * 0.09) + seed * 0.031) % 2.4;
        return (
          <span
            key={i}
            className="wf-bar"
            style={{
              background: colorFg,
              opacity: active ? 0.9 : 0.18,
              boxShadow: active ? `0 0 5px ${colorFg}66` : 'none',
              animationDelay: `${delay}s`,
              animationDuration: `${duration + (i % 3) * 0.05}s`,
              animationPlayState: active ? 'running' : 'paused',
            }}
          />
        );
      })}
    </div>
  );
}

function StatusIcon({ status, colorFg }: { status: ConvergeAgentStatus; colorFg: string }) {
  if (status === 'done') return <CheckCircle2 size={14} style={{ color: 'var(--status-ok, #10B981)' }} />;
  if (status === 'failed') return <AlertCircle size={14} style={{ color: 'var(--status-fail, #EF4444)' }} />;
  if (status === 'blocked') return <Ban size={13} style={{ color: 'var(--foreground-subtle)' }} />;
  if (status === 'queued') return <Circle size={12} style={{ color: 'var(--foreground-subtle)' }} />;
  return (
    <Loader2
      size={14}
      className="spin-slow"
      style={{ color: colorFg, filter: `drop-shadow(0 0 3px ${colorFg}66)` }}
    />
  );
}

function AgentCard({
  agent,
  transitionClass,
  showCompletionFlash,
}: {
  agent: ConvergeAgent;
  transitionClass?: string;
  showCompletionFlash: boolean;
}) {
  const { textMuted, textSubtle, text } = useTheme();
  const elapsed = useElapsed(agent.startedAt);
  const active = agent.status === 'running';
  const flash = showCompletionFlash && agent.status === 'done' && agent.completionSummary;

  return (
    <div
      className={`agent-converge-card relative flex-1 min-w-[148px] max-w-[220px] flex flex-col items-center gap-2 rounded-2xl pt-4 pb-3 px-3 ${transitionClass ?? ''}`}
      style={{
        background: active
          ? 'color-mix(in srgb, var(--surface) 88%, var(--accent) 12%)'
          : 'var(--surface-raised, var(--surface))',
        boxShadow: active ? 'var(--shadow-extruded-sm)' : 'var(--shadow-inset-sm)',
        border: `1px solid ${active ? `${agent.colorFg}44` : 'var(--border)'}`,
        opacity: agent.status === 'queued' ? 0.72 : 1,
      }}
    >
      <span
        className="absolute top-0 left-3 right-3 h-[2px] rounded-full"
        style={{
          background: active || agent.status === 'done' ? agent.colorFg : 'var(--border)',
          boxShadow: active ? `0 0 8px ${agent.colorFg}88` : 'none',
        }}
      />

      <StatusIcon status={agent.status} colorFg={agent.colorFg} />

      <div
        className="ui-mono text-[12px] font-semibold truncate max-w-full"
        style={{ color: text }}
      >
        {agent.name}
      </div>

      {agent.status === 'blocked' && agent.waitingOn ? (
        <div className="neu-pill-warning ui-mono px-2 py-0.5 rounded-full" style={{ fontSize: 9 }}>
          Waiting for {agent.waitingOn}
        </div>
      ) : (
        <div className="text-[10px] truncate max-w-full" style={{ color: active ? agent.colorFg : textSubtle }}>
          {agent.status === 'done'
            ? 'complete'
            : agent.status === 'queued'
              ? 'queued'
              : agent.status === 'failed'
                ? 'failed'
                : agent.status === 'blocked'
                  ? 'blocked'
                  : 'running'}
        </div>
      )}

      <Waveform colorFg={agent.colorFg} active={active} seed={agent.motionSeed} />

      {flash ? (
        <div className="flex flex-col items-center gap-0.5 px-1 text-center agent-converge-fade">
          <p className="ui-mono" style={{ fontSize: 10, color: 'var(--status-ok, #10B981)' }}>
            ✓ {agent.completionSummary!.headline}
          </p>
          <p className="ui-caption" style={{ color: textMuted, fontSize: 10 }}>
            {agent.completionSummary!.stats.join(' · ')}
          </p>
        </div>
      ) : (
        <>
          <div
            className="text-[10.5px] text-center truncate max-w-full px-1"
            style={{ color: textMuted }}
            title={agent.task}
          >
            {agent.task}
          </div>

          {typeof agent.progressPct === 'number' && (active || agent.status === 'done') ? (
            <div className="w-full flex flex-col gap-1 px-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="ui-mono truncate" style={{ fontSize: 9, color: agent.colorFg }}>
                  {agent.progressLabel ?? `${agent.progressPct}%`}
                </span>
                {active ? (
                  <span className="ui-mono" style={{ fontSize: 9, color: textSubtle }}>
                    {agent.progressPct}%
                  </span>
                ) : null}
              </div>
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: 'var(--background)', boxShadow: 'var(--shadow-inset-sm)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(4, Math.min(100, agent.progressPct))}%`,
                    background: `linear-gradient(90deg, ${agent.colorFg} 0%, #3D9EFF 100%)`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </>
      )}

      <div
        className="ui-mono text-[10px] px-2 py-0.5 rounded-md mt-0.5"
        style={{
          color: active ? agent.colorFg : textSubtle,
          background: active ? `${agent.colorFg}14` : 'transparent',
        }}
      >
        {agent.status === 'queued' || agent.status === 'blocked' ? '—' : elapsed}
      </div>
    </div>
  );
}

function Bubble({
  leftPct,
  colorFg,
  msgs,
  pairIndex,
  active,
}: {
  leftPct: number;
  colorFg: string;
  msgs: string[];
  pairIndex: number;
  active: boolean;
}) {
  const tick = useTick(400, active);
  const showTicks = 5;
  const gapTicks = 3;
  const period = showTicks + gapTicks;
  const totalCycle = period * msgs.length;
  const phase = (tick + pairIndex * 3) % totalCycle;
  const msgIdx = Math.floor(phase / period) % msgs.length;
  const posInMsg = phase % period;
  const visible = active && posInMsg < showTicks;

  return (
    <div
      className="absolute agent-bubble"
      style={{ left: `${leftPct}%`, top: 0, transform: 'translate(-50%, 0)' }}
    >
      <div
        className="px-2.5 py-1 rounded-lg whitespace-nowrap ui-mono"
        style={{
          fontSize: 10,
          background: 'var(--surface)',
          border: `1px solid ${colorFg}55`,
          color: colorFg,
          boxShadow: 'var(--shadow-extruded-sm)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(5px) scale(0.94)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
        }}
      >
        {msgs[msgIdx]}
      </div>
    </div>
  );
}

function BubbleLane({ agents }: { agents: ConvergeAgent[] }) {
  const n = agents.length;
  const LANE_H = 40;
  const { textSubtle } = useTheme();
  const waiting = agents.filter((a) => a.status === 'blocked' && a.waitingOn);

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {waiting.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 w-full">
          {waiting.map((a) => (
            <span
              key={`dep-${a.id}`}
              className="neu-pill ui-mono px-2.5 py-1 rounded-full"
              style={{ fontSize: 10, color: 'var(--foreground-muted)' }}
            >
              {a.name} · Waiting for {a.waitingOn}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative w-full" style={{ height: LANE_H }}>
        <div
          className="absolute left-0 right-0"
          style={{ top: LANE_H - 3, borderTop: '1px dashed var(--border)' }}
        />

        {agents.map((agent, i) => {
          const xPct = ((i + 0.5) / n) * 100;
          const active = agent.status === 'running';
          return (
            <span
              key={agent.id}
              className="absolute rounded-full"
              style={{
                left: `${xPct}%`,
                top: LANE_H - 3,
                width: 5,
                height: 5,
                transform: 'translate(-50%, -50%)',
                background: active || agent.status === 'done' ? agent.colorFg : 'var(--border)',
                boxShadow: active ? `0 0 5px ${agent.colorFg}99` : 'none',
              }}
            />
          );
        })}

        {agents.slice(0, -1).map((agent, i) => {
          const next = agents[i + 1];
          const active = agent.status === 'running';
          const leftPct = ((i + 1) / n) * 100;
          const key = `${agent.id}|${next.id}`;
          const msgs = MESSAGE_SETS[key] || GENERIC_MESSAGES;
          return (
            <Bubble
              key={agent.id}
              leftPct={leftPct}
              colorFg={agent.colorFg}
              msgs={msgs}
              pairIndex={i}
              active={active}
            />
          );
        })}
      </div>
      <span className="ui-mono uppercase tracking-wide" style={{ color: textSubtle, fontSize: 10 }}>
        agents notifying each other
      </span>
    </div>
  );
}

function CompletionChecklist({ agents }: { agents: ConvergeAgent[] }) {
  const { text, textMuted, accent } = useTheme();
  const ok = agents.every((a) => a.status === 'done' || a.status === 'failed');

  return (
    <div className="agent-converge-fade flex flex-col items-center gap-3 py-2 px-2 w-full">
      <p className="ui-mono" style={{ color: accent, fontSize: 12 }}>
        {ok ? '✓ All selected agents completed' : 'Finishing agents…'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {agents.map((a) => (
          <span
            key={a.id}
            className="neu-pill-accent ui-mono inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ fontSize: 10, color: a.status === 'failed' ? 'var(--status-fail)' : undefined }}
          >
            {a.name} {a.status === 'failed' ? '✕' : '✓'}
          </span>
        ))}
      </div>
      <p className="ui-caption" style={{ color: textMuted }}>
        Handing off to results
      </p>
      <span className="sr-only" style={{ color: text }}>
        Agent team complete
      </span>
    </div>
  );
}

export type AgentTeamConvergePhase = 'running' | 'complete' | 'exiting';

export function AgentTeamConverge({
  agents,
  phase = 'running',
}: {
  agents: ConvergeAgent[];
  phase?: AgentTeamConvergePhase;
}) {
  const { textSubtle, accent } = useTheme();
  const prevStatus = useRef<Record<string, ConvergeAgentStatus>>({});
  const agentSnapshot = useRef<Record<string, ConvergeAgent>>({});
  const [flashUntil, setFlashUntil] = useState<Record<string, number>>({});
  const [transitionById, setTransitionById] = useState<Record<string, string>>({});
  const [visibleIds, setVisibleIds] = useState<string[]>(() => agents.map((a) => a.id));

  useEffect(() => {
    for (const a of agents) agentSnapshot.current[a.id] = a;
  }, [agents]);

  // Smooth enter/leave when agents toggle
  useEffect(() => {
    const nextIds = agents.map((a) => a.id);
    setVisibleIds((prev) => {
      const merged = [...prev];
      for (const id of nextIds) {
        if (!merged.includes(id)) merged.push(id);
      }
      return merged;
    });

    const removed = visibleIds.filter((id) => !nextIds.includes(id));
    if (!removed.length) return;

    const t = window.setTimeout(() => {
      setVisibleIds((prev) => prev.filter((id) => nextIds.includes(id) || !removed.includes(id)));
    }, 280);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to agent id set changes
  }, [agents.map((a) => a.id).join('|')]);

  // Status-change-only entrance animations + completion flash
  useEffect(() => {
    const now = Date.now();
    const transitions: Record<string, string> = {};
    let flashChanged = false;
    const flashes: Record<string, number> = { ...flashUntil };

    for (const agent of agents) {
      const prev = prevStatus.current[agent.id];
      if (prev && prev !== agent.status) {
        const key = `${prev}->${agent.status}`;
        if (
          key === 'queued->running' ||
          key === 'blocked->running' ||
          key === 'queued->blocked' ||
          key === 'running->done' ||
          key === 'running->failed'
        ) {
          transitions[agent.id] = 'agent-status-pop';
        }
        if (agent.status === 'done') {
          flashes[agent.id] = now + 1800;
          flashChanged = true;
          window.setTimeout(() => {
            setFlashUntil((prev) => {
              if (!prev[agent.id]) return prev;
              const next = { ...prev };
              delete next[agent.id];
              return next;
            });
          }, 1850);
        }
      }
      prevStatus.current[agent.id] = agent.status;
    }

    if (flashChanged) setFlashUntil(flashes);

    if (Object.keys(transitions).length) {
      setTransitionById(transitions);
      const clear = window.setTimeout(() => setTransitionById({}), 520);
      return () => window.clearTimeout(clear);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map((a) => `${a.id}:${a.status}`).join('|')]);

  const byId = new Map(agents.map((a) => [a.id, a]));
  // Keep incoming domain order for stable layout; fade toggled-off via leave class
  const displayAgents = agents.filter((a) => visibleIds.includes(a.id) || byId.has(a.id));
  // Also include agents still fading out
  const leavingAgents = visibleIds
    .filter((id) => !byId.has(id))
    .map((id) => agentSnapshot.current[id])
    .filter((a): a is ConvergeAgent => !!a);
  const rowAgents = [
    ...displayAgents,
    ...leavingAgents.filter((a) => !displayAgents.some((d) => d.id === a.id)),
  ];

  const runningCount = displayAgents.filter((a) => a.status === 'running').length;
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!Object.keys(flashUntil).length) return;
    setClock(Date.now());
    const id = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [flashUntil]);

  if (phase === 'complete' || phase === 'exiting') {
    return (
      <div
        className={`w-full rounded-2xl p-4 ${phase === 'exiting' ? 'agent-converge-exit' : 'agent-converge-fade'}`}
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-extruded-sm)',
          border: '1px solid var(--border)',
        }}
      >
        <CompletionChecklist agents={agents} />
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl p-4 flex flex-col gap-4"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-extruded-sm)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="ui-mono uppercase tracking-wide" style={{ color: textSubtle, fontSize: 11 }}>
            Agent team
          </span>
        </div>
        <span
          className="neu-pill ui-mono px-2.5 py-1 rounded-full"
          style={{ color: accent, fontSize: 11 }}
        >
          {runningCount} running in parallel
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 agent-converge-row">
        {rowAgents.map((agent) => {
          const leaving = !agents.some((a) => a.id === agent.id);
          return (
            <div
              key={agent.id}
              className={`agent-converge-slot ${leaving ? 'agent-converge-leave' : 'agent-converge-enter'}`}
            >
              <AgentCard
                agent={agent}
                transitionClass={transitionById[agent.id]}
                showCompletionFlash={(flashUntil[agent.id] ?? 0) > clock}
              />
            </div>
          );
        })}
      </div>

      {displayAgents.length > 1 ? <BubbleLane agents={displayAgents} /> : null}
    </div>
  );
}

export default AgentTeamConverge;
