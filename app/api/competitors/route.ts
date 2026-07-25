import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import {
  listCompetitorProfiles,
  listDomainEventsAsOf,
  projectCompetitorProfile,
} from '@/lib/kg/profiles';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export async function GET(req: NextRequest) {
  if (!featureFlags.competitorProfiles) {
    return NextResponse.json({ competitors: [] });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) {
      return NextResponse.json({ competitors: [] });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');

    const key = req.nextUrl.searchParams.get('key');
    if (key) {
      const profile = await projectCompetitorProfile(tenant.workspaceId, key);
      const asOfRaw = req.nextUrl.searchParams.get('asOf');
      const events = await listDomainEventsAsOf(
        tenant.workspaceId,
        key,
        asOfRaw ? new Date(asOfRaw) : undefined,
      );
      return NextResponse.json({ profile, events });
    }

    const competitors = await listCompetitorProfiles(tenant.workspaceId);
    return NextResponse.json({ competitors });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
