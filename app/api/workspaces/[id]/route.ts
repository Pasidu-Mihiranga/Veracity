import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import {
  WORKSPACE_COOKIE,
  listInvites,
  listMembers,
  requireWorkspaceAccess,
  updateWorkspace,
} from '@/lib/workspace';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces) {
    return NextResponse.json({ error: 'Workspaces disabled' }, { status: 404 });
  }

  const { id } = await ctx.params;
  try {
    const { membership } = await requireWorkspaceAccess(user.id, id, 'workspace.read');
    const members = featureFlags.rbac ? await listMembers(id) : [];
    const invites = featureFlags.rbac ? await listInvites(id) : [];
    return NextResponse.json({ membership, members, invites });
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
  if (!featureFlags.workspaces) {
    return NextResponse.json({ error: 'Workspaces disabled' }, { status: 404 });
  }

  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'workspace.write');
    const body = await req.json();
    const ws = await updateWorkspace(id, {
      name: body.name,
      logoUrl: body.logoUrl,
      timezone: body.timezone,
      industry: body.industry,
    });
    const res = NextResponse.json({ workspace: ws });
    if (body.activate === true) {
      res.cookies.set(WORKSPACE_COOKIE, id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  // Activate workspace (set cookie)
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces) {
    return NextResponse.json({ error: 'Workspaces disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'workspace.read');
    const res = NextResponse.json({ activeWorkspaceId: id });
    res.cookies.set(WORKSPACE_COOKIE, id, {
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
