'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Users } from 'lucide-react';
import type { ScenarioOutcome } from '@/lib/intelligence/scenario-runner';

/**
 * Swarm Decision Lab result surfaces.
 *
 * The single most dangerous misreading of this feature is treating persona
 * agreement as evidence, so the design works against that everywhere:
 *
 *  - A synthetic badge sits on every panel, not just the first.
 *  - Counts are shown as "7 of 12 personas", never as a percentage. A percentage
 *    implies a sampling frame, and there is none.
 *  - Dissent gets equal visual weight to the majority. A 7–5 split and a 12–0
 *    split are different findings, and a bar chart alone hides which happened.
 *  - When the distribution does not reconcile, the reason renders instead of
 *    the chart.
 *  - Raw persona responses stay one click away, so the panel is inspectable
 *    rather than something the user has to take on trust.
 */

export interface ScenarioLabChartsProps {
  outcome: ScenarioOutcome;
  /** Alternative id → human label, from the brief. */
  alternativeLabels: Record<string, string>;
  segmentLabels?: Record<string, string>;
}

function SyntheticBadge() {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
      Synthetic scenario — not survey data
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  );
}

/** Distribution as counts out of the panel, never as percentages. */
function DistributionPanel({
  outcome,
  alternativeLabels,
}: {
  outcome: ScenarioOutcome;
  alternativeLabels: Record<string, string>;
}) {
  if (!outcome.distribution) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-2">
        <SectionLabel>Alternative distribution</SectionLabel>
        <div className="text-sm text-foreground">Not shown.</div>
        <p className="text-xs text-muted-foreground">
          {outcome.distributionWithheldReason ??
            'The counts could not be reconciled to the panel size.'}
        </p>
      </div>
    );
  }

  const max = Math.max(...outcome.distribution.map((d) => d.count), 1);

  return (
    <div className="veracity-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SectionLabel>Alternative distribution</SectionLabel>
        <span className="text-[10px] font-mono text-muted-foreground">
          {outcome.respondedCount} of {outcome.panelSize} personas responded
        </span>
      </div>

      <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
        {outcome.distribution.map((entry) => (
          <li key={entry.alternativeId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground">
                {alternativeLabels[entry.alternativeId] ?? entry.alternativeId}
              </span>
              {/* Counts, deliberately. "58%" would imply a sample. */}
              <span className="text-xs font-mono text-muted-foreground">
                {entry.count} of {outcome.panelSize}
              </span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              {/* A zero count renders as no bar at all, not a minimum-width stub. */}
              {entry.count > 0 ? (
                <div
                  className="h-full bg-gradient-signature rounded"
                  style={{ width: `${(entry.count / max) * 100}%` }}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {outcome.failedCount > 0 ? (
        <p className="text-xs text-amber-700">
          {outcome.failedCount} persona{outcome.failedCount === 1 ? '' : 's'} failed to respond.
          This is a partial panel.
        </p>
      ) : null}
    </div>
  );
}

/** Minority positions, given the same weight as the majority. */
function DissentPanel({
  outcome,
  segmentLabels,
}: {
  outcome: ScenarioOutcome;
  segmentLabels?: Record<string, string>;
}) {
  return (
    <div className="veracity-card p-5 flex flex-col gap-3">
      <SectionLabel>Dissent</SectionLabel>

      {outcome.dissent.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Every responding persona chose the same alternative. Unanimity among synthetic
          personas usually reflects how the scenario was framed rather than genuine
          agreement — check the assumptions before reading it as a strong signal.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {outcome.dissent.map((d) => (
            <li key={d.personaId} className="flex flex-col gap-1 border-l-2 border-l-amber-400 pl-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {segmentLabels?.[d.segmentId] ?? d.segmentId}
              </span>
              <p className="text-xs text-foreground">{d.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Objections ranked by how many personas raised them. */
function ObjectionsPanel({ outcome }: { outcome: ScenarioOutcome }) {
  if (outcome.objections.length === 0) return null;

  return (
    <div className="veracity-card p-5 flex flex-col gap-3">
      <SectionLabel>Blocking objections</SectionLabel>
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {outcome.objections.map((objection, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <p className="text-xs text-foreground flex-1">{objection.text}</p>
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap inline-flex items-center gap-1">
              <Users size={10} /> {objection.personaIds.length}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Who moved between the challenge round and the decision round. */
function TransitionsPanel({
  outcome,
  alternativeLabels,
}: {
  outcome: ScenarioOutcome;
  alternativeLabels: Record<string, string>;
}) {
  if (outcome.positionChanges.length === 0) return null;

  return (
    <div className="veracity-card p-5 flex flex-col gap-3">
      <SectionLabel>Position changes after the challenge</SectionLabel>
      <p className="text-xs text-muted-foreground">
        These personas revised their position once counterarguments were introduced. Movement
        is often more informative than the final split.
      </p>
      <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
        {outcome.positionChanges.map((change) => (
          <li key={change.personaId} className="text-xs font-mono text-foreground">
            {change.personaId}: {alternativeLabels[change.from] ?? change.from} →{' '}
            {alternativeLabels[change.to] ?? change.to}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Raw persona responses, so the panel is inspectable rather than trusted. */
function ResponsesAccordion({ outcome }: { outcome: ScenarioOutcome }) {
  const [open, setOpen] = useState(false);
  const byRound = [1, 2, 3].map((round) => ({
    round,
    items: outcome.responses.filter((r) => r.round === round),
  }));

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[10px] font-mono text-accent hover:underline inline-flex items-center gap-1 self-start"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {open ? 'Hide' : 'Show'} all {outcome.responses.length} persona responses
      </button>

      {open ? (
        <div className="flex flex-col gap-4">
          {byRound.map(({ round, items }) => (
            <div key={round} className="flex flex-col gap-2">
              <SectionLabel>Round {round}</SectionLabel>
              <ul className="flex flex-col gap-2 list-none p-0 m-0">
                {items.map((r, i) => (
                  <li key={`${r.personaId}-${round}-${i}`} className="veracity-card p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {r.personaId} · {r.segmentId}
                      </span>
                      {r.status === 'failed' ? (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                          failed
                        </span>
                      ) : null}
                      {r.chosenAlternativeId ? (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/5 text-accent border border-accent/20">
                          chose {r.chosenAlternativeId}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-foreground">
                      {r.status === 'failed'
                        ? (r.failureReason ?? 'No response was recorded.')
                        : r.response}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ScenarioLabCharts({
  outcome,
  alternativeLabels,
  segmentLabels,
}: ScenarioLabChartsProps) {
  if (outcome.status === 'failed' && outcome.responses.length === 0) {
    return (
      <div className="veracity-card p-5 flex flex-col gap-2 border-l-2 border-l-red-400">
        <div className="flex items-center gap-2 flex-wrap">
          <SectionLabel>Swarm Decision Lab</SectionLabel>
          <SyntheticBadge />
        </div>
        <div className="text-sm text-foreground inline-flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-red-500" /> The panel did not run.
        </div>
        <p className="text-xs text-muted-foreground">
          {outcome.distributionWithheldReason ?? 'No personas responded.'} No result is shown
          rather than a partial one that would read as a finding.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SectionLabel>Swarm Decision Lab</SectionLabel>
        <SyntheticBadge />
      </div>

      <DistributionPanel outcome={outcome} alternativeLabels={alternativeLabels} />
      <DissentPanel outcome={outcome} segmentLabels={segmentLabels} />
      <ObjectionsPanel outcome={outcome} />
      <TransitionsPanel outcome={outcome} alternativeLabels={alternativeLabels} />

      {outcome.informationGaps.length > 0 ? (
        <div className="veracity-card p-5 flex flex-col gap-2">
          <SectionLabel>What the panel said it was missing</SectionLabel>
          <ul className="flex flex-col gap-1 list-none p-0 m-0">
            {outcome.informationGaps.map((gap, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="mt-0.5">–</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ResponsesAccordion outcome={outcome} />

      {/* Limitations render last and always — they are the difference between a
          decision aid and a fabricated market signal. */}
      <div className="veracity-card p-4 flex flex-col gap-1.5">
        <SectionLabel>Limitations</SectionLabel>
        <ul className="flex flex-col gap-1 list-none p-0 m-0">
          {outcome.limitations.map((limitation, i) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
              <span className="mt-0.5">–</span>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
