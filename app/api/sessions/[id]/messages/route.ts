import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { compareSourceCoverage, extractProjectSnapshot } from '@/lib/project-snapshot-data';
import { storeResearchClaims, type AgentClaimInput } from '@/lib/intelligence/claims-from-research';
import { buildEvidencePack } from '@/lib/intelligence/evidence-pack';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function assertSessionOwner(sessionId: string, userId: string) {
  const { rows } = await query<{ id: string; project_id: string | null }>(
    `SELECT id, project_id FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [sessionId, userId],
  );
  return rows[0] ?? null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await ctx.params;
  const owned = await assertSessionOwner(id, user.id);
  if (!owned) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { rows } = await query(
    `SELECT id, session_id, role, content, metadata, created_at
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [id],
  );
  return NextResponse.json({ messages: rows });
}

/**
 * Pull each agent's statements out of the persisted orchestrator output.
 *
 * Reads the same `metadata.orchestratorOutput` the snapshot extractor uses, so
 * the two stay consistent about what a research turn produced.
 */
function agentClaimInputs(metadata: unknown): AgentClaimInput[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const output = (metadata as {
    orchestratorOutput?: {
      outputs?: Array<{ agentId?: string; facts?: string[]; interpretation?: string[] }>;
    };
  }).orchestratorOutput;

  if (!Array.isArray(output?.outputs)) return [];

  return output.outputs
    .map((agent) => ({
      agentId: agent.agentId ?? 'unknown',
      facts: Array.isArray(agent.facts) ? agent.facts : [],
      interpretation: Array.isArray(agent.interpretation) ? agent.interpretation : [],
    }))
    .filter((agent) => agent.facts.length > 0 || agent.interpretation.length > 0);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await ctx.params;
  const owned = await assertSessionOwner(id, user.id);
  if (!owned) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const role = body.role === 'assistant' ? 'assistant' : 'user';
  const content = String(body.content ?? '');
  const metadata = body.metadata ?? {};
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const { rows } = await query<{ id: string }>(
    `INSERT INTO chat_messages (session_id, role, content, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [id, role, content, JSON.stringify(metadata)],
  );

  await query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [id]);

  const messageId = rows[0]?.id ?? null;
  const snapshot = role === 'assistant' && owned.project_id
    ? extractProjectSnapshot(metadata, content)
    : null;
  if (snapshot && messageId && owned.project_id) {
    try {
      const previous = await query<{ source_urls: string[] }>(
        `SELECT source_urls FROM project_research_snapshots
         WHERE project_id = $1 ORDER BY generated_at DESC LIMIT 1`,
        [owned.project_id],
      );
      const inserted = await query<{ id: string }>(
        `INSERT INTO project_research_snapshots
          (project_id, session_id, message_id, product, competitor, summary,
           source_urls, source_count, evidence_score, generated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
         ON CONFLICT (message_id) DO NOTHING
         RETURNING id`,
        [
          owned.project_id, id, messageId, snapshot.product, snapshot.competitor,
          snapshot.summary, JSON.stringify(snapshot.sourceUrls), snapshot.sourceCount,
          snapshot.evidenceScore, snapshot.generatedAt,
        ],
      );
      const snapshotId = inserted.rows[0]?.id;
      if (snapshotId && previous.rows[0]) {
        const before = Array.isArray(previous.rows[0].source_urls) ? previous.rows[0].source_urls : [];
        const change = compareSourceCoverage(before, snapshot.sourceUrls);
        if (change.added.length || change.removed.length) {
          await query(
            `INSERT INTO project_research_events
              (project_id, snapshot_id, event_type, title, details, observed_at)
             VALUES ($1,$2,'coverage_changed',$3,$4::jsonb,$5)`,
            [
              owned.project_id,
              snapshotId,
              `Research coverage changed: ${change.added.length} added, ${change.removed.length} removed`,
              JSON.stringify(change),
              snapshot.generatedAt,
            ],
          );
        }
      }
    } catch (error) {
      console.error('project snapshot persistence failed', error instanceof Error ? error.message : String(error));
    }

    // Persist the agents' statements as verified claims.
    //
    // Until this ran, agent output was rendered and forgotten: the Explain path
    // had nothing to read and the evidence-coverage chart had nothing to count.
    // Classification is re-derived here rather than trusted from the agent — a
    // statement is stored as a fact only when a stored excerpt supports it, and
    // is otherwise kept as interpretation.
    //
    // Deliberately non-fatal. The message is already saved and is what the user
    // asked for; failing the request because a secondary write failed would
    // lose their turn over bookkeeping.
    try {
      const agents = agentClaimInputs(metadata);
      if (agents.length > 0) {
        // The same pack the agents were given, so any id they cited can be
        // validated against what they actually had rather than against the
        // whole ledger.
        const pack = await buildEvidencePack({
          userId: user.id,
          projectId: owned.project_id,
        });

        const stored = await storeResearchClaims({
          userId: user.id,
          projectId: owned.project_id,
          sessionId: id,
          agents,
          pack,
        });
        logger.info('claims.stored', {
          projectId: owned.project_id,
          saved: stored.saved,
          asFacts: stored.asFacts,
          asInterpretation: stored.asInterpretation,
          citedByAgent: stored.citedByAgent,
          matchedHeuristically: stored.matchedHeuristically,
          // Worth watching: a rising count means agents are inventing ids,
          // which the pack instructions are supposed to prevent.
          hallucinatedCitations: stored.hallucinatedCitations,
          rejected: stored.rejected.length,
        });
      }
    } catch (error) {
      logger.error('claims.persistence_failed', {
        projectId: owned.project_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ id: messageId });
}
