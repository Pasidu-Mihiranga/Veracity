'use client';

import { useState } from 'react';
import type { CompetitiveOutput, CompetitorFeature } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme-provider';

interface Props {
  output: CompetitiveOutput;
  product: string;
}

const STRENGTH_LABEL = {
  strong: '●●●',
  medium: '●●○',
  weak: '●○○',
  none: '○○○',
} as const;

const GAP_LABEL = {
  advantage: '▲ Advantage',
  parity: '= Parity',
  disadvantage: '▼ Gap',
} as const;

function StrengthDot({
  level,
  isDark,
}: {
  level: CompetitorFeature['yourProduct'];
  isDark: boolean;
}) {
  const palette =
    level === 'strong'
      ? { color: isDark ? '#7DD3FC' : '#0369A1', bg: isDark ? 'rgba(14,165,233,0.18)' : 'rgba(224,242,254,1)' }
      : level === 'medium'
        ? { color: isDark ? '#93C5FD' : '#1D4ED8', bg: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(239,246,255,1)' }
        : level === 'weak'
          ? { color: isDark ? '#CBD5E1' : '#1E293B', bg: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(241,245,249,1)' }
          : { color: isDark ? '#9BB0C6' : '#64748B', bg: isDark ? 'rgba(107,132,156,0.12)' : 'rgba(241,245,249,1)' };

  return (
    <span
      className="text-[13px] font-mono px-2 py-0.5 rounded tracking-widest"
      style={{ color: palette.color, background: palette.bg }}
    >
      {STRENGTH_LABEL[level]}
    </span>
  );
}

export function CompetitiveMatrix({ output, product }: Props) {
  const { isDark, textMuted, textSubtle } = useTheme();
  const matrix = output.matrix ?? [];
  const competitor = output.competitor;
  const competitorSummary = output.competitorSummary;
  const hiringSignals = output.hiringSignals ?? [];
  const recentMoves = output.recentMoves ?? [];
  const sources = output.sources ?? [];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const contextOnly = Boolean(output.contextOnly);
  const subjectLabel = contextOnly
    ? 'Subject (unverified)'
    : product;

  const gapStyle = (direction: CompetitorFeature['gapDirection']) => {
    if (direction === 'advantage') {
      return {
        color: isDark ? '#7DD3FC' : '#0369A1',
        background: isDark ? 'rgba(14,165,233,0.16)' : 'rgba(224,242,254,1)',
        borderColor: isDark ? 'rgba(56,189,248,0.35)' : 'rgba(186,230,253,1)',
      };
    }
    if (direction === 'disadvantage') {
      return {
        color: isDark ? '#E2E8F0' : '#1E293B',
        background: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(241,245,249,1)',
        borderColor: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(203,213,225,1)',
      };
    }
    return {
      color: textMuted,
      background: isDark ? 'rgba(107,132,156,0.12)' : 'rgba(241,245,249,1)',
      borderColor: isDark ? 'rgba(107,132,156,0.3)' : 'rgba(226,232,240,1)',
    };
  };

  const hoverSources =
    hoverIdx !== null && sources.length > 0
      ? sources.slice(
          hoverIdx % sources.length,
          (hoverIdx % sources.length) + 2,
        )
      : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-xs font-mono uppercase tracking-wider" style={{ color: textMuted }}>
          Competitive battlefield
        </div>
        {contextOnly ? (
          <span
            className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              color: isDark ? '#FCD34D' : '#92400E',
              background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(254,243,199,1)',
              border: `1px solid ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(252,211,77,1)'}`,
            }}
          >
            {output.contextOnlyLabel ?? 'Category context only'}
          </span>
        ) : null}
      </div>

      {contextOnly ? (
        <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
          Entity match is weak — scores below are category context, not a confirmed product-vs-peer comparison.
        </p>
      ) : null}

      {competitorSummary && (
        <p className="text-sm leading-relaxed" style={{ color: textMuted }}>
          {competitorSummary}
        </p>
      )}

      {matrix.length > 0 && (
        <div className="overflow-x-auto rounded-xl results-panel relative" style={{ opacity: contextOnly ? 0.85 : 1 }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: isDark ? 'rgba(15,26,40,0.9)' : 'rgba(214,228,240,0.7)' }}>
                <th
                  className="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider w-[40%]"
                  style={{ color: textSubtle }}
                >
                  Feature
                </th>
                <th className="text-center px-3 py-2.5 text-xs font-mono uppercase tracking-wider w-[20%] text-accent">
                  {subjectLabel}
                </th>
                <th
                  className="text-center px-3 py-2.5 text-xs font-mono uppercase tracking-wider w-[20%]"
                  style={{ color: textMuted }}
                >
                  {competitor}
                </th>
                <th
                  className="text-center px-3 py-2.5 text-xs font-mono uppercase tracking-wider w-[20%]"
                  style={{ color: textMuted }}
                >
                  Gap
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => {
                const gap = gapStyle(row.gapDirection);
                return (
                  <tr
                    key={i}
                    className="transition-colors cursor-default"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{
                      background:
                        hoverIdx === i
                          ? isDark
                            ? 'rgba(0,82,255,0.12)'
                            : 'rgba(0,82,255,0.06)'
                          : i % 2 === 0
                            ? 'transparent'
                            : isDark
                              ? 'rgba(15,26,40,0.45)'
                              : 'rgba(214,228,240,0.35)',
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>
                      {row.feature}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StrengthDot level={row.yourProduct} isDark={isDark} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StrengthDot level={row.competitor} isDark={isDark} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                        style={gap}
                      >
                        {GAP_LABEL[row.gapDirection]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hoverIdx !== null ? (
            <div className="veracity-card m-3 p-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Row evidence · {matrix[hoverIdx]?.feature}
              </span>
              {output.facts?.[hoverIdx] ? (
                <p className="text-xs text-muted-foreground">{output.facts[hoverIdx]}</p>
              ) : null}
              {hoverSources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline truncate"
                >
                  {s.title}
                </a>
              ))}
              {hoverSources.length === 0 && sources[0] ? (
                <a
                  href={sources[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline truncate"
                >
                  {sources[0].title}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {hiringSignals.length > 0 && (
          <div className="results-panel rounded-xl p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: textMuted }}>
              {contextOnly ? 'Category hiring signals' : 'Hiring Signals'}
            </p>
            {hiringSignals.slice(0, 3).map((s, i) => (
              <p key={i} className="text-xs flex items-start gap-1.5" style={{ color: textMuted }}>
                <span className="text-sky-400 shrink-0">↑</span>
                {s}
              </p>
            ))}
          </div>
        )}
        {recentMoves.length > 0 && (
          <div className="results-panel rounded-xl p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: textMuted }}>
              {contextOnly ? 'Category moves' : 'Recent Moves'}
            </p>
            {recentMoves.slice(0, 3).map((s, i) => (
              <p key={i} className="text-xs flex items-start gap-1.5" style={{ color: textMuted }}>
                <span className="text-accent shrink-0">›</span>
                {s}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
