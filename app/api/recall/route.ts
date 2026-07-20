import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { embedText } from '@/lib/embeddings';

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

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
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

  const { rows } = await query<{
    id: string;
    message_id: string | null;
    role: 'user' | 'assistant';
    content: string;
    embedding: number[];
    created_at: string;
  }>(
    `SELECT id, message_id, role, content, embedding, created_at
     FROM chat_embeddings
     WHERE session_id = $1`,
    [sessionId],
  );

  const hits: RecallHit[] = rows
    .map((row) => ({
      id: row.id,
      message_id: row.message_id,
      role: row.role,
      content: row.content,
      similarity: cosineSimilarity(embedding, Array.isArray(row.embedding) ? row.embedding : []),
      created_at: row.created_at,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  const context = hits.length
    ? `[Relevant context from earlier in this chat]\n${hits
        .map(h => `- (${h.role}) ${h.content.slice(0, 300)}`)
        .join('\n')}`
    : '';

  return NextResponse.json({ hits, context });
}
