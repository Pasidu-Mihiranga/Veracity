'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, Scale, ShieldAlert } from 'lucide-react';
import type { OrchestratorOutput } from '@/lib/agents/types';
import type { ProductViewMode } from '@/types/chat-ui';
import { confidenceFromRecLevel } from '@/lib/decision-policy';
import { recommendationKey } from '@/lib/feedback';

type Props = {
  output?: OrchestratorOutput;
  viewMode: ProductViewMode;
  sessionId?: string | null;
};

type DecisionAction = 'accepted' | 'deferred' | 'rejected';

export function DecisionSupportPack({ output, viewMode, sessionId }: Props) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState<DecisionAction | null>(null);
  const [status, setStatus] = useState('');
  const decisionIdentity = `${output?.product ?? ''}:${output?.decisionFrame?.recommendation ?? ''}`;

  useEffect(() => {
    setReason('');
    setStatus('');
    setSaving(null);
  }, [decisionIdentity]);

  const supportingRecommendation = useMemo(() => {
    if (!output?.decisionFrame) return undefined;
    return output.topRecommendations?.find(
      (item) => item.title === output.decisionFrame?.recommendation,
    ) ?? output.topRecommendations?.[0];
  }, [output]);

  if (!output?.decisionFrame || !output.executiveContent) return null;
  const frame = output.decisionFrame;
  const appendix = output.executiveContent.decisionAppendix;
  const executive = viewMode === 'executive' || viewMode === 'business';

  const saveDecision = async (decision: DecisionAction) => {
    if (!sessionId || !reason.trim() || saving) return;
    setSaving(decision);
    setStatus('');
    try {
      const response = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: frame.recommendation,
          rationale: supportingRecommendation?.rationale ?? frame.situation,
          decision,
          reason: reason.trim(),
          confidence: confidenceFromRecLevel(supportingRecommendation?.confidence),
          sessionId,
          sourceRecommendationKey: recommendationKey(
            frame.recommendation,
            supportingRecommendation?.rationale ?? frame.situation,
          ),
          evidenceUrls: supportingRecommendation?.sourceUrls ?? [],
        }),
      });
      if (!response.ok) throw new Error('Decision could not be saved');
      setStatus(decision === 'accepted' ? 'Decision adopted.' : decision === 'deferred' ? 'Decision added to watch.' : 'Decision rejected.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Decision could not be saved');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="veracity-card p-5 lg:p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Scale size={14} className="text-accent" />
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Decision frame
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Situation</p>
          <p className="text-sm text-foreground">{frame.situation}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Recommendation</p>
          <p className="text-sm font-medium text-foreground">{frame.recommendation}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Options</p>
          <ul className="space-y-2">
            {frame.options.map((option) => (
              <li key={option.label} className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-foreground">{option.label}</span>
                  <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                    option.evidenceStatus === 'supported'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : option.evidenceStatus === 'weakly-supported'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {option.evidenceStatus.replace('-', ' ')}
                  </span>
                </div>
                <p>{option.tradeoff}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Criteria</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {frame.criteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}
          </ul>
        </div>
      </div>

      {sessionId ? (
        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <BookmarkCheck size={13} className="text-accent" />
            <p className="text-[10px] font-mono uppercase text-muted-foreground">Record this decision</p>
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why does this fit—or not fit—your situation?"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['accepted', 'Adopt'],
              ['deferred', 'Watch'],
              ['rejected', 'Reject'],
            ] as Array<[DecisionAction, string]>).map(([decision, label]) => (
              <button
                key={decision}
                type="button"
                disabled={!reason.trim() || Boolean(saving)}
                onClick={() => { void saveDecision(decision); }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-mono uppercase text-foreground disabled:opacity-40"
              >
                {saving === decision ? 'Saving…' : label}
              </button>
            ))}
            {status ? <span role="status" className="text-xs text-muted-foreground">{status}</span> : null}
          </div>
        </div>
      ) : null}

      {executive ? (
        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <ShieldAlert size={13} className="text-amber-700" />
            Decision appendix
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <AppendixList label="Assumptions" values={appendix.assumptions} />
            <AppendixList label="Unknowns" values={appendix.unknowns} />
            <AppendixList label="Evidence limitations" values={appendix.evidenceLimitations} />
            <AppendixList label="What would change this" values={appendix.whatWouldChangeThis} />
            <AppendixList label="Alternative hypotheses" values={appendix.alternativeHypotheses} />
            <AppendixList
              label="Confidence drivers"
              values={[
                ...appendix.confidenceDrivers.supports.map((item) => `Supports: ${item}`),
                ...appendix.confidenceDrivers.weakens.map((item) => `Weakens: ${item}`),
              ]}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}

function AppendixList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">{label}</p>
      {values.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {values.slice(0, 5).map((value) => <li key={value}>• {value}</li>)}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None stated.</p>
      )}
    </div>
  );
}
