import { featureFlags } from '@/lib/feature-flags';
import {
  ensurePersonalWorkspace,
  resolveTenantFromCookies,
  type WorkspaceRow,
} from '@/lib/workspace';
import type { WorkspaceRole } from '@/lib/rbac';

/** Resolve active workspace for KG features; ensure personal workspace when graph flags need tenancy. */
export async function resolveKgWorkspace(
  userId: string,
  email: string,
): Promise<{
  workspaceId: string;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
}> {
  const tenant = await resolveTenantFromCookies(userId, email);
  if (tenant.workspaceId && tenant.workspace) {
    return {
      workspaceId: tenant.workspaceId,
      workspace: tenant.workspace,
      role: tenant.role ?? 'owner',
    };
  }
  const needs =
    featureFlags.evidenceGraph ||
    featureFlags.competitorProfiles ||
    featureFlags.kgExplorer ||
    featureFlags.crossAgentMemory ||
    featureFlags.kgMaintenance;
  if (!needs) {
    throw new Error('Knowledge features disabled');
  }
  const ws = await ensurePersonalWorkspace(userId, email);
  return { workspaceId: ws.id, workspace: ws, role: 'owner' };
}
