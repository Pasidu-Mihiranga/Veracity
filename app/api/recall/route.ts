import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { embedText } from '@/lib/embeddings';
import { toPgVectorLiteral } from '@/lib/pgvector';

export const runtime = 'nodejs';

interface RecallBody {
  sessionId: string;
  query: string;
  matchCount?: number;
}

interface RecallHit {
  id: string;
  message_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  similarity: number;
  created_at: string;
}

export async function POST(req: NextRequest) {
  let body: RecallBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sessionId, query: q, matchCount = 5 } = body;
  if (!sessionId || !q?.trim()) {
    return NextResponse.json({ error: 'sessionId and query are required' }, { status: 400 });
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
    return NextResponse.json({ hits: [], context: '' });
  }

  const embedding = await embedText(q);
  if (!embedding) {
    return NextResponse.json({ hits: [], context: '' });
  }

  let vectorLiteral: string;
  try {
    vectorLiteral = toPgVectorLiteral(embedding);
  } catch {
    return NextResponse.json({ hits: [], context: '' });
  }

  const limit = Math.max(1, Math.min(50, Number(matchCount) || 5));

  const { rows } = await query<RecallHit>(
    `SELECT
       id,
       message_id,
       role,
       content,
       (1 - (embedding <=> $1::vector))::float8 AS similarity,
       created_at
     FROM chat_embeddings
     WHERE session_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorLiteral, sessionId, limit],
  );

  const hits = rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity) || 0,
  }));

  const context = hits.length
    ? `[Relevant context from earlier in this chat]\n${hits
        .map((h) => `- (${h.role}) ${h.content.slice(0, 300)}`)
        .join('\n')}`
    : '';

  return NextResponse.json({ hits, context });
}
