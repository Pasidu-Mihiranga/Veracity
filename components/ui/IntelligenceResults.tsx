'use client';

import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import {
  ArrowUpRight, ChevronDown, ChevronRight, GitBranch, Layers, Rocket, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import type { AgentOutput, MindMapOutput } from '@/lib/agents/types';
import type { ChatMessage } from '@/types/chat-ui';
import { ArtifactRenderer } from '@/components/artifacts/ArtifactRenderer';
import { ResultsInsightCharts } from '@/components/artifacts/ResultsInsightCharts';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { ExportReportButton } from '@/components/export/ExportReportButton';
import { DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';
import {
  rateRecommendation, recommendationKey, type RecommendationRating,
} from '@/lib/feedback';

const VIZ_PRIORITY = [
  'competitive-matrix',
  'trend-chart',
  'pricing-table',
  'win-loss-scorecard',
  'positioning-gap',
  'threat-heatmap',
  'forecast-chart',
] as const;

/** Only promote a visual when it has enough structure to be useful — not empty shells. */
function hasUsefulVisual(output: AgentOutput): boolean {
  const o = output as AgentOutput & Record<string, unknown>;
  switch (output.artifactType) {
    case 'trend-chart':
      return Array.isArray(o.trends) && (o.trends as unknown[]).length > 0;
    case 'competitive-matrix':
      return Array.isArray(o.matrix) && (o.matrix as unknown[]).length > 0;
    case 'pricing-table':
      return Array.isArray(o.tiers) && (o.tiers as unknown[]).length > 0
        || Array.isArray(o.rows) && (o.rows as unknown[]).length > 0
        || Array.isArray(o.pricing) && (o.pricing as unknown[]).length > 0;
    case 'win-loss-scorecard':
      return Array.isArray(o.factors) && (o.factors as unknown[]).length > 0
        || Array.isArray(o.scorecard) && (o.scorecard as unknown[]).length > 0;
    case 'forecast-chart':
      return Array.isArray(o.points) && (o.points as unknown[]).length > 0
        || Array.isArray(o.forecast) && (o.forecast as unknown[]).length > 0;
    case 'threat-heatmap':
      return Array.isArray(o.threats) && (o.threats as unknown[]).length > 0
        || Array.isArray(o.cells) && (o.cells as unknown[]).length > 0;
    case 'positioning-gap':
      return Array.isArray(o.gaps) && (o.gaps as unknown[]).length > 0
        || Array.isArray(o.axes) && (o.axes as unknown[]).length > 0;
    default:
      return Boolean(o.facts && Array.isArray(o.facts) && (o.facts as unknown[]).length > 0);
  }
}

function pickPrimaryVisual(outputs: AgentOutput[] = []): AgentOutput | null {
  for (const type of VIZ_PRIORITY) {
    const hit = outputs.find((o) => o.artifactType === type && hasUsefulVisual(o));
    if (hit) return hit;
  }
  return null;
}

function SectionToggle({
  title,
  icon,
  open,
  onToggle,
  textMuted,
  accentInk,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  textMuted: string;
  accentInk: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-2 py-1 text-left"
    >
      <span className="results-section-title flex items-center gap-2" style={{ color: textMuted }}>
        <span style={{ color: accentInk }}>{icon}</span>
        {title}
      </span>
      <ChevronDown
        size={14}
        style={{
          color: textMuted,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 160ms ease',
        }}
      />
    </button>
  );
}

export type IntelligenceResultsProps = {
  currentResult: ChatMessage;
  currentSessionId: string | null;
  ratedRecs: Record<string, RecommendationRating>;
  onRate: (key: string, rating: RecommendationRating) => void;
  isFollowingUp: boolean;
  isLoading: boolean;
  onFollowUpSuggestion: (suggestion: string) => void;
  followUpEndRef: RefObject<HTMLDivElement | null>;
  isDark: boolean;
  cardBg: string;
  cardBg2: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  accentInk: string;
  borderC: string;
  neuExtruded: string;
  neuExtrudedSm: string;
};

export function IntelligenceResults({
  currentResult,
  currentSessionId,
  ratedRecs,
  onRate,
  isFollowingUp,
  isLoading,
  onFollowUpSuggestion,
  followUpEndRef,
  isDark,
  cardBg,
  cardBg2,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
  borderC,
  neuExtrudedSm,
}: IntelligenceResultsProps) {
  const [openViz, setOpenViz] = useState(true);
  const [openMap, setOpenMap] = useState(true);
  const [openDomains, setOpenDomains] = useState(false);
  const [openSources, setOpenSources] = useState(false);

  const outputs = currentResult.orchestratorOutput?.outputs ?? [];
  const mindMapOutput = outputs.find((o) => o.artifactType === 'mind-map') as MindMapOutput | undefined;
  const primaryVisual = useMemo(() => pickPrimaryVisual(outputs), [outputs]);
  const product = currentResult.orchestratorOutput?.product ?? '';

  const latencyLabel = (() => {
    const final = currentResult.orchestratorOutput?.metrics;
    const live = currentResult.liveMetrics;
    if (!final && !live) return null;
    const ms = final?.totalLatencyMs ?? live?.elapsedMs ?? 0;
    return `${(ms / 1000).toFixed(1)}s`;
  })();

  if (!currentResult.content) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Decision answer (hero) */}
      <section className="results-panel overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${borderC || 'var(--border)'}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={14} style={{ color: 'var(--accent)' }} />
            <span className="results-section-title">Decision</span>
            {product ? (
              <span
                className="ui-mono px-2 py-0.5 rounded-full truncate"
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                }}
              >
                {product}
              </span>
            ) : null}
            {latencyLabel ? (
              <span className="ui-mono" style={{ color: 'var(--foreground-subtle)', fontSize: 11 }}>
                {latencyLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-6 lg:p-8 flex flex-col gap-5">
          <p className="prose-answer whitespace-pre-wrap">{currentResult.content}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <ExportReportButton
              message={currentResult}
              accentInk={accentInk}
              textSubtle={textSubtle}
              cardBg2={cardBg2}
              neuExtrudedSm={neuExtrudedSm}
              variant="primary"
            />
            <span className="ui-caption" style={{ color: 'var(--foreground-subtle)' }}>
              Includes decision, recommendations, visuals, and sources
            </span>
          </div>
        </div>
      </section>

      {/* 2. Recommendations */}
      {currentResult.recommendations && currentResult.recommendations.length > 0 ? (
        <section className="results-panel p-5 lg:p-6">
          <p className="results-section-title mb-4 flex items-center gap-2">
            <Rocket size={13} style={{ color: 'var(--accent)' }} /> Recommendations
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentResult.recommendations.map((rec: {
              title?: string; rationale?: string; priority?: string; confidence?: string; score?: number; evidence?: string[];
            }, i: number) => {
              const rk = recommendationKey(rec.title ?? '', rec.rationale ?? '');
              const current = ratedRecs[rk];
              const rate = (rating: RecommendationRating) => {
                onRate(rk, rating);
                if (!currentSessionId) return;
                rateRecommendation({
                  sessionId: currentSessionId,
                  title: rec.title ?? '',
                  rationale: rec.rationale ?? '',
                  rating,
                });
              };
              return (
                <div
                  key={i}
                  className="rounded-2xl p-4 flex flex-col gap-2.5"
                  style={{
                    background: cardBg2,
                    border: `1px solid ${borderC || 'var(--border)'}`,
                  }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase"
                      style={{
                        color: rec.priority === 'immediate' ? (isDark ? '#7DD3FC' : '#0B1A2E') : accentInk,
                        background: rec.priority === 'immediate'
                          ? (isDark ? 'rgba(125,211,252,0.12)' : 'rgba(11,26,46,0.08)')
                          : 'rgba(0,196,255,0.1)',
                        border: `1px solid ${rec.priority === 'immediate' ? 'rgba(125,211,252,0.35)' : 'rgba(0,196,255,0.25)'}`,
                      }}
                    >
                      {rec.priority ?? 'strategic'}
                    </span>
                    <ConfidenceBadge
                      level={(rec.confidence as 'high' | 'medium' | 'low' | undefined)
                        ?? ((rec.score ?? 0) >= 80 ? 'high' : (rec.score ?? 0) >= 55 ? 'medium' : 'low')}
                    />
                  </div>
                  <h4 className="rec-title">{rec.title}</h4>
                  <p className="rec-body">{rec.rationale}</p>
                  {(rec.evidence?.length ?? 0) > 0 && (
                    <ul className="flex flex-col gap-1 mt-1">
                      {rec.evidence!.map((e, ei) => (
                        <li key={ei} className="text-[12px] flex items-start gap-1.5" style={{ color: textMuted }}>
                          <span className="font-mono mt-0.5 shrink-0" style={{ color: accentInk }}>›</span>{e}
                        </li>
                      ))}
                    </ul>
                  )}
                  {currentSessionId && (
                    <div className="flex items-center gap-1.5 mt-1 pt-2">
                      <button
                        type="button"
                        onClick={() => rate('up')}
                        title="Useful"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{
                          color: current === 'up' ? accentInk : textSubtle,
                          background: current === 'up' ? 'rgba(0,196,255,0.14)' : 'transparent',
                        }}
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rate('down')}
                        title="Not useful"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{
                          color: current === 'down' ? '#FCA5A5' : textSubtle,
                          background: current === 'down' ? 'rgba(252,165,165,0.12)' : 'transparent',
                        }}
                      >
                        <ThumbsDown size={14} />
                      </button>
                      {current && (
                        <span className="text-[10px] font-mono ml-1" style={{ color: current === 'up' ? accentInk : '#FCA5A5' }}>
                          {current === 'up' ? 'Validated' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Insight charts — pie + bars when structured data exists */}
      <ResultsInsightCharts message={currentResult} outputs={outputs} />

      {/* 3. Primary visual */}
      {primaryVisual ? (
        <section className="results-panel p-5 lg:p-6">
          <SectionToggle
            title="Key visual"
            icon={<Layers size={13} />}
            open={openViz}
            onToggle={() => setOpenViz((v) => !v)}
            textMuted={textMuted}
            accentInk={accentInk}
          />
          {openViz && (
            <div className="mt-4 rounded-2xl p-3 sm:p-4" style={{ background: cardBg2, border: `1px solid ${borderC || 'var(--border)'}` }}>
              <ArtifactRenderer output={primaryVisual} product={product} />
            </div>
          )}
        </section>
      ) : null}

      {/* 4. Strategy mind map */}
      {mindMapOutput?.branches?.length ? (
        <section className="results-panel p-5 lg:p-6">
          <SectionToggle
            title="Strategy map"
            icon={<GitBranch size={13} />}
            open={openMap}
            onToggle={() => setOpenMap((v) => !v)}
            textMuted={textMuted}
            accentInk={accentInk}
          />
          {openMap && (
            <div className="mt-4">
              <ArtifactRenderer output={mindMapOutput} product={product} />
            </div>
          )}
        </section>
      ) : null}

      {/* 5. Domain highlights (secondary, collapsed) */}
      {outputs.filter((o) => o.artifactType !== 'mind-map').length > 0 ? (
        <section className="results-panel p-5 lg:p-6">
          <SectionToggle
            title="Domain details"
            icon={<Layers size={13} />}
            open={openDomains}
            onToggle={() => setOpenDomains((v) => !v)}
            textMuted={textMuted}
            accentInk={accentInk}
          />
          {openDomains && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {outputs
                .filter((o) => o.artifactType !== 'mind-map' && o.artifactType !== primaryVisual?.artifactType)
                .slice(0, 6)
                .map((o, i) => {
                  const domainMeta = DOMAIN_META[o.domain as Domain];
                  return (
                    <div
                      key={`${o.domain}-${i}`}
                      className="rounded-xl p-4"
                      style={{
                        background: cardBg2,
                        borderTop: `1px solid ${borderC || 'var(--border)'}`,
                        borderRight: `1px solid ${borderC || 'var(--border)'}`,
                        borderBottom: `1px solid ${borderC || 'var(--border)'}`,
                        borderLeft: `3px solid ${domainMeta?.color ?? accentInk}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          {domainMeta && <span style={{ color: domainMeta.color }}>{domainMeta.icon}</span>}
                          <span
                            className="text-[12px] font-mono font-bold uppercase tracking-wide"
                            style={{ color: domainMeta ? domainAccent(domainMeta, isDark) : textMuted }}
                          >
                            {domainMeta?.short ?? o.domain}
                          </span>
                        </div>
                        <ConfidenceBadge level={o.confidence} />
                      </div>
                      <p className="text-[13px] leading-relaxed" style={{ color: textMain }}>
                        {o.interpretation?.[0] || o.facts?.[0] || 'No highlight available.'}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      ) : null}

      {/* Dig deeper */}
      {currentResult.suggestions && currentResult.suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="results-section-title">Dig deeper</span>
          {currentResult.suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              disabled={isFollowingUp || isLoading}
              onClick={() => {
                followUpEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                requestAnimationFrame(() => onFollowUpSuggestion(sug));
              }}
              className="ui-body-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all disabled:opacity-45"
              style={{
                background: cardBg2,
                border: `1px solid ${borderC || 'var(--border)'}`,
                color: textMuted,
              }}
            >
              {sug} <ChevronRight size={11} />
            </button>
          ))}
        </div>
      ) : null}

      {/* 6. Sources (collapsed) */}
      {currentResult.sources && currentResult.sources.length > 0 ? (
        <section className="results-panel p-5">
          <SectionToggle
            title={`Sources (${currentResult.sources.length})`}
            icon={<ArrowUpRight size={13} />}
            open={openSources}
            onToggle={() => setOpenSources((v) => !v)}
            textMuted={textMuted}
            accentInk={accentInk}
          />
          {openSources && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {currentResult.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-chip"
                >
                  {source.title} <ArrowUpRight size={9} />
                </a>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
