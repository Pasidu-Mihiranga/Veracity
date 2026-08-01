import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import {
  listCanonicalEntities,
  upsertCanonicalEntity,
  type CanonicalEntityType,
} from '@/lib/continuous-intelligence/entities';
import { PermissionError } from '@/lib/rbac';
import {
  requireWorkspaceAccess,
  resolveTenantFromCookies,
} from '@/lib/workspace';

async function scopeFor(user: { id: string; email?: string | null }, write: boolean) {
  if (!featureFlags.workspaces) return { userId: user.id, workspaceId: null };
  const tenant = await resolveTenantFromCookies(user.id, user.email ?? '');
  if (!tenant.workspaceId) return { userId: user.id, workspaceId: null };
  await requireWorkspaceAccess(user.id, tenant.workspaceId, write ? 'kg.write' : 'kg.read');
  return { userId: user.id, workspaceId: tenant.workspaceId };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.continuousIntelligence) {
    return NextResponse.json({ error: 'Continuous intelligence disabled' }, { status: 404 });
  }
  try {
    const scope = await scopeFor(user, false);
    const rawType = req.nextUrl.searchParams.get('type');
    const type = isEntityType(rawType) ? rawType : undefined;
    const entities = await listCanonicalEntities(scope, type);
    return NextResponse.json({ entities });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!featureFlags.continuousIntelligence) {
    return NextResponse.json({ error: 'Continuous intelligence disabled' }, { status: 404 });
  }
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !isEntityType(body.type) ||
      typeof body.displayName !== 'string' || !body.displayName.trim()) {
    return NextResponse.json(
      { error: 'type and displayName are required' },
      { status: 400 },
    );
  }
  try {
    const scope = await scopeFor(user, true);
    const entity = await upsertCanonicalEntity({
      ...scope,
      type: body.type,
      displayName: body.displayName,
      aliases: stringArray(body.aliases),
      officialDomains: stringArray(body.officialDomains),
      productLines: stringArray(body.productLines),
      props: body.props && typeof body.props === 'object'
        ? body.props as Record<string, unknown>
        : {},
      confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
    });
    return NextResponse.json({ entity }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

function isEntityType(value: unknown): value is CanonicalEntityType {
  return value === 'company' || value === 'competitor' || value === 'product';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

