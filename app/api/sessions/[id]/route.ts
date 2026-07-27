import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const title = body.title ? String(body.title) : undefined;
  const folderName = body.folderName !== undefined ? (body.folderName ? String(body.folderName).trim() : null) : undefined;

  await query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS folder_name text;`).catch(() => null);

  if (title !== undefined && folderName !== undefined) {
    await query(
      `UPDATE chat_sessions SET title = $1, folder_name = $2, updated_at = now()
       WHERE id = $3 AND user_id = $4`,
      [title, folderName, id, user.id],
    );
  } else if (title !== undefined) {
    await query(
      `UPDATE chat_sessions SET title = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [title, id, user.id],
    );
  } else if (folderName !== undefined) {
    await query(
      `UPDATE chat_sessions SET folder_name = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [folderName, id, user.id],
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await ctx.params;
  await query(`DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`, [id, user.id]);
  return NextResponse.json({ ok: true });
}
