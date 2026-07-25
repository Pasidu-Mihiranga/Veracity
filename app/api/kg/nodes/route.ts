import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { getNeighborhood, listNodes, listNodeVersions } from '@/lib/kg/store';
import type { KgNodeKind } from '@/lib/kg/types';
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

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) {
      return NextResponse.json({ nodes: [], enabled: false });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');

    const sp = req.nextUrl.searchParams;
    const nodeId = sp.get('nodeId');
    if (nodeId) {
      const versions = await listNodeVersions(tenant.workspaceId, nodeId);
      const neighborhood = await getNeighborhood(
        tenant.workspaceId,
        nodeId,
        Number(sp.get('depth') ?? 1),
      );
      return NextResponse.json({ versions, ...neighborhood });
    }

    const asOfRaw = sp.get('asOf');
    const nodes = await listNodes({
      workspaceId: tenant.workspaceId,
      kind: (sp.get('kind') as KgNodeKind) || undefined,
      q: sp.get('q') ?? undefined,
      asOf: asOfRaw ? new Date(asOfRaw) : undefined,
      limit: Number(sp.get('limit') ?? 50),
    });
    return NextResponse.json({ nodes });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
