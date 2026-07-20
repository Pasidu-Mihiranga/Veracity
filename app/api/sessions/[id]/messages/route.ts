import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function assertSessionOwner(sessionId: string, userId: string) {
  const { rows } = await query(
    `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
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

  return NextResponse.json({ id: rows[0]?.id ?? null });
}
