/** Phase 6 RBAC — permission checks centralized here only. */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type Permission =
  | 'workspace.read'
  | 'workspace.write'
  | 'workspace.delete'
  | 'session.write'
  | 'sweep.run'
  | 'watchlist.manage'
  | 'alert.write'
  | 'decision.write'
  | 'member.invite'
  | 'member.role_change'
  | 'sso.configure'
  | 'org.read'
  | 'kg.read'
  | 'kg.write'
  | 'kg.maintain';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

const PERMISSION_MIN_ROLE: Record<Permission, WorkspaceRole> = {
  'workspace.read': 'viewer',
  'org.read': 'viewer',
  'kg.read': 'viewer',
  'session.write': 'member',
  'sweep.run': 'member',
  'watchlist.manage': 'member',
  'alert.write': 'member',
  'decision.write': 'member',
  'kg.write': 'member',
  'workspace.write': 'admin',
  'member.invite': 'admin',
  'member.role_change': 'admin',
  'sso.configure': 'admin',
  'kg.maintain': 'admin',
  'workspace.delete': 'owner',
};

function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export class PermissionError extends Error {
  status = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'PermissionError';
  }
}

export type PermissionContext = {
  role: WorkspaceRole;
  userId: string;
  workspaceId: string;
};

/** Sole public gate for route handlers — do not compare roles inline elsewhere. */
export function assertPermission(ctx: PermissionContext, permission: Permission): void {
  const min = PERMISSION_MIN_ROLE[permission];
  if (!roleAtLeast(ctx.role, min)) {
    throw new PermissionError(`Missing permission: ${permission}`);
  }
}

export function canPermission(role: WorkspaceRole, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSION_MIN_ROLE[permission]);
}

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return value in ROLE_RANK;
}

/** Pure helpers exported for unit tests only — prefer assertPermission in app code. */
export const __rbacTest = { roleAtLeast, PERMISSION_MIN_ROLE, ROLE_RANK };
