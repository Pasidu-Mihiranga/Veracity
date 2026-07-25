import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { getNeighborhood } from '@/lib/kg/store';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export async function GET(req: NextRequest) {
  if (!featureFlags.evidenceGraph) {
    return NextResponse.json({ error: 'Evidence graph disabled' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const nodeId = req.nextUrl.searchParams.get('nodeId');
  if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 });

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');
    const depth = Number(req.nextUrl.searchParams.get('depth') ?? 1);
    const data = await getNeighborhood(tenant.workspaceId, nodeId, depth);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
