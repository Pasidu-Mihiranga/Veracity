import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { getKgAnalytics } from '@/lib/kg/analytics';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export async function GET() {
  if (!featureFlags.kgAnalytics && !featureFlags.kgExplorer) {
    return NextResponse.json({ error: 'KG analytics disabled' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');
    const analytics = await getKgAnalytics(tenant.workspaceId);
    return NextResponse.json({ analytics });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
