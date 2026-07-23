import { query } from '@/lib/db';
import { featureFlags } from '@/lib/feature-flags';

export type AuditLogRow = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function writeAuditLog(input: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!featureFlags.auditLogs) return;
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.userId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch {
    // never block product flows on audit failure
  }
}

export async function listAuditLogs(
  userId: string,
  limit = 10,
): Promise<AuditLogRow[]> {
  const { rows } = await query<AuditLogRow>(
    `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(Math.max(limit, 1), 50)],
  );
  return rows;
}
