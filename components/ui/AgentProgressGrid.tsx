'use client';

import { useMemo } from 'react';
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

/**
 * Loading-only research progress. Hidden after completion so results stay clean.
 * Robot watches a single progress bar; compact agent chips underneath.
 */
export function AgentProgressGrid({
  queryLabel,
  userImages,
  isLoading,
  visibleTabDomains,
  getRunForDomain,
  completedCount,
  totalCount,
  isDark,
  cardBg,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
}: AgentProgressGridProps) {
  const denom = Math.max(totalCount, visibleTabDomains.length, 1);
  const pct = Math.min(100, Math.round((completedCount / denom) * 100));

  const activeLabel = useMemo(() => {
    const running = visibleTabDomains.find((d) => getRunForDomain(d)?.status === 'running');
    if (running) return DOMAIN_META[running].short;
    if (completedCount === 0) return 'Starting research';
    if (completedCount >= denom) return 'Synthesizing answer';
    return 'Agents working';
  }, [visibleTabDomains, getRunForDomain, completedCount, denom]);

  if (!isLoading) return null;

  return (
    <div className="results-panel p-5 sm:p-6" style={{ background: cardBg }} aria-busy="true">
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
          <div>
            <p className="ui-section-label mb-1.5" style={{ color: textSubtle }}>
              Researching
            </p>
            <p className="ui-title truncate" style={{ color: textMain }}>
              {queryLabel}
            </p>
          </div>

          {userImages && userImages.length > 0 ? (
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

          {/* Progress track — robot “watches” this bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="ui-caption" style={{ color: textMuted }}>
                {activeLabel}
              </span>
              <span className="ui-mono" style={{ color: accentInk }}>
                {completedCount}/{denom}
              </span>
            </div>
            <div
              className="h-2.5 w-full rounded-full overflow-hidden"
              style={{
                background: isDark ? 'rgba(15,26,40,0.95)' : 'rgba(214,228,240,0.9)',
                boxShadow: 'var(--shadow-inset-sm)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(pct, completedCount > 0 ? 8 : 4)}%`,
                  background: `linear-gradient(90deg, ${accentInk} 0%, #3D9EFF 100%)`,
                }}
              />
            </div>
          </div>

          {/* Compact agent chips — status only, no COMPLETED chrome wall */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {(visibleTabDomains.length ? visibleTabDomains : ALL_DOMAINS).map((domain) => {
              const status = getRunForDomain(domain)?.status ?? 'idle';
              const meta = DOMAIN_META[domain];
              const dAccent = domainAccent(meta, isDark);
              const live = status === 'running' || status === 'completed';
              return (
                <span
                  key={domain}
                  className="ui-mono inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{
                    fontSize: 10,
                    color: live ? dAccent : textSubtle,
                    background: live
                      ? isDark
                        ? 'rgba(0,196,255,0.08)'
                        : 'rgba(0,82,163,0.06)'
                      : 'transparent',
                    border: `1px solid ${live ? `${dAccent}33` : 'transparent'}`,
                    opacity: status === 'idle' || status === 'pending' ? 0.55 : 1,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: status === 'completed' || status === 'running' ? dAccent : textSubtle,
                      boxShadow: status === 'running' ? `0 0 6px ${dAccent}` : 'none',
                    }}
                  />
                  {meta.short}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
