'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { SinceLastVisit } from './SinceLastVisit';
import { ProjectCharts } from './ProjectCharts';
import { ActivityTimeline } from './ActivityTimeline';
import { Glossary } from '@/components/ui/Glossary';
import { EvidenceDrawer } from '@/components/artifacts/EvidenceDrawer';
import { useProjectDashboard } from '@/hooks/useProjectDashboard';
import type { DigestCandidate } from '@/lib/intelligence/digest';

/**
 * The project's default screen.
 *
 * Composes the change list with the evidence drawer, so "what changed?" and
 * "prove it" are one click apart rather than two different places. That
 * adjacency is most of the product's claim to being more than a research bot.
 */

export interface ProjectDashboardProps {
  projectId: string;
  /** Lets the user carry a change straight into the conversation. */
  onAskAbout?: (question: string) => void;
}

export function ProjectDashboard({ projectId, onAskAbout }: ProjectDashboardProps) {
  const dashboard = useProjectDashboard(projectId);
  const { data, markSeen } = dashboard;

  // Mark as read only once the data is on screen, not when the request starts.
  // Depending on the individual values rather than the hook's return object
  // matters: that object is rebuilt every render, so `[dashboard]` would re-run
  // this on every single render instead of when the data actually arrives.
  useEffect(() => {
    if (data) markSeen();
  }, [data, markSeen]);

  const askAbout = (item: DigestCandidate) => {
    if (!onAskAbout) return;
    const movement =
      item.beforeValue && item.afterValue
        ? ` (${item.beforeValue} → ${item.afterValue})`
        : '';
    // Phrased as a question the research pipeline can act on, and carrying the
    // observed values so the turn does not have to re-derive them.
    onAskAbout(
      `What does ${item.entityLabel}'s ${item.eventType.replace(/_/g, ' ')}${movement} mean for our current decision?`,
    );
  };

  if (dashboard.loading && !dashboard.data) {
    return (
      <div className="veracity-card p-6 flex flex-col gap-4 w-full">
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse-line" />
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse-line" />
        <div className="h-4 bg-muted rounded w-2/3 animate-pulse-line" />
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-3 border-l-2 border-l-amber-400">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-700 inline-flex items-center gap-1.5">
          <AlertTriangle size={12} /> Dashboard unavailable
        </div>
        <p className="text-sm text-muted-foreground">{dashboard.error}</p>
        <button
          type="button"
          onClick={() => void dashboard.reload()}
          className="self-start text-xs font-mono text-accent hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw size={11} /> Try again
        </button>
      </div>
    );
  }

  if (!dashboard.data) return null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void dashboard.reload()}
            disabled={dashboard.loading}
            className="text-[10px] font-mono text-accent hover:underline inline-flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={11} className={dashboard.loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <SinceLastVisit
          digest={dashboard.data.digest}
          projectName={dashboard.data.projectName}
          staleSources={dashboard.data.staleSources}
          sourcesChecked={dashboard.data.sourcesChecked}
          unchangedCount={dashboard.data.unchangedCount}
          onOpenEvidence={(spanId) =>
            void dashboard.openEvidence([spanId], 'Evidence for this change')
          }
          onAskAbout={onAskAbout ? askAbout : undefined}
        />

        {/*
          Charts sit below the change list. What moved is the reason to return;
          the series is the context for it. Every point traces to an evidence
          span, which is why "show the excerpts behind this" resolves.
        */}
        <ProjectCharts
          projectId={projectId}
          onOpenEvidence={(spanIds) =>
            void dashboard.openEvidence(spanIds, 'Evidence behind this chart')
          }
        />

        {/*
          Full history last. The digest above is what demands attention; this is
          what someone investigating a competitor works through, including the
          changes the materiality gate deliberately suppressed.
        */}
        <ActivityTimeline
          projectId={projectId}
          onOpenEvidence={(spanIds) =>
            void dashboard.openEvidence(spanIds, 'Evidence for this change')
          }
        />

        {/* Last, collapsed. Present for anyone who wants it, invisible to
            anyone who does not. */}
        <Glossary />
      </div>

      <EvidenceDrawer
        open={dashboard.evidenceOpen}
        onClose={dashboard.closeEvidence}
        claim={dashboard.evidenceClaim}
        supporting={dashboard.evidence ?? []}
        dataClass="measured"
      />
    </>
  );
}
