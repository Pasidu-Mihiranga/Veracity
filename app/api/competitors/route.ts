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
import {
  getLatestProfileSnapshot,
  listLatestProfileSnapshots,
} from '@/lib/continuous-intelligence/profile-snapshots';

export async function GET(req: NextRequest) {
  if (!featureFlags.competitorProfiles && !featureFlags.continuousIntelligence) {
    return NextResponse.json({ competitors: [] });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const tenant = featureFlags.workspaces
      ? await resolveTenantFromCookies(user.id, user.email)
      : { workspaceId: null };
    if (tenant.workspaceId) {
      await requireWorkspaceAccess(user.id, tenant.workspaceId, 'org.read');
    }

    const key = req.nextUrl.searchParams.get('key');
    if (featureFlags.continuousIntelligence) {
      const scope = { userId: user.id, workspaceId: tenant.workspaceId };
      if (key) {
        const snapshot = await getLatestProfileSnapshot(scope, key);
        const profile = snapshot ? profileFromSnapshot(snapshot) : null;
        return NextResponse.json({ profile, events: eventsFromSnapshot(snapshot) });
      }
      const snapshots = await listLatestProfileSnapshots(scope);
      return NextResponse.json({ competitors: snapshots.map(profileFromSnapshot) });
    }
    if (!tenant.workspaceId) return NextResponse.json({ competitors: [] });
    await requireWorkspaceAccess(user.id, tenant.workspaceId, 'kg.read');

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

function profileFromSnapshot(snapshot: Awaited<ReturnType<typeof getLatestProfileSnapshot>>) {
  if (!snapshot) return null;
  const categoryCount = Object.keys(snapshot.profile.categories ?? {}).length;
  const summaries = Object.values(snapshot.profile.categories ?? {})
    .flat()
    .sort((left, right) => right.materialityScore - left.materialityScore)
    .slice(0, 3)
    .map((signal) => signal.summary);
  return {
    competitor_key: snapshot.entity_id,
    display_name: snapshot.display_name,
    summary: summaries.join(' · ') || 'Baseline profile captured; no material changes yet.',
    website_url: snapshot.official_domains[0]
      ? `https://${snapshot.official_domains[0]}`
      : null,
    trend_headline: snapshot.material_event_count > 0
      ? `${snapshot.material_event_count} material profile change(s)`
      : `${categoryCount} monitored signal categories`,
    first_seen_at: snapshot.created_at,
    last_seen_at: snapshot.observed_at,
    props: {
      changedFields: snapshot.diff.changedFields,
      profileSnapshotId: snapshot.id,
    },
  };
}

function eventsFromSnapshot(snapshot: Awaited<ReturnType<typeof getLatestProfileSnapshot>>) {
  if (!snapshot) return [];
  return snapshot.diff.materialEvents.map((event) => ({
    event_type: `profile.${event.category}`,
    payload: {
      title: event.title,
      summary: event.summary,
      category: event.category,
      materialityScore: event.materialityScore,
    },
    occurred_at: snapshot.observed_at,
  }));
}
