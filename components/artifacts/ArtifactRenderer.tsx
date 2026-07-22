'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { AgentOutput, MarketTrendsOutput, CompetitiveOutput, WinLossOutput, PricingOutput, PositioningOutput, AdjacentOutput, MindMapOutput, ExecutionPlanOutput, ForecastOutput, OrchestratorOutput, RefinementDelta } from '@/lib/agents/types';
import { EmptyArtifact } from './EmptyArtifact';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';

const TrendChart = dynamic(() => import('./TrendChart').then((m) => m.TrendChart), {
  loading: () => <PanelSkeleton label="Loading trend chart" rows={4} height={200} />,
  ssr: false,
});
const CompetitiveMatrix = dynamic(() => import('./CompetitiveMatrix').then((m) => m.CompetitiveMatrix), {
  loading: () => <PanelSkeleton label="Loading matrix" rows={4} height={200} />,
  ssr: false,
});
const WinLossScorecard = dynamic(() => import('./WinLossScorecard').then((m) => m.WinLossScorecard), {
  loading: () => <PanelSkeleton label="Loading scorecard" rows={3} height={180} />,
  ssr: false,
});
const PricingTable = dynamic(() => import('./PricingTable').then((m) => m.PricingTable), {
  loading: () => <PanelSkeleton label="Loading pricing" rows={3} height={180} />,
  ssr: false,
});
const PositioningGap = dynamic(() => import('./PositioningGap').then((m) => m.PositioningGap), {
  loading: () => <PanelSkeleton label="Loading positioning" rows={3} height={180} />,
  ssr: false,
});
const ThreatHeatmap = dynamic(() => import('./ThreatHeatmap').then((m) => m.ThreatHeatmap), {
  loading: () => <PanelSkeleton label="Loading heatmap" rows={3} height={180} />,
  ssr: false,
});
const MindMap = dynamic(() => import('./MindMap').then((m) => m.MindMap), {
  loading: () => <PanelSkeleton label="Loading mind map" rows={4} height={220} />,
  ssr: false,
});
const ExecutionPlan = dynamic(() => import('./ExecutionPlan').then((m) => m.ExecutionPlan), {
  loading: () => <PanelSkeleton label="Loading execution plan" rows={5} height={240} />,
  ssr: false,
});
const ForecastChart = dynamic(() => import('./ForecastChart').then((m) => m.ForecastChart), {
  loading: () => <PanelSkeleton label="Loading forecast" rows={4} height={200} />,
  ssr: false,
});

interface Props {
  output: AgentOutput;
  product: string;
  sessionId?: string | null;
  messageId?: string | null;
  onRefined?: (result: { plan: ExecutionPlanOutput; orchestratorOutput?: OrchestratorOutput; changes?: RefinementDelta[] }) => void;
}

function withArrayDefaults<T extends Record<string, any>>(output: T, fields: (keyof T)[]): T {
  let patched: T | null = null;
  for (const f of fields) {
    if (output[f] === undefined || output[f] === null) {
      if (!patched) patched = { ...output };
      (patched as any)[f] = [];
    }
  }
  return patched ?? output;
}

function ArtifactRendererInner({ output, product, sessionId, messageId, onRefined }: Props) {
  if (!output) return <EmptyArtifact label="Artifact" reason="No agent output to render." />;

  switch (output.artifactType) {
    case 'trend-chart': {
      const o = withArrayDefaults(output as MarketTrendsOutput, ['trends', 'keySignals']);
      if (!o.trends.length && !o.keySignals.length) {
        return <EmptyArtifact label="Market Trend Analysis" reason="No measurable trends surfaced from this run." />;
      }
      return <TrendChart output={o} />;
    }
    case 'competitive-matrix': {
      const o = withArrayDefaults(output as CompetitiveOutput, ['matrix', 'hiringSignals', 'recentMoves']);
      if (!o.matrix.length && !o.competitorSummary) {
        return <EmptyArtifact label="Feature Comparison Matrix" reason="No comparable feature data was found." />;
      }
      return <CompetitiveMatrix output={o} product={product} />;
    }
    case 'win-loss-scorecard': {
      const o = withArrayDefaults(output as WinLossOutput, ['competitorWins', 'competitorLosses', 'topSwitchTriggers']);
      if (!o.competitorWins.length && !o.competitorLosses.length) {
        return <EmptyArtifact label="Win / Loss Analysis" reason="No buyer-side wins or losses surfaced." />;
      }
      return <WinLossScorecard output={o} competitor={o.competitor} product={product} />;
    }
    case 'pricing-table': {
      const o = withArrayDefaults(output as PricingOutput, ['competitorPricing', 'pricingSignals']);
      if (!o.competitorPricing.length && !o.pricingSignals.length) {
        return <EmptyArtifact label="Pricing Intelligence" reason="No competitor pricing or willingness-to-pay signals found." />;
      }
      return <PricingTable output={o} />;
    }
    case 'positioning-gap': {
      const o = withArrayDefaults(output as PositioningOutput, ['gaps', 'adThemes']);
      if (!o.gaps.length && !o.yourPositioning) {
        return <EmptyArtifact label="Positioning Gap Analysis" reason="No positioning gaps detected in this run." />;
      }
      return <PositioningGap output={o} product={product} competitor={o.competitor} />;
    }
    case 'threat-heatmap': {
      const o = withArrayDefaults(output as AdjacentOutput, ['threats', 'defensiveActions']);
      if (!o.threats.length && !o.defensiveActions.length) {
        return <EmptyArtifact label="Adjacent Threat Heatmap" reason="No adjacent-market threats detected." />;
      }
      return <ThreatHeatmap output={o} />;
    }
    case 'mind-map': {
      const o = withArrayDefaults(output as MindMapOutput, ['branches']);
      if (!o.branches.length) {
        return <EmptyArtifact label="Strategy map" reason="Synthesis produced no usable strategy pillars." />;
      }
      return <MindMap output={o} />;
    }
    case 'execution-plan': {
      const o = withArrayDefaults(output as ExecutionPlanOutput, ['variants', 'deployment']);
      if (!o.variants.length && !o.brief?.objective) {
        return <EmptyArtifact label="Execution Plan" reason="Execution Engine returned no variants or brief." />;
      }
      return <ExecutionPlan output={o} product={product} sessionId={sessionId} messageId={messageId} onRefined={onRefined} />;
    }
    case 'forecast-chart': {
      const o = output as ForecastOutput;
      if (!o.question || !o.swarmSize) {
        return <EmptyArtifact label="Swarm Forecast" reason="MiroFish simulation unavailable or not yet bootstrapped for this product." />;
      }
      return <ForecastChart output={o} product={product} />;
    }
    default:
      return <EmptyArtifact label="Artifact" reason="Unknown artifact type." />;
  }
}

export const ArtifactRenderer = React.memo(ArtifactRendererInner);
