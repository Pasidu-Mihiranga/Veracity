import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import {
  getLatestContinuousBoardPack,
  refreshContinuousBoardPack,
} from '@/lib/continuous-intelligence/board-refresh';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

async function resolveScope(user: { id: string; email?: string | null }, write: boolean) {
  if (!featureFlags.workspaces) {
    return { userId: user.id, workspaceId: null };
  }
  const tenant = await resolveTenantFromCookies(user.id, user.email ?? '');
  if (!tenant.workspaceId) return { userId: user.id, workspaceId: null };
  await requireWorkspaceAccess(
    user.id,
    tenant.workspaceId,
    write ? 'sweep.run' : 'org.read',
  );
  return { userId: user.id, workspaceId: tenant.workspaceId };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.continuousIntelligence) {
    return NextResponse.json({ error: 'Continuous intelligence disabled' }, { status: 404 });
  }
  try {
    const scope = await resolveScope(user, false);
    const snapshot = await getLatestContinuousBoardPack(scope);
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.continuousIntelligence) {
    return NextResponse.json({ error: 'Continuous intelligence disabled' }, { status: 404 });
  }
  try {
    const scope = await resolveScope(user, true);
    const snapshot = await refreshContinuousBoardPack({
      ...scope,
      periodDays: 30,
      refreshReason: 'manual',
    });
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

