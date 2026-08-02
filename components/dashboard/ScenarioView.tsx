'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, AlertTriangle, GitBranch } from 'lucide-react';
import { ScenarioLabCharts } from '@/components/artifacts/ScenarioLabCharts';
import { ScenarioFollowUp } from './ScenarioFollowUp';
import type { ScenarioOutcome, PersonaResponseRecord } from '@/lib/intelligence/scenario-runner';
import type { ScenarioBrief } from '@/lib/intelligence/scenario-brief';

/**
 * Reads a stored scenario back and renders it.
 *
 * Deliberately separate from running one: the value of persisting rounds and
 * responses is that a panel can be revisited, compared against a branch, and
 * inspected long after the run. A view that only existed during a run would
 * have made the whole persistence layer pointless.
 *
 * The stored rows are reassembled into the same `ScenarioOutcome` shape the
 * runner produces, so the charts cannot drift between the live and stored
 * paths — there is one renderer and one shape.
 */

export interface ScenarioViewProps {
  scenarioId: string;
}

interface StoredResponseRow {
  round: number;
  persona_id: string;
  segment_id: string;
  response: string;
  chosen_alternative_id: string | null;
  blocking_objection: string | null;
  missing_information: string | null;
  changed_from_alternative_id: string | null;
  status: 'ok' | 'failed';
  failure_reason: string | null;
}

interface ScenarioPayload {
  scenario: {
    id: string;
    brief: ScenarioBrief;
    version: number;
    parentVersion: number | null;
    branchReason: string | null;
    status: 'draft' | 'running' | 'complete' | 'failed';
    failureReason: string | null;
  };
  responses: StoredResponseRow[];
  lineage: Array<{ id: string; version: number; branch_reason: string | null; status: string }>;
}

/**
 * Rebuild the runner's outcome shape from stored rows.
 *
 * Counts are recomputed from the responses rather than stored, so a chart can
 * never disagree with the rows behind it. Storing a precomputed distribution
 * would let the two drift apart silently.
 */
function toOutcome(payload: ScenarioPayload): ScenarioOutcome {
  const { scenario, responses } = payload;
  const brief = scenario.brief;

  const panelSize = brief.targetSegments.reduce((sum, s) => sum + s.panelSize, 0);
  const decision = responses.filter((r) => r.round === 3);
  const answered = decision.filter((r) => r.status === 'ok' && r.chosen_alternative_id);
  const failed = decision.filter((r) => r.status === 'failed');

  const valid = new Set(brief.alternatives.map((a) => a.id));
  const counts = new Map<string, number>();
  const bySegment = new Map<string, Map<string, number>>();

  for (const row of answered) {
    const choice = row.chosen_alternative_id!;
    if (!valid.has(choice)) continue;
    counts.set(choice, (counts.get(choice) ?? 0) + 1);
    if (!bySegment.has(row.segment_id)) bySegment.set(row.segment_id, new Map());
    const seg = bySegment.get(row.segment_id)!;
    seg.set(choice, (seg.get(choice) ?? 0) + 1);
  }

  const counted = [...counts.values()].reduce((a, b) => a + b, 0);

  // Same reconciliation rule as the runner: a distribution that does not sum to
  // the panel is withheld rather than shown against a total it does not reach.
  const reconciles = counted > 0 && counted + failed.length === panelSize;

  const plurality = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const objections = new Map<string, { text: string; personaIds: string[] }>();
  for (const row of decision) {
    const text = row.blocking_objection?.trim();
    if (!text) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
    if (!objections.has(key)) objections.set(key, { text, personaIds: [] });
    objections.get(key)!.personaIds.push(row.persona_id);
  }

  const mapped: PersonaResponseRecord[] = responses.map((r) => ({
    personaId: r.persona_id,
    segmentId: r.segment_id,
    round: r.round as 1 | 2 | 3,
    response: r.response,
    chosenAlternativeId: r.chosen_alternative_id,
    blockingObjection: r.blocking_objection,
    missingInformation: r.missing_information,
    status: r.status,
    failureReason: r.failure_reason ?? undefined,
  }));

  const limitations = [
    'Synthetic scenario — model-generated personas, not survey data and not real customers.',
    'Persona agreement carries no statistical weight and does not raise confidence in any factual claim.',
    `Panel of ${panelSize} synthetic persona(s) across ${brief.targetSegments.length} segment(s).`,
    'Results are not calibrated against real outcomes and must not be read as a prediction.',
  ];
  if (failed.length > 0) {
    limitations.push(
      `${failed.length} of ${panelSize} personas failed to respond; this is a partial panel.`,
    );
  }
  if (!reconciles) {
    limitations.push('Distribution withheld: the counts do not reconcile to the panel size.');
  }

  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    label: 'synthetic-scenario',
    panelSize,
    respondedCount: answered.length,
    failedCount: failed.length,
    responses: mapped,
    distribution: reconciles
      ? brief.alternatives.map((a) => ({ alternativeId: a.id, count: counts.get(a.id) ?? 0 }))
      : null,
    distributionWithheldReason: reconciles
      ? undefined
      : 'the counts do not reconcile to the panel size',
    segmentBreakdown: [...bySegment.entries()].flatMap(([segmentId, choices]) =>
      [...choices.entries()].map(([alternativeId, count]) => ({ segmentId, alternativeId, count })),
    ),
    objections: [...objections.values()].sort((a, b) => b.personaIds.length - a.personaIds.length),
    dissent: answered
      .filter((r) => r.chosen_alternative_id !== plurality)
      .map((r) => ({
        personaId: r.persona_id,
        segmentId: r.segment_id,
        summary: r.blocking_objection || r.response.slice(0, 240),
      })),
    positionChanges: decision
      .filter((r) => r.changed_from_alternative_id && r.chosen_alternative_id)
      .map((r) => ({
        personaId: r.persona_id,
        from: r.changed_from_alternative_id!,
        to: r.chosen_alternative_id!,
      })),
    informationGaps: [
      ...new Set(decision.map((r) => r.missing_information?.trim()).filter(Boolean) as string[]),
    ],
    limitations,
    status: answered.length === 0 ? 'failed' : failed.length > 0 ? 'partial' : 'complete',
  };
}

export function ScenarioView({ scenarioId }: ScenarioViewProps) {
  const [payload, setPayload] = useState<ScenarioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}`);
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? 'Could not load the scenario');
        return;
      }
      setPayload(body.data as ScenarioPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the scenario');
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="veracity-card p-6 flex flex-col gap-3">
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse-line" />
        <div className="h-24 bg-muted rounded animate-pulse-line" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-2 border-l-2 border-l-amber-400">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-700 inline-flex items-center gap-1.5">
          <AlertTriangle size={12} /> Scenario unavailable
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!payload) return null;

  const { scenario, lineage } = payload;

  if (scenario.status === 'draft') {
    // A reviewed-but-unrun brief is a normal state, not an error. Saying so
    // beats rendering an empty result that looks like a failed panel.
    return (
      <div className="veracity-card p-5 flex flex-col gap-2">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
          <FlaskConical size={12} /> Swarm Decision Lab
        </div>
        <p className="text-sm text-foreground">This scenario has not been run yet.</p>
        <p className="text-xs text-muted-foreground">{scenario.brief.decisionQuestion}</p>
      </div>
    );
  }

  const outcome = toOutcome(payload);
  const alternativeLabels = Object.fromEntries(
    scenario.brief.alternatives.map((a) => [a.id, a.label]),
  );
  const segmentLabels = Object.fromEntries(
    scenario.brief.targetSegments.map((s) => [s.id, s.label]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-foreground font-medium">{scenario.brief.decisionQuestion}</p>
        {scenario.parentVersion !== null ? (
          // The branch reason is shown because a branch without its premise is
          // just a second run with unexplained different numbers.
          <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1">
            <GitBranch size={10} />
            Version {scenario.version}, branched from {scenario.parentVersion}
            {scenario.branchReason ? ` — ${scenario.branchReason}` : ''}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground">
            Version {scenario.version}
          </span>
        )}
      </div>

      <ScenarioLabCharts
        outcome={outcome}
        alternativeLabels={alternativeLabels}
        segmentLabels={segmentLabels}
      />

      {/*
        Follow-ups are further rounds on this scenario, not new scenarios. The
        thread is the point: "why did procurement object?" is a question about
        the panel that already answered.
      */}
      <ScenarioFollowUp
        scenarioId={scenario.id}
        segments={scenario.brief.targetSegments.map((s) => ({ id: s.id, label: s.label }))}
        personas={[...new Set(payload.responses.map((r) => r.persona_id))]}
        onAsked={() => void load()}
      />

      {lineage.length > 1 ? (
        <div className="veracity-card p-4 flex flex-col gap-2">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Versions
          </div>
          <ul className="flex flex-col gap-1 list-none p-0 m-0">
            {lineage.map((entry) => (
              <li key={entry.id} className="text-xs text-muted-foreground">
                v{entry.version} · {entry.status}
                {entry.branch_reason ? ` — ${entry.branch_reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
