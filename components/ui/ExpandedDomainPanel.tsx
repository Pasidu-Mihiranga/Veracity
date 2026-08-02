'use client';

import { Activity, CheckCircle2, X } from 'lucide-react';
import type { AgentOutput, ExecutionPlanOutput, OrchestratorOutput, RefinementDelta } from '@/lib/agents/types';
import { ArtifactRenderer } from '@/components/artifacts/ArtifactRenderer';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';

export type ExpandedDomainPanelProps = {
  domain: Domain;
  output: AgentOutput | null | undefined;
  product: string;
  sessionId: string | null;
  messageId: string | null;
  onClose: () => void;
  onRefined: (result: {
    plan: ExecutionPlanOutput;
    changes?: RefinementDelta[];
    orchestratorOutput?: OrchestratorOutput;
  }) => void;
  isDark: boolean;
  cardBg: string;
  textMain: string;
  textMuted: string;
  accentInk: string;
};

export function ExpandedDomainPanel({
  domain,
  output,
  product,
  sessionId,
  messageId,
  onClose,
  onRefined,
  isDark,
  cardBg,
  textMain,
  textMuted,
  accentInk,
}: ExpandedDomainPanelProps) {
  const meta = DOMAIN_META[domain];
  const accent = domainAccent(meta, isDark);

  return (
    <div
      className="veracity-card overflow-hidden"
      style={{
        background: cardBg,
        boxShadow: `var(--shadow-extruded), 0 0 0 2px ${accent}33`,
      }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="neu-well w-9 h-9">
            <span style={{ color: accent }}>{meta.icon}</span>
          </div>
          <span className="text-[15px] font-display font-extrabold tracking-tight" style={{ color: textMain }}>
            {meta.label}
          </span>
          {output && <ConfidenceBadge level={output.confidence} />}
          {output?.contextOnly ? (
            <span
              className="text-[8px] font-mono font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                color: isDark ? '#FCD34D' : '#92400E',
                background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(254,243,199,1)',
              }}
            >
              {output.contextOnlyLabel ?? 'Category context only'}
            </span>
          ) : null}
          <span
            className="neu-pill-accent text-[9px] font-mono font-semibold uppercase tracking-widest px-2.5 py-0.5"
            style={{ color: accent }}
          >
            live
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ color: textMuted }}
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      <div className="p-6 lg:p-8 flex flex-col gap-5">
        {output ? (
          <ArtifactRenderer
            output={output}
            product={product}
            sessionId={sessionId}
            messageId={messageId}
            onRefined={onRefined}
          />
        ) : (
          <div className="neu-inset rounded-3xl p-6">
            <p className="text-sm font-bold mb-2" style={{ color: textMain }}>
              {meta.short} details are loading
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
              This agent is still running or returned no structured artifact yet. Try enabling the Swarm Decision Lab and ask a concrete decision or objection-testing question.
            </p>
          </div>
        )}

        {output && output.facts.filter(f => !f.startsWith('[')).length > 0 && (
          <div className="neu-extruded rounded-3xl p-5">
            <p className="ui-section-label mb-4 flex items-center gap-2" style={{ color: accentInk }}>
              <span className="neu-well w-7 h-7">
                <CheckCircle2 size={13} style={{ color: accentInk }} />
              </span>
              Key facts
            </p>
            <ul className="flex flex-col gap-3">
              {output.facts.filter(f => !f.startsWith('[')).map((f, i) => (
                <li
                  key={i}
                  className="neu-inset rounded-2xl px-3.5 py-2.5 flex items-start gap-3 text-[13.5px] leading-relaxed"
                  style={{ color: textMuted, boxShadow: 'var(--shadow-inset-sm)' }}
                >
                  <span className="font-mono mt-0.5 shrink-0 font-bold" style={{ color: accentInk }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {output && output.interpretation.length > 0 && (
          <div className="neu-extruded rounded-3xl p-5">
            <p className="ui-section-label mb-4 flex items-center gap-2" style={{ color: accentInk }}>
              <span className="neu-well w-7 h-7">
                <Activity size={13} className="text-accent" />
              </span>
              Analysis
            </p>
            <ul className="flex flex-col gap-3">
              {output.interpretation.map((interp, i) => (
                <li
                  key={i}
                  className="neu-inset rounded-2xl px-3.5 py-2.5 flex items-start gap-3 text-[13.5px] leading-relaxed"
                  style={{ color: textMuted, boxShadow: 'var(--shadow-inset-sm)' }}
                >
                  <span className="font-mono mt-0.5 shrink-0 font-bold text-accent">›</span>
                  <span>{interp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
