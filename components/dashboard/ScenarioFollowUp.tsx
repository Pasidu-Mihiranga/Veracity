'use client';

import React, { useState } from 'react';
import { MessageCircleQuestion, AlertTriangle } from 'lucide-react';

/**
 * Ask a follow-up of a panel that has already answered.
 *
 * Scope is the interesting control. Asking one persona is cheap and specific;
 * asking the whole panel again costs a full round. The default is therefore the
 * narrowest useful scope rather than the broadest, and the cost of each choice
 * is stated rather than left for the user to discover from a bill.
 */

export interface ScenarioFollowUpProps {
  scenarioId: string;
  segments: Array<{ id: string; label: string }>;
  personas: string[];
  onAsked?: () => void;
}

type Scope = 'panel' | 'segment' | 'persona';

export function ScenarioFollowUp({
  scenarioId,
  segments,
  personas,
  onAsked,
}: ScenarioFollowUpProps) {
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<Scope>('segment');
  const [target, setTarget] = useState(segments[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const respondentCount =
    scope === 'panel' ? personas.length : scope === 'persona' ? 1 : '≈' + Math.max(1, Math.round(personas.length / Math.max(segments.length, 1)));

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/follow-up`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          scope,
          scopeTarget: scope === 'panel' ? undefined : target,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? 'The follow-up could not be run');
        return;
      }

      const { answered, failed } = body.data;
      // Partial results are reported as partial rather than presented as a
      // complete round.
      setResult(
        failed > 0
          ? `${answered} answered, ${failed} failed — this is a partial round.`
          : `${answered} persona(s) answered.`,
      );
      setQuestion('');
      onAsked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The follow-up could not be run');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="veracity-card p-4 flex flex-col gap-3">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
        <MessageCircleQuestion size={12} /> Ask this panel a follow-up
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Why does procurement object to the higher tier?"
        rows={2}
        className="text-xs bg-muted border border-border rounded-lg px-2.5 py-2 text-foreground placeholder:text-muted-foreground resize-y"
      />

      <div className="flex items-center gap-2 flex-wrap">
        {(['persona', 'segment', 'panel'] as Scope[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setScope(option);
              if (option === 'segment') setTarget(segments[0]?.id ?? '');
              if (option === 'persona') setTarget(personas[0] ?? '');
            }}
            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
              scope === option
                ? 'bg-accent/5 text-accent border-accent/20'
                : 'bg-muted text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {option}
          </button>
        ))}

        {scope !== 'panel' ? (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="text-[10px] font-mono bg-muted border border-border rounded px-2 py-1 text-foreground"
          >
            {(scope === 'segment' ? segments.map((s) => [s.id, s.label] as const) : personas.map((p) => [p, p] as const)).map(
              ([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ),
            )}
          </select>
        ) : null}

        {/* The cost is stated up front rather than discovered afterwards. */}
        <span className="text-[10px] font-mono text-muted-foreground">
          {respondentCount} respondent{respondentCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || !question.trim()}
          className="bg-gradient-signature text-white rounded-lg py-1.5 px-3 text-xs font-medium disabled:opacity-50"
        >
          {busy ? 'Asking…' : 'Ask'}
        </button>

        {result ? <span className="text-[10px] font-mono text-muted-foreground">{result}</span> : null}
        {error ? (
          <span className="text-[10px] font-mono text-amber-700 inline-flex items-center gap-1">
            <AlertTriangle size={10} /> {error}
          </span>
        ) : null}
      </div>

      <p className="text-[10px] font-mono text-muted-foreground">
        Recorded as a further round on this scenario, so the thread stays intact.
      </p>
    </div>
  );
}
