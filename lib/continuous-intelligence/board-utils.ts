import type { BoardPack, DecisionFrame } from '@/lib/agents/types';

type TimelineEvent = {
  event_date: string;
  competitor: string;
  title: string;
  summary: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  materiality_score: number;
  source_urls: unknown;
};

type DecisionRow = {
  title: string;
  decision: string;
  outcome: string;
  reason: string;
  confidence: number;
  created_at: string;
};

export type ContinuousBoardPack = BoardPack & {
  operatingMetrics: {
    eventCount: number;
    highSeverityCount: number;
    competitorCount: number;
    decisionCount: number;
    acceptedDecisionCount: number;
    periodDays: number;
  };
  source: 'continuous-intelligence';
};

export type BoardPackSnapshotRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  scope_key: string;
  period_start: string;
  period_end: string;
  pack: ContinuousBoardPack;
  event_count: number;
  decision_count: number;
  content_hash: string;
  refresh_reason: string;
  generated_at: string;
};

export function assembleContinuousBoardPack(
  events: TimelineEvent[],
  decisions: DecisionRow[],
  periodDays: number,
  now = new Date(),
): ContinuousBoardPack {
  const high = events.filter((event) => event.severity === 'high');
  const competitors = [...new Set(events.map((event) => event.competitor))];
  const accepted = decisions.filter((decision) => decision.decision === 'accepted');
  const categories = histogram(events.map((event) => event.category));
  const categorySummary = Object.entries(categories)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([category, count]) => `${category}: ${count}`);
  const primary = high[0] ?? events[0];
  const recommendation = primary
    ? `Review ${primary.competitor}: ${primary.title}`
    : 'Continue monitoring; no material competitive events were recorded.';
  const decisionFrame: DecisionFrame = {
    situation: events.length > 0
      ? `${events.length} material competitive event(s) across ${competitors.length} competitor(s) were recorded in the last ${periodDays} days.`
      : `No material competitive events were recorded in the last ${periodDays} days.`,
    options: [
      {
        label: primary ? 'Respond to the highest-priority signal' : 'Maintain the current posture',
        tradeoff: primary
          ? `Fast response to a ${primary.severity}-severity ${primary.category} signal, subject to source verification.`
          : 'Avoids unnecessary action while the evidence base is quiet.',
        evidenceStatus: primary?.source_urls && sourceCount(primary.source_urls) > 0
          ? 'supported'
          : 'weakly-supported',
      },
      {
        label: 'Continue monitoring and gather corroboration',
        tradeoff: 'Reduces false-positive risk but may delay response to a real market move.',
        evidenceStatus: events.length > 0 ? 'weakly-supported' : 'supported',
      },
    ],
    criteria: [
      'Event severity and materiality',
      'Primary-source coverage',
      'Recency and repetition across the timeline',
      'Alignment with accepted or rejected decision memory',
    ],
    recommendation,
    risks: [
      ...(high.length > 0
        ? [`${high.length} high-severity event(s) remain open for executive review.`]
        : []),
      ...(events.some((event) => sourceCount(event.source_urls) === 0)
        ? ['Some timeline events lack a persisted source URL.']
        : []),
      ...(events.length === 0
        ? ['A quiet timeline may reflect collection gaps rather than a quiet market.']
        : []),
    ],
    falsifiers: [
      'A primary source retracts or materially changes the underlying event.',
      'The next monitoring sweep finds no corroborating evidence for the highest-priority signal.',
      'Buyer or internal decision evidence shows the signal is not relevant to the current strategy.',
    ],
  };
  const executiveBrief = events.length > 0
    ? `${events.length} material moves were recorded across ${competitors.length} competitors; ${high.length} are high severity. ${categorySummary.join(' · ')}.`
    : `No material competitor moves were recorded in the last ${periodDays} days. Treat this as a monitoring result, not proof that the market was inactive.`;
  const generatedAt = now.toISOString();
  return {
    title: `Continuous intelligence board pack · last ${periodDays} days`,
    executiveBrief,
    decision: decisionFrame,
    sections: [
      { id: 'situation', title: 'Operating situation', bullets: [decisionFrame.situation] },
      {
        id: 'options',
        title: 'Response options',
        bullets: decisionFrame.options.map((option) => `${option.label}: ${option.tradeoff}`),
      },
      { id: 'criteria', title: 'Decision criteria', bullets: decisionFrame.criteria },
      { id: 'recommendation', title: 'Recommended review', bullets: [recommendation] },
      { id: 'risks', title: 'Risks and gaps', bullets: decisionFrame.risks },
      { id: 'falsifiers', title: 'What would change this', bullets: decisionFrame.falsifiers },
      {
        id: 'evidence',
        title: 'Material evidence',
        bullets: events.slice(0, 8).map((event) =>
          `${event.event_date} · ${event.competitor} · ${event.category} · ${event.title}`,
        ),
      },
    ],
    timeline: events.slice(0, 20).map((event) => ({
      date: event.event_date,
      label: `${event.competitor} · ${event.category}`,
      detail: event.summary || event.title,
      sourceUrl: firstSource(event.source_urls),
    })),
    decisionMemory: decisions.slice(0, 10).map((decision) =>
      `${decision.decision.toUpperCase()} · ${decision.title} · ${decision.outcome}${decision.reason ? ` · ${decision.reason}` : ''}`,
    ),
    generatedAt,
    operatingMetrics: {
      eventCount: events.length,
      highSeverityCount: high.length,
      competitorCount: competitors.length,
      decisionCount: decisions.length,
      acceptedDecisionCount: accepted.length,
      periodDays,
    },
    source: 'continuous-intelligence',
  };
}

function histogram(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function sourceCount(value: unknown): number {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

export function firstSource(value: unknown): string | undefined {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}
