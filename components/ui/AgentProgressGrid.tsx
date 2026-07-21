'use client';

import React from 'react';
import {
  Activity, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import type { AgentRun, AgentOutput } from '@/lib/agents/types';
import type { PipelineStage } from '@/types/chat-ui';
import { ALL_DOMAINS, DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';

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
};

export function AgentProgressGrid({
  queryLabel,
  userImages,
  isLoading,
  pipelineStages,
  orchLogLen,
  visibleTabDomains,
  expandedDomain,
  onSelectDomain,
  getRunForDomain,
  getOutputForDomain,
  completedCount,
  totalCount,
  isDark,
  cardBg,
  cardBg2,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
  borderC,
  neuExtrudedSm,
}: AgentProgressGridProps) {
  return (
    <div className="veracity-card p-5" style={{ background: cardBg }}>
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <p className="text-[16px] font-bold tracking-tight" style={{ color: textMain }}>
            {queryLabel}
          </p>
          {userImages && userImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {userImages.map((img, i) => (
                <img
                  key={i}
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-10 w-10 object-cover rounded-lg"
                  style={{ border: 'none', boxShadow: neuExtrudedSm }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {ALL_DOMAINS.map(d => {
              const s = getRunForDomain(d)?.status ?? 'idle';
              const m = DOMAIN_META[d];
              const dot = domainAccent(m, isDark);
              return (
                <div
                  key={d}
                  className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{
                    background: s === 'completed' || s === 'running' ? dot : (isDark ? '#2a2a2a' : '#ddd'),
                    opacity: s === 'running' || s === 'completed' ? 1 : 0.4,
                    boxShadow: s === 'running' ? `0 0 6px ${dot}55` : 'none',
                  }}
                />
              );
            })}
          </div>
          {totalCount > 0 && (
            <span className="text-[11px] font-mono font-semibold" style={{ color: textSubtle }}>
              {completedCount}/{Math.max(totalCount, 6)}
            </span>
          )}
        </div>
      </div>

      {isLoading && orchLogLen > 0 && (
        <div className="mb-4 neu-inset rounded-[16px] px-3 py-3" style={{ background: cardBg2 }}>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>
            <Activity size={11} className="shrink-0 animate-pulse" />
            <span>Pipeline</span>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[620px] flex items-center gap-2.5">
              {pipelineStages.map((stage, i) => {
                const stateColor = stage.state === 'failed'
                  ? '#0B1A2E'
                  : stage.state === 'completed' || stage.state === 'running'
                    ? accentInk
                    : textSubtle;
                const fill = stage.state === 'completed' ? '100%' : stage.state === 'running' ? '62%' : '0%';
                return (
                  <React.Fragment key={stage.id}>
                    <div className="flex flex-col items-center gap-1.5 min-w-[108px]">
                      <div
                        className="relative w-8 h-8 rounded-full overflow-hidden"
                        style={{
                          border: `1.5px solid ${stage.state === 'pending' ? borderC : stateColor}`,
                          background: stage.state === 'pending' ? 'transparent' : `${stateColor}22`,
                          boxShadow: stage.state === 'running' ? `0 0 0 1px ${stateColor}33, 0 0 10px ${stateColor}44` : 'none',
                        }}
                      >
                        <div
                          className={stage.state === 'running' ? 'animate-pulse' : ''}
                          style={{
                            position: 'absolute',
                            left: 0,
                            bottom: 0,
                            width: '100%',
                            height: fill,
                            background: `linear-gradient(180deg, ${stateColor}88 0%, ${stateColor}cc 100%)`,
                            transition: 'height 500ms ease',
                          }}
                        />
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold"
                          style={{ color: stage.state === 'pending' ? textSubtle : '#fff' }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-mono uppercase tracking-wide text-center leading-tight"
                        style={{ color: stage.state === 'pending' ? textSubtle : textMain }}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {i < pipelineStages.length - 1 && (
                      <div
                        className="relative h-2.5 w-12 rounded-full overflow-hidden"
                        style={{
                          border: 'none',
                          boxShadow: neuExtrudedSm,
                          background: isDark ? '#151515' : '#f4f4f5',
                        }}
                      >
                        <div
                          className={stage.state === 'running' ? 'animate-pulse' : ''}
                          style={{
                            height: '100%',
                            width: stage.state === 'pending' ? '0%' : stage.state === 'running' ? '55%' : '100%',
                            background: `linear-gradient(90deg, ${stateColor}99 0%, ${stateColor}dd 100%)`,
                            transition: 'width 450ms ease',
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5">
        {visibleTabDomains.map(domain => {
          const run = getRunForDomain(domain);
          const output = getOutputForDomain(domain);
          const isActive = expandedDomain === domain;
          const status = run?.status ?? (output ? 'completed' : 'idle');
          const meta = DOMAIN_META[domain];
          const dAccent = domainAccent(meta, isDark);
          return (
            <button
              key={domain}
              type="button"
              onClick={() => onSelectDomain(domain)}
              className="px-3.5 py-2.5 rounded-2xl text-left transition-all min-w-[140px]"
              style={{
                background: isActive ? (isDark ? meta.bg : meta.bgLight) : 'var(--background)',
                boxShadow: isActive
                  ? `var(--shadow-inset-sm), 0 0 0 2px ${dAccent}44`
                  : 'var(--shadow-extruded-sm)',
                border: 'none',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: isActive ? dAccent : textSubtle }}>{meta.icon}</span>
                  <span
                    className="text-[11px] font-mono font-bold uppercase tracking-wide"
                    style={{ color: isActive ? dAccent : textMuted }}
                  >
                    {meta.short}
                  </span>
                </div>
                {status === 'running' && <RefreshCw size={11} className="animate-spin" style={{ color: dAccent }} />}
                {status === 'completed' && <CheckCircle2 size={12} style={{ color: accentInk }} />}
                {status === 'failed' && <AlertCircle size={11} style={{ color: '#0B1A2E' }} />}
              </div>
              <p
                className="text-[10px] font-mono mt-1.5 uppercase tracking-wider font-medium"
                style={{
                  color: status === 'completed' ? accentInk : status === 'running' ? dAccent : textSubtle,
                }}
              >
                {status}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
