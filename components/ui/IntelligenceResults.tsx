'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowUpRight, ChevronDown, ChevronRight, GitBranch, Layers, Rocket, ThumbsDown, ThumbsUp, Terminal, ShieldCheck,
} from 'lucide-react';
import type {
  AgentOutput,
  EvidenceClaimBinding,
  EvidenceSupportLevel,
  MindMapOutput,
  Recommendation,
} from '@/lib/agents/types';
import type { ChatMessage, ProductViewMode } from '@/types/chat-ui';
import { ArtifactRenderer } from '@/components/artifacts/ArtifactRenderer';
import { ResultsInsightCharts } from '@/components/artifacts/ResultsInsightCharts';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { ExportReportButton } from '@/components/export/ExportReportButton';
import { EvidenceStrengthMeter } from '@/components/ui/EvidenceStrengthMeter';
import { EvidenceCoverageRadar } from '@/components/ui/EvidenceCoverageRadar';
import { EvidenceTrail } from '@/components/ui/EvidenceTrail';
import { SourceTrustBadge } from '@/components/ui/SourceTrustBadge';
import { ExecutiveBoardMode } from '@/components/ui/ExecutiveBoardMode';
import { StrategyCanvas } from '@/components/ui/StrategyCanvas';
import { MissionSummaryCard } from '@/components/ui/MissionSummaryCard';
import { ResearchWorkflowPack } from '@/components/ui/ResearchWorkflowPack';
import { MarketBriefingSection } from '@/components/artifacts/MarketBriefingSection';
import { DecisionSupportPack } from '@/components/ui/DecisionSupportPack';
import { ResearchReplay } from '@/components/ui/ResearchReplay';
import { ScenarioCompare } from '@/components/ui/ScenarioCompare';
import { CompetitiveTimeline } from '@/components/ui/CompetitiveTimeline';
import { FormattedResearchContent } from '@/components/ui/FormattedResearchContent';
import { DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';
import { featureFlags } from '@/lib/feature-flags';
import {
  rateRecommendation, recommendationKey, type RecommendationRating,
} from '@/lib/feedback';
import { confidenceFromRecLevel } from '@/lib/decision-policy';
import { selectReportTemplate } from '@/lib/agents/report-templates';

const VIZ_PRIORITY = [
  'competitive-matrix',
  'trend-chart',
  'pricing-table',
  'win-loss-scorecard',
  'positioning-gap',
  'threat-heatmap',
  'scenario-distribution',
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
    case 'scenario-distribution':
    case 'forecast-chart':
      return typeof o.swarmSize === 'number' && o.swarmSize > 0
        && (Array.isArray(o.distribution) && (o.distribution as unknown[]).length > 0
          || Array.isArray(o.scenarioObservations) && (o.scenarioObservations as unknown[]).length > 0
          || Array.isArray(o.perspectives) && (o.perspectives as unknown[]).length > 0);
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
    const hit = outputs.find((o) => {
      if (o.artifactType !== type || !hasUsefulVisual(o)) return false;
      if (o.decisionUseSuppressed) return false;
      // Never promote empty/soft category shells as the "Key visual"
      if (o.contextOnly && o.artifactType === 'competitive-matrix') {
        const matrix = (o as AgentOutput & { matrix?: unknown[] }).matrix;
        if (!Array.isArray(matrix) || matrix.length === 0) return false;
      }
      return true;
    });
    if (hit) return hit;
  }
  return null;
}

function modeLayout(_mode?: ProductViewMode) {
  return {
    showKeyVisual: true,
    /** Show the key comparison visual / radar / matrix directly on the main path */
    keyVisualOnShortPath: true,
    showMindMap: false,
    showBusinessCanvas: true,
    showAnalyst: false,
    showSourcesDefault: false,
    showDev: false,
    useProgressiveAnalysis: true,
    answerLabel: 'Executive Summary & Key Takeaways',
    recsLabel: 'Recommended Strategic Actions',
  };
}

function trustLine(opts: {
  sourceCount: number;
  qualityGate?: number;
  pricingCoverage?: number;
  qualityAbstain?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.sourceCount > 0) parts.push(`Based on ${opts.sourceCount} source${opts.sourceCount === 1 ? '' : 's'}`);
  if (opts.qualityAbstain) {
    parts.push('we found a name match, but we have not fully confirmed it is the exact business or product you meant');
  } else if (typeof opts.qualityGate === 'number') {
    parts.push(opts.qualityGate >= 0.7 ? 'evidence looks solid' : 'evidence is mixed, so double-check before acting on it');
  }
  if (typeof opts.pricingCoverage === 'number' && opts.pricingCoverage < 0.15) {
    parts.push('pricing is still unclear');
  }
  return parts.join(' · ');
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
  compareBaseline?: ChatMessage | null;
  onRequestFullSweepCompare?: () => void;
  onClearCompare?: () => void;
  viewMode?: ProductViewMode;
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
  compareBaseline,
  onRequestFullSweepCompare,
  onClearCompare,
  viewMode = 'executive',
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
  const [openMap, setOpenMap] = useState(false);
  const [openAnalyst, setOpenAnalyst] = useState(false);
  const [openDevDiagnostics, setOpenDevDiagnostics] = useState(false);
  const [openSources, setOpenSources] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  const layout = modeLayout(viewMode);

  useEffect(() => {
    setOpenAnalyst(layout.showAnalyst);
    setOpenDevDiagnostics(layout.showDev);
    setOpenSources(layout.showSourcesDefault);
    setOpenMap(layout.showMindMap);
    setOpenViz(true);
    setShowFullAnalysis(!layout.useProgressiveAnalysis);
  }, [viewMode, layout.showAnalyst, layout.showDev, layout.showSourcesDefault, layout.showMindMap, layout.useProgressiveAnalysis]);

  const outputs = currentResult.orchestratorOutput?.outputs ?? [];
  const mindMapOutput = outputs.find((o) => o.artifactType === 'mind-map') as MindMapOutput | undefined;
  const primaryVisual = useMemo(() => pickPrimaryVisual(outputs), [outputs]);
  const product = currentResult.orchestratorOutput?.product ?? '';
  const qualityAbstain = Boolean(
    currentResult.orchestratorOutput?.quality?.shouldAbstainFromStrongClaims,
  );
  const pricingAxis = currentResult.orchestratorOutput?.evidenceCoverage?.find((a) => a.id === 'pricing');
  const trust = trustLine({
    sourceCount: currentResult.sources?.length ?? 0,
    qualityGate: currentResult.orchestratorOutput?.quality?.qualityGate,
    pricingCoverage: pricingAxis?.score,
    qualityAbstain,
  });

  const latencyLabel = (() => {
    const final = currentResult.orchestratorOutput?.metrics;
    const live = currentResult.liveMetrics;
    if (!final && !live) return null;
    const ms = final?.totalLatencyMs ?? live?.elapsedMs ?? 0;
    return `${(ms / 1000).toFixed(1)}s`;
  })();

  const isTier0 =
    currentResult.orchestratorOutput?.selectionMeta?.tier === 0 ||
    (outputs.length === 0 && (!currentResult.recommendations || currentResult.recommendations.length === 0));

  const showDeep = showFullAnalysis || !layout.useProgressiveAnalysis;
  const showKeyVisual = Boolean(
    primaryVisual && (
      layout.keyVisualOnShortPath
      || (showDeep && (layout.showKeyVisual || showFullAnalysis))
    ),
  );
  const showMindMap = Boolean(showDeep && (layout.showMindMap || showFullAnalysis) && mindMapOutput?.branches?.length);
  const showAnalystBlock = Boolean(showDeep && (layout.showAnalyst || showFullAnalysis) && !isTier0);
  const showSources = Boolean(showDeep && (currentResult.sources?.length ?? 0) > 0);
  const showBusinessExtras = Boolean(layout.showBusinessCanvas && !isTier0);
  const showBusinessDeep = Boolean(showBusinessExtras && showDeep);

  if (!currentResult.content) return null;

  const isDevMode = layout.showDev;

  return (
    <div className="flex flex-col gap-5">
      {currentResult.streamError ? (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{
            color: 'var(--foreground)',
            background: 'color-mix(in srgb, var(--destructive, #dc2626) 10%, var(--card))',
            border: '1px solid color-mix(in srgb, var(--destructive, #dc2626) 35%, transparent)',
          }}
        >
          <p className="font-medium">{currentResult.streamError.userMessage}</p>
          {isDevMode && currentResult.streamError.detail ? (
            <p className="ui-mono mt-2 text-[11px] opacity-90 whitespace-pre-wrap">
              [{currentResult.streamError.code}] {currentResult.streamError.detail}
              {currentResult.streamError.correlationId
                ? `\nReference: ${currentResult.streamError.correlationId}`
                : ''}
            </p>
          ) : null}
          {!isDevMode && currentResult.streamError.correlationId ? (
            <p className="mt-1.5 text-[11px]" style={{ color: textMuted }}>
              Reference: {currentResult.streamError.correlationId}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Level 1: Hero Section (Direct Answer) */}
      <section className="results-panel overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-5 sm:py-3.5"
          style={{ borderBottom: `1px solid ${borderC || 'var(--border)'}` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Layers size={14} style={{ color: 'var(--accent)' }} />
            <span className="results-section-title text-sm sm:text-base">{layout.answerLabel}</span>
            {(() => {
              const template = selectReportTemplate(
                currentResult.content || product,
                currentResult.orchestratorOutput?.researchIntent,
              );
              return (
                <span
                  className="ui-mono px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-semibold"
                  style={{
                    color: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                  }}
                >
                  {template.badge}
                </span>
              );
            })()}
            {isDevMode && latencyLabel ? (
              <span className="ui-mono text-[10px] sm:text-[11px]" style={{ color: 'var(--foreground-subtle)' }}>
                {latencyLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
          <FormattedResearchContent content={currentResult.content} />
          {trust ? (
            <p className="text-[11px] sm:text-[12px] leading-relaxed" style={{ color: textMuted }}>
              {trust}
            </p>
          ) : null}
          {!isTier0 ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
              <ExportReportButton
                message={currentResult}
                accentInk={accentInk}
                textSubtle={textSubtle}
                cardBg2={cardBg2}
                neuExtrudedSm={neuExtrudedSm}
                variant="primary"
              />
              {(viewMode === 'executive' || viewMode === 'business') ? (
                <ExecutiveBoardMode message={currentResult} />
              ) : null}
              {onRequestFullSweepCompare && (viewMode === 'analyst' || viewMode === 'developer') ? (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onRequestFullSweepCompare}
                  className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1.5 rounded border border-accent/20 bg-accent/5 text-accent disabled:opacity-50"
                >
                  Compare with full sweep
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/*
        What we already knew, before what the agents went and found.
        A market we have been collecting on for months answers the question
        better than a fresh web sweep can, so it goes above the sweep's own
        output rather than below it.
      */}
      <MarketBriefingSection briefing={currentResult.orchestratorOutput?.marketBriefing} />

      <ResearchWorkflowPack output={currentResult.orchestratorOutput} />
      <DecisionSupportPack
        output={currentResult.orchestratorOutput}
        viewMode={viewMode}
        sessionId={currentSessionId}
      />

      {/* Level 2: Actionable Recommendations */}
      {currentResult.recommendations && currentResult.recommendations.length > 0 ? (
        <section className="results-panel p-5 lg:p-6">
          <p className="results-section-title mb-4 flex items-center gap-2">
            <Rocket size={13} style={{ color: 'var(--accent)' }} /> {layout.recsLabel}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentResult.recommendations.map((rec: Partial<Recommendation> & {
              score?: number;
              evidenceStatus?: EvidenceSupportLevel;
              evidenceBindings?: EvidenceClaimBinding[];
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
                if (featureFlags.decisionMemory && (rating === 'up' || rating === 'down')) {
                  const decision = rating === 'up' ? 'accepted' : 'rejected';
                  const reason = rating === 'up'
                    ? `Accepted because ${(rec.rationale ?? '').split(/[.!?]/)[0] || 'recommendation matched strategy'}`
                    : `Rejected because ${(rec.rationale ?? '').split(/[.!?]/)[0] || 'did not fit current priorities'}`;
                  void fetch('/api/decisions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: rec.title,
                      rationale: rec.rationale,
                      decision,
                      reason,
                      confidence: confidenceFromRecLevel(rec.confidence),
                      sessionId: currentSessionId,
                      sourceRecommendationKey: rk,
                      evidenceUrls: rec.sourceUrls ?? [],
                    }),
                  }).catch(() => {});
                }
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
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-[10px] font-mono font-semibold text-accent border border-accent/20 bg-accent/5 rounded px-1.5 py-0.5">
                      #{rec.rank ?? i + 1}
                    </span>
                    <h4 className="rec-title">{rec.title}</h4>
                  </div>
                  <p className="rec-body">{rec.rationale}</p>
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
                    {rec.evidenceStatus ? (
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                        rec.evidenceStatus === 'supported'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : rec.evidenceStatus === 'weakly-supported'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        {rec.evidenceStatus.replace('-', ' ')}
                      </span>
                    ) : null}
                    {rec.impact ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                        Impact {rec.impact}
                      </span>
                    ) : null}
                    {rec.effort ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                        Effort {rec.effort}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
                    {rec.timing ? <p><span className="font-mono uppercase">Timing:</span> {rec.timing}</p> : null}
                    {rec.ownerSuggestion ? <p><span className="font-mono uppercase">Owner:</span> {rec.ownerSuggestion}</p> : null}
                    {rec.riskOfInaction ? <p><span className="font-mono uppercase">Risk of inaction:</span> {rec.riskOfInaction}</p> : null}
                    {rec.falsifier ? <p><span className="font-mono uppercase">Falsifier:</span> {rec.falsifier}</p> : null}
                    {(rec.dependencies?.length ?? 0) > 0 ? (
                      <p><span className="font-mono uppercase">Depends on:</span> {rec.dependencies!.join(' · ')}</p>
                    ) : null}
                    {isDevMode && rec.learningAdjustment?.delta ? (
                      <p className={rec.learningAdjustment.delta > 0 ? 'text-emerald-600' : 'text-amber-700'}>
                        <span className="font-mono uppercase">Learning:</span> {rec.learningAdjustment.delta > 0 ? '+' : ''}{rec.learningAdjustment.delta} · {rec.learningAdjustment.reason}
                      </p>
                    ) : null}
                  </div>
                  {(viewMode === 'analyst' || viewMode === 'developer') ? (
                    <EvidenceTrail
                      evidence={rec.evidence}
                      sourceUrls={rec.sourceUrls}
                      sources={currentResult.sources}
                      evidenceBindings={rec.evidenceBindings}
                    />
                  ) : null}
                  {currentSessionId && (
                    <div className="flex items-center gap-1.5 mt-1 pt-2">
                      <button
                        type="button"
                        onClick={() => rate('up')}
                        title="Validate recommendation"
                        className="p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                        style={{
                          color: current === 'up' ? accentInk : textSubtle,
                          background: current === 'up' ? 'rgba(0,196,255,0.14)' : 'transparent',
                        }}
                      >
                        <ThumbsUp size={13} /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => rate('down')}
                        title="Reject recommendation"
                        className="p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                        style={{
                          color: current === 'down' ? '#FCA5A5' : textSubtle,
                          background: current === 'down' ? 'rgba(252,165,165,0.12)' : 'transparent',
                        }}
                      >
                        <ThumbsDown size={13} /> Reject
                      </button>
                      {current && (
                        <span className="text-[10px] font-mono ml-1" style={{ color: current === 'up' ? accentInk : '#FCA5A5' }}>
                          {current === 'up' ? 'Accepted' : 'Rejected'}
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

      {/* Pricing gap callout (Business+) — thin, plain language */}
      {showBusinessExtras && typeof pricingAxis?.score === 'number' && pricingAxis.score < 0.15 ? (
        <div
          className="px-4 py-3 rounded-xl text-[13px] leading-relaxed"
          style={{
            background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(254,243,199,0.7)',
            border: `1px solid ${isDark ? 'rgba(245,158,11,0.28)' : 'rgba(217,119,6,0.25)'}`,
            color: textMuted,
          }}
        >
          Pricing wasn’t covered in this pass. Ask a pricing follow-up or enable Pricing in the agent drawer for a fuller cost picture.
        </div>
      ) : null}

      {/* Dig deeper — early, so execs act without scrolling the dump */}
      {currentResult.suggestions && currentResult.suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="results-section-title">Dig deeper</span>
          {currentResult.suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              disabled={isFollowingUp || isLoading}
              onClick={() => { onFollowUpSuggestion(sug); }}
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

      {/* Progressive disclosure for Executive / Business */}
      {layout.useProgressiveAnalysis && !showFullAnalysis && !isTier0 ? (
        <button
          type="button"
          onClick={() => setShowFullAnalysis(true)}
          className="self-start text-[13px] font-medium px-3 py-2 rounded-lg transition-colors"
          style={{
            color: accentInk,
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          }}
        >
          Show full analysis
        </button>
      ) : null}

      {layout.useProgressiveAnalysis && showFullAnalysis ? (
        <button
          type="button"
          onClick={() => setShowFullAnalysis(false)}
          className="self-start text-[12px] px-2 py-1"
          style={{ color: textSubtle }}
        >
          Hide full analysis
        </button>
      ) : null}

      {/* Deep layers — gated by mode + progressive toggle */}
      {showKeyVisual && primaryVisual ? (
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
            <div className="mt-4 rounded-2xl p-3 sm:p-4" style={{ background: cardBg2, border: `1px solid ${borderC || 'var(--border)'}`, opacity: primaryVisual.contextOnly || qualityAbstain ? 0.9 : 1 }}>
              {(primaryVisual.contextOnly || qualityAbstain) ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-mono uppercase tracking-wider" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>
                    Early directional view only — this is not yet a confirmed product-vs-product comparison
                  </p>
                  <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--surface-raised)', border: `1px solid ${borderC || 'var(--border)'}` }}>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: textMain }}>
                      This chart is hidden because it would be misleading right now.
                    </h4>
                    <p className="text-[13px] leading-relaxed mb-3" style={{ color: textMuted }}>
                      We matched the name <strong>{product || 'this entity'}</strong>, but we have not yet confirmed it is the exact company or product you meant.
                      Until that is confirmed, trend, pricing, and competitor charts can look precise while still pointing at the wrong business.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
                      <div className="rounded-xl p-3" style={{ background: cardBg }}>
                        <p className="font-semibold mb-1" style={{ color: textMain }}>What we know</p>
                        <p style={{ color: textMuted }}>
                          The system found sources for the name, but the category match is still uncertain.
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: cardBg }}>
                        <p className="font-semibold mb-1" style={{ color: textMain }}>Why this matters</p>
                        <p style={{ color: textMuted }}>
                          If the name points to the wrong entity, every comparison card below becomes unreliable.
                        </p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: cardBg }}>
                        <p className="font-semibold mb-1" style={{ color: textMain }}>What we need</p>
                        <p style={{ color: textMuted }}>
                          Share the official website or exact product name, then rerun the analysis.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <ArtifactRenderer output={primaryVisual} product={product} />
              )}
            </div>
          )}
        </section>
      ) : null}

      {showMindMap && mindMapOutput?.branches?.length ? (
        <section className="results-panel p-5 lg:p-6">
          <SectionToggle
            title={mindMapOutput.contextOnly ? 'Identity mind map' : 'Strategy mind map'}
            icon={<GitBranch size={13} />}
            open={openMap}
            onToggle={() => setOpenMap((v) => !v)}
            textMuted={textMuted}
            accentInk={accentInk}
          />
          {openMap && (
            <div className="mt-4">
              {mindMapOutput.contextOnly ? (
                <p className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>
                  Confirm the exact company or product first. Buyer, pricing, and competitor analysis can be misleading until that is clear.
                </p>
              ) : null}
              <ArtifactRenderer output={mindMapOutput} product={product} />
            </div>
          )}
        </section>
      ) : null}

      {showSources && currentResult.sources && currentResult.sources.length > 0 ? (
        <section className="results-panel p-5">
          <SectionToggle
            title={`Verified sources (${currentResult.sources.length})`}
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
                  className="source-chip inline-flex items-center gap-1.5"
                >
                  <SourceTrustBadge url={source.url} />
                  {source.title} <ArrowUpRight size={9} />
                </a>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showAnalystBlock ? (
        <section className="results-panel p-5 lg:p-6">
          <SectionToggle
            title="Why the answer looks trustworthy"
            icon={<ShieldCheck size={13} />}
            open={openAnalyst}
            onToggle={() => setOpenAnalyst((v) => !v)}
            textMuted={textMuted}
            accentInk={accentInk}
          />
          {openAnalyst && (
            <div className="mt-4 flex flex-col gap-4">
              {(currentResult.orchestratorOutput?.quality || currentResult.orchestratorOutput?.evidenceCoverage) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {currentResult.orchestratorOutput?.quality ? (
                    <EvidenceStrengthMeter quality={currentResult.orchestratorOutput.quality} />
                  ) : null}
                  {currentResult.orchestratorOutput?.evidenceCoverage ? (
                    <EvidenceCoverageRadar axes={currentResult.orchestratorOutput.evidenceCoverage} />
                  ) : null}
                </div>
              ) : null}

              {featureFlags.competitiveTimeline ? (
                <CompetitiveTimeline
                  product={currentResult.orchestratorOutput?.product}
                  competitor={currentResult.orchestratorOutput?.competitor}
                />
              ) : null}

              {(showBusinessDeep || showAnalystBlock) ? (
                <StrategyCanvas message={currentResult} />
              ) : null}

              {outputs.filter((o) => o.artifactType !== 'mind-map').length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {outputs
                    .filter((o) => o.artifactType !== 'mind-map' && o.artifactType !== primaryVisual?.artifactType)
                    .map((o, i) => {
                      const domainMeta = DOMAIN_META[o.domain as Domain];
                      const contextOnly = Boolean(o.contextOnly || qualityAbstain);
                      return (
                        <div
                          key={`${o.domain}-${i}`}
                          className="rounded-xl p-4 flex flex-col justify-between gap-2"
                          style={{
                            background: cardBg2,
                            border: `1px solid ${borderC || 'var(--border)'}`,
                            boxShadow: `inset 3px 0 0 0 ${domainMeta?.color ?? accentInk}`,
                            opacity: contextOnly ? 0.82 : 1,
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                {domainMeta && <span style={{ color: domainMeta.color }}>{domainMeta.icon}</span>}
                                <span
                                  className="text-[12px] font-mono font-bold uppercase tracking-wide"
                                  style={{ color: domainMeta ? domainAccent(domainMeta, isDark) : textMuted }}
                                >
                                  {domainMeta?.short ?? o.domain}
                                </span>
                                {contextOnly ? (
                                  <span
                                    className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                                    style={{
                                      color: isDark ? '#FCD34D' : '#92400E',
                                      background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(254,243,199,1)',
                                    }}
                                  >
                                    {o.contextOnlyLabel ?? 'Category context only'}
                                  </span>
                                ) : null}
                              </div>
                              <ConfidenceBadge level={o.confidence} />
                            </div>
                            <p className="text-[13px] leading-relaxed font-medium" style={{ color: textMain }}>
                              {o.interpretation?.[0] || o.facts?.[0] || 'No highlight available.'}
                            </p>
                            {o.facts && o.facts.length > 1 && (
                              <ul className="mt-2 text-[12px] space-y-1 opacity-90 border-t border-border/40 pt-2">
                                {o.facts.slice(1, 4).map((f, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5 leading-snug" style={{ color: textMuted }}>
                                    <span style={{ color: domainMeta?.color ?? accentInk }}>•</span>
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : null}

              {compareBaseline && currentResult.id !== compareBaseline.id ? (
                <div className="flex flex-col gap-2 pt-2">
                  <ScenarioCompare
                    left={compareBaseline}
                    right={currentResult}
                    leftLabel="Adaptive / prior"
                    rightLabel="Full sweep"
                  />
                  {onClearCompare ? (
                    <button
                      type="button"
                      onClick={onClearCompare}
                      className="self-start text-[10px] font-mono uppercase text-muted-foreground"
                    >
                      Clear comparison
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* Business short path: strategy canvas without full analyst dump */}
      {showBusinessDeep && !showAnalystBlock ? (
        <section className="results-panel p-5 lg:p-6">
          <StrategyCanvas message={currentResult} />
        </section>
      ) : null}
    </div>
  );
}
