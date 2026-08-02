/**
 * The shared evidence pack.
 *
 * Agents produce statements; the ledger stores evidence. Until now nothing
 * connected the two at the point of writing, so `claims-from-research` had to
 * *guess* afterwards which excerpt supported which statement by lexical
 * similarity. That guess is conservative by design — it under-matches — which
 * means real facts get filed as interpretation and the fact count reads low.
 *
 * The fix is to give agents the evidence up front, with ids, and ask them to
 * cite. A citation the agent made is direct testimony about what it used;
 * a similarity score computed afterwards is an inference about what it might
 * have used. The first is worth far more.
 *
 * Two properties this preserves:
 *
 *  - **Citing is not trusted blindly.** A cited id must exist in the pack that
 *    agent was given, and the excerpt must still support the statement. An
 *    agent that invents `[span-999]` gets it stripped, exactly as a
 *    hallucinated URL would be.
 *  - **The heuristic stays as a fallback.** Agents that do not cite still get
 *    matched the old way, so this improves the ceiling without lowering the
 *    floor.
 */

import { query } from '@/lib/db';

export interface PackedSpan {
  id: string;
  excerpt: string;
  sourceUrl: string;
  entityLabel: string;
  entityMatch: string;
  /** Present when a metric observation backs this span. */
  metric?: { key: string; value: number; unit: string };
}

export interface EvidencePack {
  projectId: string;
  spans: PackedSpan[];
  /** Rendered block for injection into an agent prompt. */
  promptBlock: string;
  /** Ids the pack contains, for validating what an agent cites back. */
  validIds: Set<string>;
}

/** Empty pack, so callers never branch on null. */
export const EMPTY_PACK: EvidencePack = {
  projectId: '',
  spans: [],
  promptBlock: '',
  validIds: new Set(),
};

/**
 * Build the pack for a project.
 *
 * Bounded and recency-ordered. An unbounded pack would grow until it crowded
 * the actual question out of the prompt, and the newest evidence is what a
 * current question is most likely to concern.
 *
 * Spans whose entity match is a known mismatch are excluded outright: offering
 * an agent an excerpt about the wrong company invites exactly the citation we
 * would then have to reject.
 */
export async function buildEvidencePack(params: {
  userId: string;
  projectId: string;
  limit?: number;
}): Promise<EvidencePack> {
  const { rows } = await query<{
    id: string;
    excerpt: string;
    entity_match: string;
    source_url: string;
    entity_label: string | null;
    metric_key: string | null;
    metric_value: number | null;
    metric_unit: string | null;
  }>(
    `SELECT s.id, s.excerpt, s.entity_match,
            snap.source_url,
            ent.display_name AS entity_label,
            o.metric_key, o.value::float8 AS metric_value, o.unit AS metric_unit
       FROM evidence_spans s
       JOIN source_snapshots snap ON snap.id = s.snapshot_id
       LEFT JOIN canonical_entities ent ON ent.id = snap.entity_id
       LEFT JOIN metric_observations o ON o.evidence_span_id = s.id
      WHERE s.user_id = $1 AND s.project_id = $2
        AND s.entity_match <> 'mismatch'
      ORDER BY s.created_at DESC
      LIMIT $3`,
    [params.userId, params.projectId, params.limit ?? 60],
  );

  const spans: PackedSpan[] = rows.map((row) => ({
    id: row.id,
    excerpt: row.excerpt,
    sourceUrl: row.source_url,
    entityLabel: row.entity_label ?? 'unknown entity',
    entityMatch: row.entity_match,
    metric:
      row.metric_key && row.metric_value !== null && row.metric_unit
        ? { key: row.metric_key, value: row.metric_value, unit: row.metric_unit }
        : undefined,
  }));

  return {
    projectId: params.projectId,
    spans,
    promptBlock: renderPromptBlock(spans),
    validIds: new Set(spans.map((s) => s.id)),
  };
}

/**
 * Render the pack for an agent prompt.
 *
 * The instruction is explicit that citing is for statements *taken from* the
 * evidence, not decoration. Without that, models cite the nearest-looking span
 * on every line, which produces confident-looking citations that do not
 * support what they are attached to — worse than no citation, because it looks
 * checked.
 */
function renderPromptBlock(spans: PackedSpan[]): string {
  if (spans.length === 0) return '';

  const lines = [
    'STORED EVIDENCE — excerpts already collected and verified for this project.',
    '',
    'When a fact you state comes from one of these excerpts, append its id in',
    'square brackets, e.g. "The Team plan is $59 per month [span-abc]". Cite only',
    'when the excerpt actually says what you are stating. Do not cite an id for a',
    'statement the excerpt does not support, and never invent an id.',
    '',
  ];

  for (const span of spans) {
    const metric = span.metric
      ? ` (measured: ${span.metric.key} = ${span.metric.value} ${span.metric.unit})`
      : '';
    lines.push(`[${span.id}] ${span.entityLabel}: "${span.excerpt}"${metric}`);
  }

  return lines.join('\n');
}

const CITATION_PATTERN = /\[([0-9a-fA-F-]{8,})\]/g;

/**
 * Pull cited span ids out of a statement, keeping only ones the agent was
 * actually given.
 *
 * An id outside the pack is a hallucination and is dropped, exactly as an
 * invented URL would be. Returns the cleaned statement alongside the ids so the
 * bracket markup does not end up rendered to the user.
 */
export function extractCitations(
  statement: string,
  pack: EvidencePack,
): { statement: string; citedSpanIds: string[]; hallucinatedIds: string[] } {
  const cited: string[] = [];
  const hallucinated: string[] = [];

  for (const match of statement.matchAll(CITATION_PATTERN)) {
    const id = match[1];
    if (pack.validIds.has(id)) cited.push(id);
    else hallucinated.push(id);
  }

  return {
    statement: statement.replace(CITATION_PATTERN, '').replace(/\s{2,}/g, ' ').trim(),
    citedSpanIds: [...new Set(cited)],
    hallucinatedIds: [...new Set(hallucinated)],
  };
}

/** Look up a span the agent cited, for re-verifying it supports the statement. */
export function spanById(pack: EvidencePack, id: string): PackedSpan | undefined {
  return pack.spans.find((s) => s.id === id);
}
