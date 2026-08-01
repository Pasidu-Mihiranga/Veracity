import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { compareSourceCoverage, extractProjectSnapshot } from '@/lib/project-snapshot-data';

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
  }

  return NextResponse.json({ id: messageId });
}
