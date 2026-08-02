'use client';

import React, { useState } from 'react';
import { FlaskConical, AlertTriangle, Play, Plus, X } from 'lucide-react';
import type { ScenarioBrief } from '@/lib/intelligence/scenario-brief';

/**
 * Review a scenario brief before spending anything on it.
 *
 * This screen is the reason `ScenarioBrief` exists rather than a raw prompt. A
 * synthetic panel answers whatever it is asked, confidently, so a question that
 * smuggled in an assumption produces an answer that inherits it invisibly. The
 * only defence is showing the user the premise before the panel sees it.
 *
 * Assumptions are editable and visually separated from facts throughout.
 * Everything below the fold is designed to make "this scenario assumes X" hard
 * to miss, because a reader who skips it will read the output as grounded.
 */

export interface ScenarioBriefReviewProps {
  brief: ScenarioBrief;
  warnings?: string[];
  panelAvailable?: boolean;
  panelUnavailableReason?: string | null;
  onRun: (brief: ScenarioBrief) => void;
  onCancel?: () => void;
  running?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  );
}

export function ScenarioBriefReview({
  brief,
  warnings = [],
  panelAvailable = true,
  panelUnavailableReason,
  onRun,
  onCancel,
  running = false,
}: ScenarioBriefReviewProps) {
  const [assumptions, setAssumptions] = useState<string[]>(brief.assumptions);
  const [draft, setDraft] = useState('');

  const panelSize = brief.targetSegments.reduce((sum, s) => sum + s.panelSize, 0);
  const edited = JSON.stringify(assumptions) !== JSON.stringify(brief.assumptions);

  const addAssumption = () => {
    const value = draft.trim();
    if (!value) return;
    setAssumptions((prev) => [...prev, value]);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
          <FlaskConical size={12} /> Review before running
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
          Synthetic panel — not survey data
        </span>
      </div>

      <div className="veracity-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <SectionLabel>Decision</SectionLabel>
          <p className="text-sm text-foreground font-medium">{brief.decisionQuestion}</p>
          {brief.timeHorizon ? (
            <span className="text-[10px] font-mono text-muted-foreground">
              Horizon: {brief.timeHorizon}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Alternatives</SectionLabel>
          <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
            {brief.alternatives.map((alt) => (
              <li key={alt.id} className="text-xs text-foreground">
                <span className="font-mono text-accent">{alt.id}</span> — {alt.label}
                <span className="text-muted-foreground"> · {alt.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Panel — {panelSize} synthetic personas</SectionLabel>
          <ul className="flex flex-col gap-1 list-none p-0 m-0">
            {brief.targetSegments.map((segment) => (
              <li key={segment.id} className="text-xs text-muted-foreground">
                {segment.label} × {segment.panelSize} — {segment.description}
              </li>
            ))}
          </ul>
        </div>

        {/* Facts and assumptions are deliberately adjacent and visually
            distinct. Blurring them is how a scenario's premise quietly becomes
            a finding. */}
        <div className="flex flex-col gap-2">
          <SectionLabel>Facts the panel will be given ({brief.observedFacts.length})</SectionLabel>
          {brief.observedFacts.length === 0 ? (
            <p className="text-xs text-amber-700">
              None. This scenario rests entirely on assumptions — treat the result as a
              thought experiment, not as grounded analysis.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {brief.observedFacts.map((fact) => (
                <li key={fact.claimId} className="text-xs text-foreground flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span>{fact.statement}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-l-2 border-l-amber-400 pl-3">
          <SectionLabel>Assumptions — editable, and NOT established</SectionLabel>
          <p className="text-xs text-muted-foreground">
            The panel is told these are premises, not facts. Changing one changes what the
            panel is reasoning about.
          </p>

          {assumptions.length === 0 ? (
            <p className="text-xs text-amber-700">
              No assumptions stated. Check whether an unproven premise is hiding inside the
              decision question itself.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {assumptions.map((assumption, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-2">
                  <span className="mt-0.5">–</span>
                  <span className="flex-1">{assumption}</span>
                  <button
                    type="button"
                    onClick={() => setAssumptions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove assumption: ${assumption}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAssumption();
                }
              }}
              placeholder="Add an assumption this scenario rests on"
              className="flex-1 text-xs bg-muted border border-border rounded-lg px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={addAssumption}
              className="text-[10px] font-mono text-accent hover:opacity-80 inline-flex items-center gap-1"
            >
              <Plus size={11} /> Add
            </button>
          </div>
        </div>

        {brief.uncertainties.length > 0 ? (
          <div className="flex flex-col gap-1">
            <SectionLabel>Known unknowns</SectionLabel>
            <ul className="flex flex-col gap-1 list-none p-0 m-0">
              {brief.uncertainties.map((u, i) => (
                <li key={i} className="text-xs text-muted-foreground">– {u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {warnings.length > 0 ? (
        <div className="veracity-card p-4 flex flex-col gap-1.5 border-l-2 border-l-amber-400">
          <div className="text-xs font-mono uppercase tracking-wider text-amber-700 inline-flex items-center gap-1.5">
            <AlertTriangle size={12} /> Before you run
          </div>
          {/* Warnings never block — a thought experiment is legitimate, it just
              has to be labelled. */}
          {warnings.map((warning, i) => (
            <p key={i} className="text-xs text-muted-foreground">{warning}</p>
          ))}
        </div>
      ) : null}

      {!panelAvailable ? (
        <div className="veracity-card p-4 flex flex-col gap-1.5 border-l-2 border-l-red-400">
          <div className="text-xs font-mono uppercase tracking-wider text-red-600">
            Panel unavailable
          </div>
          <p className="text-xs text-muted-foreground">
            {panelUnavailableReason ?? 'The synthetic panel service is not reachable.'}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={!panelAvailable || running}
          onClick={() => onRun({ ...brief, assumptions })}
          className="bg-gradient-signature text-white rounded-xl py-2.5 px-4 text-sm font-medium transition-transform hover:-translate-y-[1px] hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 inline-flex items-center gap-2"
        >
          <Play size={13} />
          {running ? 'Running the panel…' : `Run the panel (${panelSize} personas)`}
        </button>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}

        {edited ? (
          // Says what will happen rather than silently versioning: a user who
          // edited assumptions should know they are creating a comparable
          // branch, not overwriting the base case.
          <span className="text-[10px] font-mono text-accent">
            Assumptions edited — this will run as a new version
          </span>
        ) : null}
      </div>
    </div>
  );
}
