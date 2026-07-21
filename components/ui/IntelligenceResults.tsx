'use client';

import type { RefObject } from 'react';
import {
  ArrowUpRight, ChevronRight, GitBranch, Layers, Rocket, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import type { AgentOutput, MindMapOutput } from '@/lib/agents/types';
import type { ChatMessage } from '@/types/chat-ui';
import { ArtifactRenderer } from '@/components/artifacts/ArtifactRenderer';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { DOMAIN_META, domainAccent, type Domain } from '@/lib/domain-meta';
import {
  rateRecommendation, recommendationKey, type RecommendationRating,
} from '@/lib/feedback';

function buildSourceMix(outputs: AgentOutput[] = []) {
  const counts = new Map<string, number>();
  for (const output of outputs) {
    for (const source of output.sources ?? []) {
      counts.set(source.tool, (counts.get(source.tool) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => ({ tool, count }));
}

export type IntelligenceResultsProps = {
  currentResult: ChatMessage;
  currentSessionId: string | null;
  ratedRecs: Record<string, RecommendationRating>;
  onRate: (key: string, rating: RecommendationRating) => void;
  isFollowingUp: boolean;
  isLoading: boolean;
  onFollowUpSuggestion: (suggestion: string) => void;
  followUpEndRef: RefObject<HTMLDivElement | null>;
  isDark: boolean;
  cardBg: string;
  cardBg2: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  accentInk: string;
  borderC: string;
  neuExtruded: string;
  neuExtrudedSm: string;
};

export function IntelligenceResults({
  currentResult,
  currentSessionId,
  ratedRecs,
  onRate,
  isFollowingUp,
  isLoading,
  onFollowUpSuggestion,
  followUpEndRef,
  isDark,
  cardBg,
  cardBg2,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
  borderC,
  neuExtruded,
  neuExtrudedSm,
}: IntelligenceResultsProps) {
  if (!currentResult.content) return null;

  const mindMapOutput = currentResult.orchestratorOutput?.outputs?.find(
    o => o.artifactType === 'mind-map',
  ) as MindMapOutput | undefined;

  return (
    <>
      <div className="rounded-lg overflow-hidden" style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: 'none' }}>
          <div className="flex items-center gap-2">
            <Layers size={14} style={{ color: accentInk }} />
            <span className="text-[12px] font-mono font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
              Intelligence Summary
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const final = currentResult.orchestratorOutput?.metrics;
              const live = currentResult.liveMetrics;
              if (!final && !live) return null;
              const latencyMs = final?.totalLatencyMs ?? live?.elapsedMs ?? 0;
              const cost = final?.estimatedCostUsd ?? live?.estimatedCostUsd ?? 0;
              const agentTotal = final?.agentCount ?? live?.agentCount ?? 0;
              const agentDone = final?.completedAgentCount ?? live?.completedAgentCount ?? 0;
              const geminiCalls = final?.geminiCallCount ?? live?.geminiCallCount ?? 0;
              const toolCalls = final?.toolCallCount ?? live?.toolCallCount ?? 0;
              const isLive = !final && !!live;
              return (
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-2"
                  style={{ color: textSubtle, background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}
                >
                  {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#3D9EFF' }} />}
                  <span title="Wall-clock latency">{(latencyMs / 1000).toFixed(1)}s</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span title="Estimated cost">${cost.toFixed(4)}</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span title="Agents completed / dispatched">{agentDone}/{agentTotal} agents</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span title="Model calls">{isLive ? `~${geminiCalls}` : geminiCalls} calls</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span title="External tool invocations">{isLive ? `~${toolCalls}` : toolCalls} tools</span>
                </span>
              );
            })()}
            {currentResult.orchestratorOutput?.product && (
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded"
                style={{ color: accentInk, background: 'rgba(0,196,255,0.1)', border: '1px solid rgba(0,196,255,0.2)' }}
              >
                {currentResult.orchestratorOutput.product}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 lg:p-8 flex flex-col gap-8">
          <p className="prose-answer">{currentResult.content}</p>

          {(() => {
            const refinement = currentResult.orchestratorOutput?.refinement;
            const sourceMix = buildSourceMix(currentResult.orchestratorOutput?.outputs ?? []);
            const researchRuns = (currentResult.agentRuns ?? []).filter(r =>
              ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'].includes(r.agentId),
            );
            const executionRun = (currentResult.agentRuns ?? []).find(r => r.agentId === 'execution-engine');
            const researchDone = researchRuns.filter(r => r.status === 'completed').length;
            const researchFailed = researchRuns.filter(r => r.status === 'failed').length;
            return (
              <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: textSubtle }}>
                  <span>Phases</span>
                  <span className="px-2 py-0.5 rounded-full" style={{ color: accentInk, background: 'rgba(0,196,255,0.08)', border: '1px solid rgba(0,196,255,0.2)' }}>
                    research {researchDone}/{Math.max(researchRuns.length, 6)}{researchFailed > 0 ? ` · ${researchFailed} failed` : ''}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      color: executionRun?.status === 'completed' || executionRun?.status === 'running' ? accentInk : textSubtle,
                      background: executionRun?.status === 'completed' || executionRun?.status === 'running' ? 'rgba(0,196,255,0.08)' : 'transparent',
                      border: `1px solid ${executionRun?.status === 'completed' || executionRun?.status === 'running' ? 'rgba(0,196,255,0.2)' : borderC}`,
                    }}
                  >
                    execution {executionRun?.status ?? 'idle'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      color: refinement ? accentInk : textSubtle,
                      background: refinement ? 'rgba(0,196,255,0.08)' : 'transparent',
                      border: `1px solid ${refinement ? 'rgba(0,196,255,0.2)' : borderC}`,
                    }}
                  >
                    refinement {refinement ? 'applied' : 'idle'}
                  </span>
                </div>

                {sourceMix.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono" style={{ color: textSubtle }}>
                    <span className="uppercase tracking-wider">Source mix</span>
                    {sourceMix.map(({ tool, count }) => (
                      <span key={tool} className="px-2 py-0.5 rounded-full" style={{ color: accentInk, background: 'rgba(0,196,255,0.08)', border: '1px solid rgba(0,196,255,0.2)' }}>
                        {tool} × {count}
                      </span>
                    ))}
                  </div>
                )}

                {refinement && refinement.deltas.length > 0 && (
                  <div className="rounded-md p-3" style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>Before / after refinement</p>
                        <p className="text-[11px] mt-1" style={{ color: textMuted }}>
                          {refinement.feedbackApplied.variantResults} variant results, {refinement.feedbackApplied.recommendationFeedback} ratings, {refinement.feedbackApplied.recommendationActions} actions
                        </p>
                      </div>
                      {refinement.focus && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ color: accentInk, background: 'rgba(0,196,255,0.08)', border: '1px solid rgba(0,196,255,0.2)' }}>
                          {refinement.focus}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {refinement.deltas.slice(0, 3).map(delta => (
                        <div key={`${delta.domain}-${delta.summary}`} className="rounded-md p-2.5" style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accentInk }}>{delta.domain}</span>
                            {delta.beforeConfidence && <ConfidenceBadge level={delta.beforeConfidence} />}
                            <ArrowUpRight size={10} style={{ color: textSubtle, transform: 'rotate(45deg)' }} />
                            {delta.afterConfidence && <ConfidenceBadge level={delta.afterConfidence} />}
                          </div>
                          <p className="text-[11px] mt-1" style={{ color: textMuted }}>{delta.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {currentResult.orchestratorOutput?.outputs?.length ? (
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: textSubtle }}>
                <Layers size={13} /> Domain Highlights
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {currentResult.orchestratorOutput.outputs
                  .filter(o => o.artifactType !== 'mind-map')
                  .slice(0, 6)
                  .map((o, i) => {
                    const domainMeta = DOMAIN_META[o.domain as Domain];
                    return (
                      <div
                        key={`${o.domain}-${i}`}
                        className="rounded-xl p-4 transition-all"
                        style={{
                          background: cardBg2,
                          border: 'none',
                          boxShadow: neuExtrudedSm,
                          borderLeft: `3px solid ${domainMeta?.color ?? borderC}`,
                        }}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5">
                            {domainMeta && <span style={{ color: domainMeta.color }}>{domainMeta.icon}</span>}
                            <span className="text-[12px] font-mono font-bold uppercase tracking-wide" style={{ color: domainMeta ? domainAccent(domainMeta, isDark) : textSubtle }}>
                              {domainMeta?.short ?? o.domain}
                            </span>
                          </div>
                          <ConfidenceBadge level={o.confidence} />
                        </div>
                        <p className="text-[13px] leading-relaxed font-medium" style={{ color: isDark ? '#d4d4d4' : '#333' }}>
                          {o.interpretation?.[0] || o.facts?.[0] || 'No highlight available.'}
                        </p>
                        {o.sources?.length ? (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5" style={{ borderTop: 'none' }}>
                            {o.sources.slice(0, 2).map(source => (
                              <a
                                key={source.url}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md transition-colors"
                                style={{ color: textMuted, background: cardBg, boxShadow: neuExtruded, border: 'none' }}
                              >
                                {source.title} <ArrowUpRight size={8} />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          {currentResult.recommendations && currentResult.recommendations.length > 0 && (
            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: textSubtle }}>
                <Rocket size={13} /> Strategic Recommendations
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentResult.recommendations.map((rec: { title?: string; rationale?: string; priority?: string; confidence?: string; score?: number; evidence?: string[] }, i: number) => {
                  const rk = recommendationKey(rec.title ?? '', rec.rationale ?? '');
                  const current = ratedRecs[rk];
                  const rate = (rating: RecommendationRating) => {
                    onRate(rk, rating);
                    if (!currentSessionId) return;
                    rateRecommendation({
                      sessionId: currentSessionId,
                      title: rec.title ?? '',
                      rationale: rec.rationale ?? '',
                      rating,
                    });
                  };
                  return (
                    <div key={i} className="rounded-lg p-4 flex flex-col gap-2.5" style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className="text-[10px] font-mono font-medium px-2 py-0.5 rounded uppercase"
                          style={{
                            color: rec.priority === 'immediate' ? '#0B1A2E' : '#3D9EFF',
                            background: rec.priority === 'immediate' ? 'rgba(11,26,46,0.1)' : 'rgba(61,158,255,0.1)',
                            border: `1px solid ${rec.priority === 'immediate' ? 'rgba(11,26,46,0.25)' : 'rgba(61,158,255,0.25)'}`,
                          }}
                        >
                          {rec.priority ?? 'strategic'}
                        </span>
                        <ConfidenceBadge
                          level={(rec.confidence as 'high' | 'medium' | 'low' | undefined)
                            ?? ((rec.score ?? 0) >= 80 ? 'high' : (rec.score ?? 0) >= 55 ? 'medium' : 'low')}
                        />
                      </div>
                      <h4 className="rec-title">{rec.title}</h4>
                      <p className="rec-body">{rec.rationale}</p>
                      {(rec.evidence?.length ?? 0) > 0 && (
                        <ul className="flex flex-col gap-1 mt-1">
                          {rec.evidence!.map((e, ei) => (
                            <li key={ei} className="text-[11px] flex items-start gap-1.5" style={{ color: textSubtle }}>
                              <span className="font-mono mt-0.5 shrink-0" style={{ color: isDark ? '#333' : '#ccc' }}>›</span>{e}
                            </li>
                          ))}
                        </ul>
                      )}
                      {currentSessionId && (
                        <div className="flex items-center gap-1.5 mt-1 pt-2" style={{ borderTop: 'none' }}>
                          <button
                            type="button"
                            onClick={() => rate('up')}
                            title="Useful"
                            className="p-1 rounded transition-colors"
                            style={{
                              color: current === 'up' ? accentInk : textSubtle,
                              background: current === 'up' ? 'rgba(0,196,255,0.12)' : 'transparent',
                            }}
                          >
                            <ThumbsUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => rate('down')}
                            title="Not useful"
                            className="p-1 rounded transition-colors"
                            style={{
                              color: current === 'down' ? '#0B1A2E' : textSubtle,
                              background: current === 'down' ? 'rgba(11,26,46,0.12)' : 'transparent',
                            }}
                          >
                            <ThumbsDown size={12} />
                          </button>
                          {current && (
                            <span className="text-[9px] font-mono ml-1" style={{ color: current === 'up' ? accentInk : '#0B1A2E' }}>
                              {current === 'up' ? 'Validated' : 'Rejected'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentResult.sources && currentResult.sources.length > 0 && (
            <div className="flex items-start gap-3 pt-4" style={{ borderTop: 'none' }}>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest shrink-0 mt-1" style={{ color: textSubtle }}>sources</span>
              <div className="flex flex-wrap gap-1.5">
                {currentResult.sources.map(source => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors"
                    style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none', color: textMuted }}
                    onMouseEnter={e => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.style.color = accentInk;
                      a.style.borderColor = isDark ? 'rgba(0,196,255,0.3)' : 'rgba(0,82,163,0.35)';
                    }}
                    onMouseLeave={e => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.style.color = textMuted;
                      a.style.borderColor = borderC;
                    }}
                  >
                    {source.title} <ArrowUpRight size={9} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {currentResult.suggestions && currentResult.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: 'none' }}>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: textSubtle }}>dig deeper</span>
              {currentResult.suggestions.map(sug => (
                <button
                  key={sug}
                  type="button"
                  disabled={isFollowingUp || isLoading}
                  onClick={() => {
                    followUpEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    requestAnimationFrame(() => onFollowUpSuggestion(sug));
                  }}
                  className="text-[12px] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all disabled:opacity-45 disabled:pointer-events-none"
                  style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none', color: textMuted }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    if (b.disabled) return;
                    b.style.color = accentInk;
                    b.style.borderColor = isDark ? 'rgba(0,196,255,0.4)' : 'rgba(0,82,163,0.4)';
                    b.style.background = isDark ? 'rgba(0,196,255,0.06)' : 'rgba(0,82,163,0.06)';
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.color = textMuted;
                    b.style.borderColor = borderC;
                    b.style.background = cardBg2;
                  }}
                >
                  {sug} <ChevronRight size={11} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {mindMapOutput?.branches?.length ? (
        <div className="rounded-lg overflow-hidden" style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: 'none' }}>
            <GitBranch size={14} style={{ color: accentInk }} />
            <span className="text-[12px] font-mono font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
              Mind Map
            </span>
          </div>
          <div className="p-4">
            <ArtifactRenderer output={mindMapOutput} product={currentResult.orchestratorOutput?.product ?? ''} />
          </div>
        </div>
      ) : null}
    </>
  );
}
