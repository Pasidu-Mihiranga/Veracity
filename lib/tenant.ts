/**
 * Phase 6 tenant scoping — the only place that builds tenancy SQL predicates.
 * When ff_workspaces is on: isolate by workspace_id.
 * When off: fall back to user_id (legacy single-user demo).
 */

import { featureFlags } from '@/lib/feature-flags';

export type TenantContext = {
  userId: string;
  workspaceId: string | null;
};

export type ScopeClause = {
  /** SQL fragment without leading AND, e.g. `workspace_id = $2` */
  sql: string;
  /** Bind values for the fragment */
  params: unknown[];
  /** Next positional index after these params (1-based for callers that continue) */
  nextIndex: number;
};

/**
 * Build a tenancy predicate starting at param index `startIndex` (1-based).
 * Table alias optional, e.g. `s` → `s.workspace_id = $n`.
 */
export function withTenantScope(
  ctx: TenantContext,
  startIndex = 1,
  alias?: string,
): ScopeClause {
  const col = alias ? `${alias}.` : '';
  if (featureFlags.workspaces && ctx.workspaceId) {
    return {
      sql: `${col}workspace_id = $${startIndex}`,
      params: [ctx.workspaceId],
      nextIndex: startIndex + 1,
    };
  }
  return {
    sql: `${col}user_id = $${startIndex}`,
    params: [ctx.userId],
    nextIndex: startIndex + 1,
  };
}

/** Whether inserts should stamp workspace_id. */
export function shouldStampWorkspace(ctx: TenantContext): boolean {
  return featureFlags.workspaces && Boolean(ctx.workspaceId);
}

/** Pure predicate builder for tests (inject flag). */
export function buildScopeForTest(
  opts: { workspacesOn: boolean; userId: string; workspaceId: string | null; startIndex?: number; alias?: string },
): ScopeClause {
  const startIndex = opts.startIndex ?? 1;
  const col = opts.alias ? `${opts.alias}.` : '';
  if (opts.workspacesOn && opts.workspaceId) {
    return {
      sql: `${col}workspace_id = $${startIndex}`,
      params: [opts.workspaceId],
      nextIndex: startIndex + 1,
    };
  }
  return {
    sql: `${col}user_id = $${startIndex}`,
    params: [opts.userId],
    nextIndex: startIndex + 1,
  };
}
