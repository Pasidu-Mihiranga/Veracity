'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ChartSpecView } from '@/components/artifacts/ChartSpecView';
import type { ChartSpec } from '@/lib/intelligence/types';

/**
 * Charts built from the project's stored observations.
 *
 * Every chart here is traceable: its rows come from `metric_observations`,
 * which cannot exist without an evidence span. That is what separates these
 * from a chart a model drew — and why the "show the excerpts behind this"
 * action on each one actually resolves to something.
 *
 * Refused charts render their reasons alongside the ones that worked. A user
 * whose pricing observations use two currencies should be told that, not shown
 * one fewer chart with no explanation.
 */

export interface ProjectChartsProps {
  projectId: string;
  onOpenEvidence?: (spanIds: string[]) => void;
}

interface ChartsPayload {
  charts: ChartSpec[];
  unavailable: Array<{ metricKey: string; title: string; reasons: string[] }>;
}

export function ProjectCharts({ projectId, onOpenEvidence }: ProjectChartsProps) {
  const [data, setData] = useState<ChartsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/charts`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Could not load charts');
        return;
      }
      setData(payload.data as ChartsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load charts');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="veracity-card p-6 flex flex-col gap-4">
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse-line" />
        <div className="h-40 bg-muted rounded animate-pulse-line" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-2">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Charts
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const nothingYet = data.charts.length === 0 && data.unavailable.length === 0;

  if (nothingYet) {
    // Says why rather than showing an empty frame: no observations means
    // collection has not run, which is actionable.
    return (
      <div className="veracity-card p-5 flex flex-col gap-2">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
          <BarChart3 size={12} /> Charts
        </div>
        <p className="text-sm text-foreground">No measured observations yet.</p>
        <p className="text-xs text-muted-foreground">
          Charts here are built only from values read from a source, so they appear once a
          collection run has recorded observations for this project.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
        <BarChart3 size={12} /> Charts from stored evidence
      </div>

      {data.charts.map((spec) => (
        <div key={spec.id} className="veracity-card p-5">
          <ChartSpecView spec={spec} onOpenEvidence={onOpenEvidence} />
        </div>
      ))}

      {data.unavailable.map((entry) => (
        <div key={entry.metricKey} className="veracity-card p-5">
          <ChartSpecView
            // The planner refused, so there is no spec — only the reasons.
            // Passing them renders the explanatory empty state.
            spec={
              {
                id: entry.metricKey,
                title: entry.title,
                kind: 'bar',
                dataClass: 'measured',
                questionAnswered: '',
                metricDefinition: '',
                unit: '',
                period: { start: '', end: '', cadence: 'snapshot' },
                dimensions: [],
                series: [],
                rows: [],
                sourceIds: [],
                evidenceSpanIds: [],
                isEstimated: false,
                limitations: [],
                generatedAt: new Date().toISOString(),
              } as ChartSpec
            }
            unavailableReasons={entry.reasons}
          />
        </div>
      ))}
    </section>
  );
}
