import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { isWorkspaceRole, PermissionError, type WorkspaceRole } from '@/lib/rbac';
import {
  acceptInvite,
  createInvite,
  listInvites,
  requireWorkspaceAccess,
  revokeInvite,
  WORKSPACE_COOKIE,
} from '@/lib/workspace';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces || !featureFlags.rbac) {
    return NextResponse.json({ error: 'RBAC disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'member.invite');
    const invites = await listInvites(id);
    return NextResponse.json({ invites });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces || !featureFlags.rbac) {
    return NextResponse.json({ error: 'RBAC disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'member.invite');
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const role = (typeof body.role === 'string' ? body.role : 'member') as WorkspaceRole;
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    if (!isWorkspaceRole(role) || role === 'owner') {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }
    const invite = await createInvite({
      workspaceId: id,
      email,
      role,
      invitedBy: user.id,
    });
    return NextResponse.json({ invite });
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
  const body = await req.json();

  // Accept invite by token (any authenticated user matching email)
  if (body.action === 'accept' && typeof body.token === 'string') {
    try {
      const workspaceId = await acceptInvite(body.token, user.id, user.email);
      const res = NextResponse.json({ workspaceId });
      res.cookies.set(WORKSPACE_COOKIE, workspaceId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
      return res;
    } catch (err) {
      if (err instanceof PermissionError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  }

  // Revoke
  if (body.action === 'revoke' && typeof body.inviteId === 'string') {
    try {
      await requireWorkspaceAccess(user.id, id, 'member.invite');
      await revokeInvite(body.inviteId, id, user.id);
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof PermissionError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
