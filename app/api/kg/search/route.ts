import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { hybridKgSearch } from '@/lib/kg/search';
import type { KgNodeKind } from '@/lib/kg/types';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export async function GET(req: NextRequest) {
  if (!featureFlags.evidenceGraph && !featureFlags.kgExplorer) {
    return NextResponse.json({ error: 'KG search disabled' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) {
      return NextResponse.json({ hits: [] });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');
    const hits = await hybridKgSearch({
      workspaceId: tenant.workspaceId,
      q,
      kind: (req.nextUrl.searchParams.get('kind') as KgNodeKind) || undefined,
      limit: Number(req.nextUrl.searchParams.get('limit') ?? 20),
    });
    return NextResponse.json({ hits });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
