import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { rows } = await query(
    `SELECT id, title, created_at, updated_at
     FROM chat_sessions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 40`,
    [user.id],
  );
  return NextResponse.json({ sessions: rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? 'New Query');

  const { rows } = await query(
    `INSERT INTO chat_sessions (user_id, title, updated_at)
     VALUES ($1, $2, now())
     RETURNING id, title, created_at, updated_at`,
    [user.id, title],
  );
  return NextResponse.json({ session: rows[0] });
}
