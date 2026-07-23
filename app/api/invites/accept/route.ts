import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import { acceptInvite, WORKSPACE_COOKIE } from '@/lib/workspace';

/** Accept invite by token (email must match authenticated user). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces || !featureFlags.rbac) {
    return NextResponse.json({ error: 'RBAC disabled' }, { status: 404 });
  }
  try {
    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
    const workspaceId = await acceptInvite(token, user.id, user.email);
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
