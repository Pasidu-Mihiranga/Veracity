import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { PermissionError } from '@/lib/rbac';
import { getSsoConfig, isSamlDemoMode, isSamlEnabled, upsertSsoConfig } from '@/lib/sso/saml';
import { requireWorkspaceAccess } from '@/lib/workspace';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces || !isSamlEnabled()) {
    return NextResponse.json({ error: 'SAML disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'sso.configure');
    const config = await getSsoConfig(id);
    return NextResponse.json({
      config,
      acsUrl: '/api/auth/saml/acs',
      demoMode: isSamlDemoMode(),
      loginUrl: `/api/auth/saml/login?workspace=${id}`,
    });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.workspaces || !isSamlEnabled()) {
    return NextResponse.json({ error: 'SAML disabled' }, { status: 404 });
  }
  const { id } = await ctx.params;
  try {
    await requireWorkspaceAccess(user.id, id, 'sso.configure');
    const body = await req.json();
    const config = await upsertSsoConfig({
      workspaceId: id,
      actorUserId: user.id,
      enabled: body.enabled,
      idpEntityId: body.idpEntityId,
      idpSsoUrl: body.idpSsoUrl,
      idpX509Cert: body.idpX509Cert,
      spEntityId: body.spEntityId,
      allowedEmailDomains: Array.isArray(body.allowedEmailDomains)
        ? body.allowedEmailDomains.map(String)
        : undefined,
    });
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
