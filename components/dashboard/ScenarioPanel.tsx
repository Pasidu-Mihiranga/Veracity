'use client';

import React, { useState } from 'react';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { ScenarioBriefReview } from './ScenarioBriefReview';
import { ScenarioView } from './ScenarioView';
import type { ScenarioBrief } from '@/lib/intelligence/scenario-brief';
import type { MarketProject } from '@/lib/projects';

/**
 * The Swarm Decision Lab lifecycle, in one place.
 *
 * draft → review → run → read, and back to review for a branch. Splitting these
 * across separate screens would break the thing that makes the lab worth
 * having: a scenario is one object you return to, not a series of disposable
 * runs.
 *
 * The brief is seeded from the project rather than typed from scratch. A user
 * asked to invent alternatives and segments in a blank form will produce
 * something generic, and a generic brief produces a generic panel.
 */

export interface ScenarioPanelProps {
  project: MarketProject;
}

type Phase = 'idle' | 'reviewing' | 'running' | 'viewing';

/**
 * Seed a brief from the project.
 *
 * Alternatives are deliberately concrete opposites rather than open-ended, and
 * the segments are the roles that actually disagree in a B2B software decision.
 * Everything here is editable in review — this is a starting point, not an
 * assertion about the user's situation.
 */
function seedBrief(project: MarketProject): ScenarioBrief {
  const decision = project.decision_context?.trim() || 'a pricing change';

  return {
    id: `scenario-${project.id}-${Date.now()}`,
    version: 1,
    parentVersion: null,
    branchReason: null,
    projectId: project.id,
    decisionQuestion: `For ${project.product}: should we act on ${decision}, or hold?`,
    alternatives: [
      { id: 'A', label: 'Hold', description: `Keep ${project.product} as it is for now.` },
      { id: 'B', label: 'Act', description: `Make the change implied by ${decision}.` },
    ],
    targetSegments: [
      {
        id: 'economic',
        label: 'Economic buyer',
        description: 'Signs the contract and owns the budget.',
        panelSize: 4,
      },
      {
        id: 'operator',
        label: 'Daily operator',
        description: 'Uses the product day to day and feels the friction.',
        panelSize: 4,
      },
    ],
    observedFacts: [],
    assumptions: [],
    uncertainties: [],
    exclusions: [],
    timeHorizon: '2 quarters',
    createdAt: new Date().toISOString(),
  } as ScenarioBrief;
}

export function ScenarioPanel({ project }: ScenarioPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [brief, setBrief] = useState<ScenarioBrief | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [panelAvailable, setPanelAvailable] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startReview = async () => {
    setError(null);
    const seeded = seedBrief(project);

    try {
      const response = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          brief: seeded,
          product: project.product,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? 'The brief could not be prepared');
        return;
      }

      setBrief(seeded);
      setScenarioId(body.data.scenario.id);
      setWarnings(body.data.warnings ?? []);
      // Availability is surfaced during review, so a missing service is known
      // before the user commits rather than after.
      setPanelAvailable(Boolean(body.data.panelAvailable));
      setUnavailableReason(body.data.panelUnavailableReason ?? null);
      setPhase('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The brief could not be prepared');
    }
  };

  const run = async (reviewed: ScenarioBrief) => {
    if (!scenarioId) return;
    setPhase('running');
    setError(null);

    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product: project.product }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? 'The panel did not run');
        setPhase('reviewing');
        return;
      }

      setBrief(reviewed);
      setPhase('viewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The panel did not run');
      setPhase('reviewing');
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
          <FlaskConical size={12} /> Swarm Decision Lab
        </div>
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={() => void startReview()}
            className="text-[10px] font-mono text-accent hover:opacity-80"
          >
            Stress-test a decision
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPhase('idle');
              setScenarioId(null);
              setBrief(null);
            }}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
          >
            Start over
          </button>
        )}
      </div>

      {error ? (
        <div className="veracity-card p-4 flex items-start gap-2 border-l-2 border-l-amber-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : null}

      {phase === 'idle' ? (
        <div className="veracity-card p-5 flex flex-col gap-2">
          <p className="text-sm text-foreground">
            Test a decision against synthetic stakeholders before you commit to it.
          </p>
          {/* Said up front, not buried in the output. Someone who understands
              what this is before running it cannot misread the result later. */}
          <p className="text-xs text-muted-foreground">
            The panel is model-generated, not real customers and not survey data. It is
            useful for surfacing objections and disagreement you had not considered — not
            for predicting what the market will do.
          </p>
        </div>
      ) : null}

      {phase === 'reviewing' && brief ? (
        <ScenarioBriefReview
          brief={brief}
          warnings={warnings}
          panelAvailable={panelAvailable}
          panelUnavailableReason={unavailableReason}
          onRun={(reviewed) => void run(reviewed)}
          onCancel={() => setPhase('idle')}
        />
      ) : null}

      {phase === 'running' && brief ? (
        <ScenarioBriefReview
          brief={brief}
          warnings={warnings}
          panelAvailable={panelAvailable}
          onRun={() => undefined}
          running
        />
      ) : null}

      {phase === 'viewing' && scenarioId ? <ScenarioView scenarioId={scenarioId} /> : null}
    </section>
  );
}
