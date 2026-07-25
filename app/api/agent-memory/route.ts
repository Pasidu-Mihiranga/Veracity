import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import { listAgentMemory, putAgentMemory } from '@/lib/kg/agent-memory';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

export async function GET(req: NextRequest) {
  if (!featureFlags.crossAgentMemory) {
    return NextResponse.json({ entries: [] });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) return NextResponse.json({ entries: [] });
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');
    const entries = await listAgentMemory({
      workspaceId: tenant.workspaceId,
      scope: (req.nextUrl.searchParams.get('scope') as never) || undefined,
      sessionId: req.nextUrl.searchParams.get('sessionId'),
    });
    return NextResponse.json({ entries });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  if (!featureFlags.crossAgentMemory) {
    return NextResponse.json({ error: 'Cross-agent memory disabled' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const tenant = await resolveTenantFromCookies(user.id, user.email);
    if (!tenant.workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 });
    }
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.write');
    const body = await req.json();
    const entry = await putAgentMemory({
      workspaceId: tenant.workspaceId,
      scope: body.scope ?? 'global',
      key: String(body.key ?? ''),
      value: body.value ?? {},
      confidence: typeof body.confidence === 'number' ? body.confidence : 0.55,
      sessionId: body.sessionId ?? null,
      provenance: {
        createdBy: user.id,
        sourceAgent: body.sourceAgent ?? 'api',
      },
    });
    return NextResponse.json({ entry });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
