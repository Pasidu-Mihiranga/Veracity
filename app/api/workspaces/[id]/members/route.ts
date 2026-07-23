import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { isWorkspaceRole, PermissionError, type WorkspaceRole } from '@/lib/rbac';
import { listMembers, requireWorkspaceAccess, updateMemberRole } from '@/lib/workspace';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces) {
    return NextResponse.json({ error: 'Workspaces disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'workspace.read');
    const members = await listMembers(id);
    return NextResponse.json({ members });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces || !featureFlags.rbac) {
    return NextResponse.json({ error: 'RBAC disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'member.role_change');
    const body = await req.json();
    const targetUserId = typeof body.userId === 'string' ? body.userId : '';
    const role = body.role as WorkspaceRole;
    if (!targetUserId || !isWorkspaceRole(role)) {
      return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
    }
    await updateMemberRole(id, targetUserId, role, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
