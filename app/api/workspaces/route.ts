import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import {
  WORKSPACE_COOKIE,
  createWorkspace,
  ensurePersonalWorkspace,
  listWorkspacesForUser,
  resolveActiveWorkspace,
} from '@/lib/workspace';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!featureFlags.workspaces) {
    return NextResponse.json({ workspaces: [], activeWorkspaceId: null, enabled: false });
  }

  let list = await listWorkspacesForUser(user.id);
  if (list.length === 0) {
    const personal = await ensurePersonalWorkspace(user.id, user.email);
    list = [personal];
  }
  const preferred = req.cookies.get(WORKSPACE_COOKIE)?.value ?? null;
  const active = await resolveActiveWorkspace(user.id, user.email, preferred);
  return NextResponse.json({
    workspaces: list,
    activeWorkspaceId: active.id,
    enabled: true,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces) {
    return NextResponse.json({ error: 'Workspaces disabled' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const ws = await createWorkspace({
      userId: user.id,
      name,
      logoUrl: body.logoUrl ?? null,
      timezone: body.timezone ?? null,
      industry: body.industry ?? null,
    });

    const res = NextResponse.json({ workspace: ws });
    res.cookies.set(WORKSPACE_COOKIE, ws.id, {
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
