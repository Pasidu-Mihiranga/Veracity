'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { AgentOutput, MarketTrendsOutput, CompetitiveOutput, WinLossOutput, PricingOutput, PositioningOutput, AdjacentOutput, MindMapOutput, ExecutionPlanOutput, ForecastOutput, SwarmScenarioOutput, OrchestratorOutput, RefinementDelta } from '@/lib/agents/types';
import { EmptyArtifact } from './EmptyArtifact';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';
import { legacyForecastToScenario } from '@/lib/swarm-scenario';
import { ARTIFACT_DATA_CLASS_COPY, getArtifactDataClass } from '@/lib/artifact-truth';

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
const SwarmScenarioChart = dynamic(() => import('./SwarmScenarioChart').then((m) => m.SwarmScenarioChart), {
  loading: () => <PanelSkeleton label="Loading scenario" rows={4} height={200} />,
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

function ArtifactTruthFrame({ output, children }: { output: AgentOutput; children: React.ReactNode }) {
  const dataClass = getArtifactDataClass(output);
  const copy = ARTIFACT_DATA_CLASS_COPY[dataClass];
  const tone = dataClass === 'synthetic'
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300 font-semibold'
    : dataClass === 'observed'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold'
      : 'border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-300 font-semibold';

  return (
    <div className="flex w-full flex-col gap-2">
      <div className={`self-start rounded-full border px-3 py-1 text-[10px] font-mono leading-none shadow-2xs ${tone}`} title={copy.detail}>
        <span className="font-bold">{copy.label}</span> · {copy.detail}
      </div>
      {children}
    </div>
  );
}

function ArtifactRendererInner({ output, product, sessionId, messageId, onRefined }: Props) {
  if (!output) return <EmptyArtifact label="Artifact" reason="No agent output to render." />;

  switch (output.artifactType) {
    case 'trend-chart': {
      const o = withArrayDefaults(output as MarketTrendsOutput, ['trends', 'keySignals']);
      if (!o.trends.length && !o.keySignals.length) {
        return <EmptyArtifact label="Market Trend Analysis" reason="No measurable trends surfaced from this run." />;
      }
      return <ArtifactTruthFrame output={output}><TrendChart output={o} /></ArtifactTruthFrame>;
    }
    case 'competitive-matrix': {
      const o = withArrayDefaults(output as CompetitiveOutput, ['matrix', 'hiringSignals', 'recentMoves']);
      if (!o.matrix.length && !o.competitorSummary) {
        return <EmptyArtifact label="Feature Comparison Matrix" reason="No comparable feature data was found." />;
      }
      return <ArtifactTruthFrame output={output}><CompetitiveMatrix output={o} product={product} /></ArtifactTruthFrame>;
    }
    case 'win-loss-scorecard': {
      const o = withArrayDefaults(output as WinLossOutput, ['competitorWins', 'competitorLosses', 'topSwitchTriggers']);
      if (!o.competitorWins.length && !o.competitorLosses.length) {
        return <EmptyArtifact label="Win / Loss Analysis" reason="No buyer-side wins or losses surfaced." />;
      }
      return <ArtifactTruthFrame output={output}><WinLossScorecard output={o} competitor={o.competitor} product={product} /></ArtifactTruthFrame>;
    }
    case 'pricing-table': {
      const o = withArrayDefaults(output as PricingOutput, ['competitorPricing', 'pricingSignals']);
      if (!o.competitorPricing.length && !o.pricingSignals.length) {
        return <EmptyArtifact label="Pricing Intelligence" reason="No competitor pricing or willingness-to-pay signals found." />;
      }
      return <ArtifactTruthFrame output={output}><PricingTable output={o} /></ArtifactTruthFrame>;
    }
    case 'positioning-gap': {
      const o = withArrayDefaults(output as PositioningOutput, ['gaps', 'adThemes']);
      if (!o.gaps.length && !o.yourPositioning) {
        return <EmptyArtifact label="Positioning Gap Analysis" reason="No positioning gaps detected in this run." />;
      }
      return <ArtifactTruthFrame output={output}><PositioningGap output={o} product={product} competitor={o.competitor} /></ArtifactTruthFrame>;
    }
    case 'threat-heatmap': {
      const o = withArrayDefaults(output as AdjacentOutput, ['threats', 'defensiveActions']);
      if (!o.threats.length && !o.defensiveActions.length) {
        return <EmptyArtifact label="Adjacent Threat Heatmap" reason="No adjacent-market threats detected." />;
      }
      return <ArtifactTruthFrame output={output}><ThreatHeatmap output={o} /></ArtifactTruthFrame>;
    }
    case 'mind-map': {
      const o = withArrayDefaults(output as MindMapOutput, ['branches']);
      if (!o.branches.length) {
        return <EmptyArtifact label="Strategy map" reason="Synthesis produced no usable strategy pillars." />;
      }
      return <ArtifactTruthFrame output={output}><MindMap output={o} /></ArtifactTruthFrame>;
    }
    case 'execution-plan': {
      const o = withArrayDefaults(output as ExecutionPlanOutput, ['variants', 'deployment']);
      if (!o.variants.length && !o.brief?.objective) {
        return <EmptyArtifact label="Execution Plan" reason="Execution Engine returned no variants or brief." />;
      }
      return <ArtifactTruthFrame output={output}><ExecutionPlan output={o} product={product} sessionId={sessionId} messageId={messageId} onRefined={onRefined} /></ArtifactTruthFrame>;
    }
    case 'forecast-chart': {
      const o = output as ForecastOutput;
      if (!o.question || !o.swarmSize) {
        return <EmptyArtifact label="Swarm Decision Lab" reason="MiroFish scenario unavailable or not yet prepared for this product." />;
      }
      return <ArtifactTruthFrame output={output}><SwarmScenarioChart output={legacyForecastToScenario(o)} product={product} /></ArtifactTruthFrame>;
    }
    case 'scenario-distribution': {
      const o = output as SwarmScenarioOutput;
      if (!o.question || !o.swarmSize) {
        return <EmptyArtifact label="Swarm Decision Lab" reason="No configured synthetic panel responses were returned." />;
      }
      return <ArtifactTruthFrame output={output}><SwarmScenarioChart output={o} product={product} /></ArtifactTruthFrame>;
    }
    default:
      return <EmptyArtifact label="Artifact" reason="Unknown artifact type." />;
  }
}

export const ArtifactRenderer = React.memo(ArtifactRendererInner);
