import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import { withTenantScope } from '@/lib/tenant';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';
import { apiError, apiSuccess, parseAndValidateJson } from '@/lib/api-response';

export const runtime = 'nodejs';

const sessionPostSchema = z.object({
  title: z.string().optional(),
  folderName: z.string().nullable().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const tenant = await resolveTenantFromCookies(user.id, user.email);
  const scope = withTenantScope(
    { userId: user.id, workspaceId: tenant.workspaceId },
    1,
  );

  await query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS folder_name text;`).catch(() => null);

  const { rows } = await query(
    `SELECT id, title, folder_name, created_at, updated_at
     FROM chat_sessions
     WHERE ${scope.sql}
     ORDER BY updated_at DESC
     LIMIT 500`,
    scope.params,
  );
  return apiSuccess({ sessions: rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const tenant = await resolveTenantFromCookies(user.id, user.email);

  if (featureFlags.workspaces && tenant.workspaceId) {
    try {
      await requireWorkspaceAccess(user.id, tenant.workspaceId, 'session.write');
    } catch (err) {
      if (err instanceof PermissionError) {
        return apiError(err.message, err.status, 'FORBIDDEN');
      }
      throw err;
    }
  }

  const parsed = await parseAndValidateJson(req, sessionPostSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
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
    return apiSuccess({ session: rows[0] }, 201);
  }

  const { rows } = await query(
    `INSERT INTO chat_sessions (user_id, title, folder_name, updated_at)
     VALUES ($1, $2, $3, now())
     RETURNING id, title, folder_name, created_at, updated_at`,
    [user.id, title, folderName],
  );
  return apiSuccess({ session: rows[0] }, 201);
}
