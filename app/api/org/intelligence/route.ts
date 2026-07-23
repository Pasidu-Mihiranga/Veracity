import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOrgIntelligence, orgIntelligenceEnabled } from '@/lib/org-intelligence';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!orgIntelligenceEnabled()) {
    return NextResponse.json({ error: 'Org intelligence disabled' }, { status: 404 });
  }

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId || !tenant.workspace) {
      return NextResponse.json({ error: 'No active workspace' }, { status: 400 });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'org.read');

    const data = await getOrgIntelligence(
      { userId: user.id, workspaceId: tenant.workspaceId },
      {
        id: tenant.workspace.id,
        name: tenant.workspace.name,
        industry: tenant.workspace.industry,
        timezone: tenant.workspace.timezone,
        logo_url: tenant.workspace.logo_url,
      },
    );
    return NextResponse.json({ intelligence: data });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
