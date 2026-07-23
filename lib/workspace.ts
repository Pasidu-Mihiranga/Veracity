import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { featureFlags } from '@/lib/feature-flags';
import {
  assertPermission,
  isWorkspaceRole,
  type Permission,
  type WorkspaceRole,
  PermissionError,
} from '@/lib/rbac';
import type { TenantContext } from '@/lib/tenant';

export const WORKSPACE_COOKIE = 'veracity_workspace';

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  logo_url: string | null;
  timezone: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
  role?: WorkspaceRole;
};

export type MemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  email?: string;
  created_at: string;
};

export type InviteRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'workspace'}-${randomBytes(3).toString('hex')}`;
}

export async function getMembership(
  userId: string,
  workspaceId: string,
): Promise<MemberRow | null> {
  const { rows } = await query<MemberRow>(
    `SELECT id, workspace_id, user_id, role, created_at
     FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2
     LIMIT 1`,
    [workspaceId, userId],
  );
  return rows[0] ?? null;
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceRow[]> {
  const { rows } = await query<WorkspaceRow>(
    `SELECT w.*, m.role
     FROM workspaces w
     INNER JOIN workspace_members m ON m.workspace_id = w.id
     WHERE m.user_id = $1
     ORDER BY w.created_at ASC`,
    [userId],
  );
  return rows;
}

export async function ensurePersonalWorkspace(userId: string, email: string): Promise<WorkspaceRow> {
  const existing = await listWorkspacesForUser(userId);
  if (existing[0]) return existing[0];

  const name = `${email} workspace`;
  const slug = slugify(email.split('@')[0] || 'user');
  const { rows } = await query<WorkspaceRow>(
    `INSERT INTO workspaces (name, slug, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, slug, userId],
  );
  const ws = rows[0];
  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING`,
    [ws.id, userId],
  );
  return { ...ws, role: 'owner' };
}

export async function createWorkspace(input: {
  userId: string;
  name: string;
  logoUrl?: string | null;
  timezone?: string | null;
  industry?: string | null;
}): Promise<WorkspaceRow> {
  const slug = slugify(input.name);
  const { rows } = await query<WorkspaceRow>(
    `INSERT INTO workspaces (name, slug, created_by, logo_url, timezone, industry)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.name.trim(),
      slug,
      input.userId,
      input.logoUrl ?? null,
      input.timezone ?? null,
      input.industry ?? null,
    ],
  );
  const ws = rows[0];
  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [ws.id, input.userId],
  );
  await writeAuditLog({
    userId: input.userId,
    workspaceId: ws.id,
    action: 'workspace.created',
    resourceType: 'workspace',
    resourceId: ws.id,
    metadata: { name: ws.name, workspaceId: ws.id },
  });
  return { ...ws, role: 'owner' };
}

export async function updateWorkspace(
  workspaceId: string,
  patch: {
    name?: string;
    logoUrl?: string | null;
    timezone?: string | null;
    industry?: string | null;
  },
): Promise<WorkspaceRow | null> {
  const { rows: current } = await query<WorkspaceRow>(
    `SELECT * FROM workspaces WHERE id = $1 LIMIT 1`,
    [workspaceId],
  );
  if (!current[0]) return null;
  const next = {
    name: patch.name?.trim() ?? current[0].name,
    logo_url: patch.logoUrl !== undefined ? patch.logoUrl : current[0].logo_url,
    timezone: patch.timezone !== undefined ? patch.timezone : current[0].timezone,
    industry: patch.industry !== undefined ? patch.industry : current[0].industry,
  };
  const { rows } = await query<WorkspaceRow>(
    `UPDATE workspaces SET
       name = $2,
       logo_url = $3,
       timezone = $4,
       industry = $5,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [workspaceId, next.name, next.logo_url, next.timezone, next.industry],
  );
  return rows[0] ?? null;
}

export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<{ membership: MemberRow; workspaceId: string }> {
  const membership = await getMembership(userId, workspaceId);
  if (!membership) throw new PermissionError('Not a workspace member');
  assertPermission(
    { role: membership.role, userId, workspaceId },
    permission,
  );
  return { membership, workspaceId };
}

export function readWorkspaceIdFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('x-workspace-id');
  if (header && /^[0-9a-f-]{36}$/i.test(header)) return header;
  const cookie = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (cookie && /^[0-9a-f-]{36}$/i.test(cookie)) return cookie;
  return null;
}

export async function resolveActiveWorkspace(
  userId: string,
  email: string,
  preferredId?: string | null,
): Promise<WorkspaceRow> {
  const list = await listWorkspacesForUser(userId);
  if (list.length === 0) {
    return ensurePersonalWorkspace(userId, email);
  }
  if (preferredId) {
    const match = list.find((w) => w.id === preferredId);
    if (match) return match;
  }
  return list[0];
}

export async function resolveTenantContext(opts: {
  userId: string;
  email: string;
  preferredWorkspaceId?: string | null;
}): Promise<TenantContext & { workspace: WorkspaceRow | null; role: WorkspaceRole | null }> {
  if (!featureFlags.workspaces) {
    return {
      userId: opts.userId,
      workspaceId: null,
      workspace: null,
      role: null,
    };
  }
  const workspace = await resolveActiveWorkspace(
    opts.userId,
    opts.email,
    opts.preferredWorkspaceId,
  );
  const membership = await getMembership(opts.userId, workspace.id);
  return {
    userId: opts.userId,
    workspaceId: workspace.id,
    workspace,
    role: membership?.role ?? 'owner',
  };
}

export async function listMembers(workspaceId: string): Promise<MemberRow[]> {
  const { rows } = await query<MemberRow>(
    `SELECT m.id, m.workspace_id, m.user_id, m.role, m.created_at, u.email
     FROM workspace_members m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.workspace_id = $1
     ORDER BY m.created_at ASC`,
    [workspaceId],
  );
  return rows;
}

export async function updateMemberRole(
  workspaceId: string,
  targetUserId: string,
  role: WorkspaceRole,
  actorUserId: string,
): Promise<void> {
  if (!isWorkspaceRole(role) || role === 'owner') {
    // promoting to owner is transfer — keep simple: only owner/admin/member/viewer via admin, not owner transfer here
  }
  if (role === 'owner') {
    throw new PermissionError('Use ownership transfer to assign owner');
  }

  const owners = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM workspace_members
     WHERE workspace_id = $1 AND role = 'owner'`,
    [workspaceId],
  );
  const target = await getMembership(targetUserId, workspaceId);
  if (target?.role === 'owner' && Number(owners.rows[0]?.count ?? 0) <= 1) {
    throw new PermissionError('Cannot demote the last owner');
  }

  await query(
    `UPDATE workspace_members SET role = $3
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, targetUserId, role],
  );
  await writeAuditLog({
    userId: actorUserId,
    action: 'workspace.member.role_changed',
    resourceType: 'workspace_member',
    resourceId: targetUserId,
    metadata: { workspaceId, role, targetUserId },
  });
}

export async function createInvite(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresInDays?: number;
}): Promise<InviteRow> {
  const role = input.role === 'owner' ? 'member' : input.role;
  const token = randomBytes(24).toString('hex');
  const days = input.expiresInDays ?? 7;
  const { rows } = await query<InviteRow>(
    `INSERT INTO workspace_invites
       (workspace_id, email, role, token, status, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, now() + ($6 || ' days')::interval)
     RETURNING *`,
    [input.workspaceId, input.email.toLowerCase().trim(), role, token, input.invitedBy, String(days)],
  );
  return rows[0];
}

export async function listInvites(workspaceId: string): Promise<InviteRow[]> {
  await query(
    `UPDATE workspace_invites SET status = 'expired'
     WHERE workspace_id = $1 AND status = 'pending' AND expires_at < now()`,
    [workspaceId],
  );
  const { rows } = await query<InviteRow>(
    `SELECT * FROM workspace_invites
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [workspaceId],
  );
  return rows;
}

export async function revokeInvite(
  inviteId: string,
  workspaceId: string,
  actorUserId: string,
): Promise<void> {
  await query(
    `UPDATE workspace_invites
     SET status = 'revoked', revoked_at = now()
     WHERE id = $1 AND workspace_id = $2 AND status = 'pending'`,
    [inviteId, workspaceId],
  );
  await writeAuditLog({
    userId: actorUserId,
    action: 'workspace.invite.revoked',
    resourceType: 'workspace_invite',
    resourceId: inviteId,
    metadata: { workspaceId },
  });
}

export async function acceptInvite(token: string, userId: string, email: string): Promise<string> {
  const { rows } = await query<InviteRow>(
    `SELECT * FROM workspace_invites WHERE token = $1 LIMIT 1`,
    [token],
  );
  const invite = rows[0];
  if (!invite) throw new PermissionError('Invite not found');
  if (invite.status === 'pending' && new Date(invite.expires_at) < new Date()) {
    await query(
      `UPDATE workspace_invites SET status = 'expired' WHERE id = $1`,
      [invite.id],
    );
    throw new PermissionError('Invite expired');
  }
  if (invite.status !== 'pending') {
    throw new PermissionError(`Invite is ${invite.status}`);
  }
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new PermissionError('Invite email mismatch');
  }

  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [invite.workspace_id, userId, invite.role],
  );
  await query(
    `UPDATE workspace_invites
     SET status = 'accepted', accepted_at = now()
     WHERE id = $1`,
    [invite.id],
  );
  await writeAuditLog({
    userId,
    action: 'workspace.invite.accepted',
    resourceType: 'workspace_invite',
    resourceId: invite.id,
    metadata: { workspaceId: invite.workspace_id },
  });
  return invite.workspace_id;
}

export async function resolveTenantFromCookies(
  userId: string,
  email: string,
): Promise<TenantContext & { workspace: WorkspaceRow | null; role: WorkspaceRole | null }> {
  const jar = await cookies();
  const preferred = jar.get(WORKSPACE_COOKIE)?.value ?? null;
  return resolveTenantContext({ userId, email, preferredWorkspaceId: preferred });
}
