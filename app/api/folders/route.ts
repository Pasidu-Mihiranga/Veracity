import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Ensure tables exist safely
  await query(`
    CREATE TABLE IF NOT EXISTS user_folders (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS user_folder_init (
      user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      initialized boolean NOT NULL DEFAULT true
    );
  `).catch(() => null);

  // Check if initial seeding has been executed for this user
  const initCheck = await query(`SELECT initialized FROM user_folder_init WHERE user_id = $1`, [user.id]).catch(() => ({ rows: [] }));
  
  if (!initCheck.rows || initCheck.rows.length === 0) {
    // Record initialized state for this user
    await query(`INSERT INTO user_folder_init (user_id, initialized) VALUES ($1, true) ON CONFLICT DO NOTHING`, [user.id]).catch(() => null);
    
    // Seed default baseline folders for new user
    const defaultFolders = ['Competitive Strategy', 'Pricing Review', 'GTM Outbound'];
    for (const name of defaultFolders) {
      await query(
        `INSERT INTO user_folders (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING`,
        [user.id, name],
      ).catch(() => null);
    }
  }

  const { rows } = await query(
    `SELECT id, name, created_at FROM user_folders WHERE user_id = $1 ORDER BY created_at ASC`,
    [user.id],
  );

  return NextResponse.json({ folders: rows.map((r) => r.name) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  }

  await query(`
    CREATE TABLE IF NOT EXISTS user_folders (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, name)
    );
  `).catch(() => null);

  const { rows } = await query(
    `INSERT INTO user_folders (user_id, name)
     VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO NOTHING
     RETURNING id, name, created_at`,
    [user.id, name],
  );

  return NextResponse.json({ folder: rows[0]?.name ?? name });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name')?.trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  await query(`DELETE FROM user_folders WHERE user_id = $1 AND name = $2`, [user.id, name]);
  await query(`UPDATE chat_sessions SET folder_name = NULL WHERE user_id = $1 AND folder_name = $2`, [user.id, name]);

  return NextResponse.json({ ok: true });
}
