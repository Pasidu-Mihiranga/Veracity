import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import { withTenantScope } from '@/lib/tenant';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenant = await resolveTenantFromCookies(user.id, user.email);
  const scope = withTenantScope(
    { userId: user.id, workspaceId: tenant.workspaceId },
    1,
  );

  // Ensure column exists safely
  await query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS folder_name text;`).catch(() => null);

  const { rows } = await query(
    `SELECT id, title, folder_name, created_at, updated_at
     FROM chat_sessions
     WHERE ${scope.sql}
     ORDER BY updated_at DESC
     LIMIT 500`,
    scope.params,
  );
  return NextResponse.json({ sessions: rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const tenant = await resolveTenantFromCookies(user.id, user.email);

  if (featureFlags.workspaces && tenant.workspaceId) {
    try {
      await requireWorkspaceAccess(user.id, tenant.workspaceId, 'session.write');
    } catch (err) {
      if (err instanceof PermissionError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? 'New Query');
  const folderName = body.folderName ? String(body.folderName).trim() : null;

  await query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS folder_name text;`).catch(() => null);

  if (featureFlags.workspaces && tenant.workspaceId) {
    const { rows } = await query(
      `INSERT INTO chat_sessions (user_id, workspace_id, title, folder_name, updated_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, title, folder_name, created_at, updated_at`,
      [user.id, tenant.workspaceId, title, folderName],
    );
    return NextResponse.json({ session: rows[0] });
  }

  const { rows } = await query(
    `INSERT INTO chat_sessions (user_id, title, folder_name, updated_at)
     VALUES ($1, $2, $3, now())
     RETURNING id, title, folder_name, created_at, updated_at`,
    [user.id, title, folderName],
  );
  return NextResponse.json({ session: rows[0] });
}
