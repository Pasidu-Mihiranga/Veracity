/**
 * Turning agent output into verified claims.
 *
 * Research agents produce `facts[]` and `interpretation[]`. Those arrays are the
 * product's actual output, and until now they were rendered and forgotten —
 * nothing persisted them, so the Explain path had nothing to read and the
 * evidence-coverage chart had nothing to count.
 *
 * The hard part is honest classification. An agent labels a line a "fact", but
 * that label is the model's own opinion of its output. This module re-derives
 * it: a statement is stored as a `fact` only if a stored excerpt actually
 * supports it. Everything else becomes an `interpretation`, which is a
 * legitimate thing for an analyst to produce and does not require evidence.
 *
 * The alternative — trusting the agent's own label — is how "the market is
 * consolidating" ends up in the ledger as an established fact with a URL next
 * to it.
 */

import { query } from '@/lib/db';
import { saveVerifiedClaims } from './ledger-repo';
import { deriveConfidence } from './claim-verifier';
import type { Claim, EvidenceSpan, MetricObservation } from './types';

export interface AgentClaimInput {
  agentId: string;
  facts: string[];
  interpretation: string[];
}

export interface StoredClaimsResult {
  saved: number;
  asFacts: number;
  asInterpretation: number;
  rejected: Array<{ statement: string; reasons: string[] }>;
}

/** Words too common to indicate a real match between a statement and an excerpt. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'this', 'that', 'from', 'by', 'as', 'at', 'be', 'it', 'its', 'has',
  'have', 'was', 'were', 'their', 'they', 'more', 'than', 'been', 'also',
]);

function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s.$%-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/**
 * Does this excerpt support this statement?
 *
 * Requires substantial overlap of content words *and*, when the statement
 * asserts a number, that the same number appears in the excerpt. The numeric
 * condition is the important one: "prices rose to $59" and "prices rose to $99"
 * share almost every word, and a purely lexical check would happily bind the
 * first statement to the second excerpt.
 */
export function excerptSupports(statement: string, excerpt: string): boolean {
  const statementTokens = contentTokens(statement);
  if (statementTokens.size === 0) return false;

  const excerptTokens = contentTokens(excerpt);
  let overlap = 0;
  for (const token of statementTokens) {
    if (excerptTokens.has(token)) overlap += 1;
  }

  const ratio = overlap / statementTokens.size;
  if (ratio < 0.5) return false;

  // Every number the statement asserts must appear in the excerpt.
  const numbersIn = (text: string) =>
    (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((raw) => raw.replace(/,/g, ''));

  const asserted = numbersIn(statement);
  if (asserted.length === 0) return true;

  const present = new Set(numbersIn(excerpt));
  return asserted.every((n) => present.has(n));
}

/**
 * Load the project's evidence spans, with any observations they back.
 *
 * Bounded: matching against every span a long-running project ever produced
 * would get slower as the project got more valuable, which is the wrong
 * direction. Recent spans are the ones a fresh statement is likely to reference.
 */
async function loadRecentEvidence(params: {
  userId: string;
  projectId: string;
  limit?: number;
}): Promise<{
  spans: Map<string, EvidenceSpan>;
  observationsBySpan: Map<string, MetricObservation[]>;
}> {
  const { rows } = await query<{
    id: string;
    snapshot_id: string;
    excerpt: string;
    entity_match: string;
    extraction_type: string;
    created_at: string;
  }>(
    `SELECT id, snapshot_id, excerpt, entity_match, extraction_type, created_at
       FROM evidence_spans
      WHERE user_id = $1 AND project_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [params.userId, params.projectId, params.limit ?? 200],
  );

  const spans = new Map<string, EvidenceSpan>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        snapshotId: row.snapshot_id,
        excerpt: row.excerpt,
        entityMatch: row.entity_match,
        extractionType: row.extraction_type,
        createdAt: new Date(row.created_at).toISOString(),
      } as EvidenceSpan,
    ]),
  );

  const observationsBySpan = new Map<string, MetricObservation[]>();
  if (spans.size > 0) {
    const { rows: observations } = await query<{
      id: string;
      evidence_span_id: string;
      metric_key: string;
      value: number;
      unit: string;
      is_estimated: boolean;
      observed_at: string;
    }>(
      `SELECT id, evidence_span_id, metric_key, value::float8 AS value, unit,
              is_estimated, observed_at
         FROM metric_observations
        WHERE user_id = $1 AND evidence_span_id = ANY($2)`,
      [params.userId, [...spans.keys()]],
    );

    for (const row of observations) {
      const list = observationsBySpan.get(row.evidence_span_id) ?? [];
      list.push({
        id: row.id,
        evidenceSpanId: row.evidence_span_id,
        metricKey: row.metric_key,
        value: row.value,
        unit: row.unit,
        method: 'extracted',
        isEstimated: row.is_estimated,
        observedAt: new Date(row.observed_at).toISOString(),
      } as MetricObservation);
      observationsBySpan.set(row.evidence_span_id, list);
    }
  }

  return { spans, observationsBySpan };
}

/**
 * Persist an agent's output as verified claims.
 *
 * Returns counts rather than throwing on rejection: a run that produced ten
 * statements of which three could not be supported is a normal outcome worth
 * reporting, not an error.
 */
export async function storeResearchClaims(params: {
  userId: string;
  projectId: string;
  sessionId?: string | null;
  agents: AgentClaimInput[];
}): Promise<StoredClaimsResult> {
  const { spans, observationsBySpan } = await loadRecentEvidence({
    userId: params.userId,
    projectId: params.projectId,
  });

  const spanList = [...spans.values()];
  const claims: Claim[] = [];
  let asFacts = 0;
  let asInterpretation = 0;

  for (const agent of params.agents) {
    for (const statement of agent.facts) {
      const trimmed = statement.trim();
      if (!trimmed) continue;

      const supporting = spanList
        .filter((span) => excerptSupports(trimmed, span.excerpt))
        .map((span) => span.id);

      if (supporting.length > 0) {
        asFacts += 1;
        const allConfirmed = supporting.every(
          (id) => spans.get(id)?.entityMatch === 'confirmed',
        );
        claims.push({
          id: '',
          projectId: params.projectId,
          sessionId: params.sessionId ?? null,
          statement: trimmed,
          claimType: 'fact',
          // Derived deterministically rather than taken from the agent, so a
          // single-source claim can never be labelled high.
          confidence: deriveConfidence({
            supportingCount: supporting.length,
            contradictingCount: 0,
            allEntityMatchesConfirmed: allConfirmed,
          }),
          supportingSpanIds: supporting,
          contradictingSpanIds: [],
          agentId: agent.agentId,
        } as Claim);
      } else {
        // No excerpt supports it, so it is not a fact — whatever the agent
        // called it. Stored as interpretation, which is honest and still
        // useful to the Explain path.
        asInterpretation += 1;
        claims.push({
          id: '',
          projectId: params.projectId,
          sessionId: params.sessionId ?? null,
          statement: trimmed,
          claimType: 'interpretation',
          confidence: 'low',
          supportingSpanIds: [],
          contradictingSpanIds: [],
          agentId: agent.agentId,
        } as Claim);
      }
    }

    for (const line of agent.interpretation) {
      const trimmed = line.trim();
      // Synthesis-failure markers are diagnostics, not analysis.
      if (!trimmed || trimmed.startsWith('SYNTHESIS_ERROR:')) continue;

      asInterpretation += 1;
      claims.push({
        id: '',
        projectId: params.projectId,
        sessionId: params.sessionId ?? null,
        statement: trimmed,
        claimType: 'interpretation',
        confidence: 'low',
        supportingSpanIds: [],
        contradictingSpanIds: [],
        agentId: agent.agentId,
      } as Claim);
    }
  }

  if (claims.length === 0) {
    return { saved: 0, asFacts: 0, asInterpretation: 0, rejected: [] };
  }

  const result = await saveVerifiedClaims({
    userId: params.userId,
    projectId: params.projectId,
    sessionId: params.sessionId,
    claims,
    spans,
    observationsBySpan,
  });

  return {
    saved: result.saved.length,
    asFacts,
    asInterpretation,
    rejected: result.rejected,
  };
}
