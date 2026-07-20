import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { embedText } from '@/lib/embeddings';

export const runtime = 'nodejs';

interface EmbedBody {
  sessionId: string;
  messageId?: string;
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  let body: EmbedBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionId, messageId, role, content } = body;
  if (!sessionId || !role || !content?.trim()) {
    return NextResponse.json({ error: 'sessionId, role, content are required' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { rows: sessions } = await query(
    `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [sessionId, user.id],
  );
  if (!sessions[0]) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const embedding = await embedText(content);
  if (!embedding) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    await query(
      `INSERT INTO chat_embeddings (session_id, message_id, role, content, embedding)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [sessionId, messageId ?? null, role, content.slice(0, 8000), JSON.stringify(embedding)],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'embed insert failed';
    console.error('[embed insert]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
