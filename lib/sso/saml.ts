import { createHash } from 'crypto';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { featureFlags } from '@/lib/feature-flags';
import {
  emailAllowedForDomains,
  parseSamlAssertion,
} from '@/lib/sso/saml-policy';

export type SsoConfigRow = {
  id: string;
  workspace_id: string;
  enabled: boolean;
  idp_entity_id: string | null;
  idp_sso_url: string | null;
  idp_x509_cert: string | null;
  sp_entity_id: string | null;
  acs_path: string;
  allowed_email_domains: string[];
  metadata: Record<string, unknown>;
  updated_at: string;
  created_at: string;
};

export { emailAllowedForDomains, parseSamlAssertion };

export async function getSsoConfig(workspaceId: string): Promise<SsoConfigRow | null> {
  const { rows } = await query<SsoConfigRow>(
    `SELECT * FROM workspace_sso_configs WHERE workspace_id = $1 LIMIT 1`,
    [workspaceId],
  );
  return rows[0] ?? null;
}

export async function upsertSsoConfig(input: {
  workspaceId: string;
  actorUserId: string;
  enabled?: boolean;
  idpEntityId?: string | null;
  idpSsoUrl?: string | null;
  idpX509Cert?: string | null;
  spEntityId?: string | null;
  allowedEmailDomains?: string[];
}): Promise<SsoConfigRow> {
  const existing = await getSsoConfig(input.workspaceId);
  const spEntityId =
    input.spEntityId ??
    existing?.sp_entity_id ??
    `veracity-sp-${input.workspaceId.slice(0, 8)}`;

  const { rows } = await query<SsoConfigRow>(
    `INSERT INTO workspace_sso_configs (
       workspace_id, enabled, idp_entity_id, idp_sso_url, idp_x509_cert,
       sp_entity_id, allowed_email_domains, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       enabled = COALESCE($2, workspace_sso_configs.enabled),
       idp_entity_id = COALESCE($3, workspace_sso_configs.idp_entity_id),
       idp_sso_url = COALESCE($4, workspace_sso_configs.idp_sso_url),
       idp_x509_cert = COALESCE($5, workspace_sso_configs.idp_x509_cert),
       sp_entity_id = COALESCE($6, workspace_sso_configs.sp_entity_id),
       allowed_email_domains = COALESCE($7, workspace_sso_configs.allowed_email_domains),
       updated_at = now()
     RETURNING *`,
    [
      input.workspaceId,
      input.enabled ?? existing?.enabled ?? false,
      input.idpEntityId ?? existing?.idp_entity_id ?? null,
      input.idpSsoUrl ?? existing?.idp_sso_url ?? null,
      input.idpX509Cert ?? existing?.idp_x509_cert ?? null,
      spEntityId,
      input.allowedEmailDomains ?? existing?.allowed_email_domains ?? [],
    ],
  );

  await writeAuditLog({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    action: 'workspace.sso.config_updated',
    resourceType: 'workspace_sso',
    resourceId: input.workspaceId,
    metadata: { enabled: rows[0]?.enabled },
  });

  return rows[0];
}

export async function findOrCreateSsoUser(email: string): Promise<{ id: string; email: string }> {
  const normalized = email.toLowerCase().trim();
  const existing = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  if (existing.rows[0]) return existing.rows[0];

  const googleStub = `saml:${createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`;
  const inserted = await query<{ id: string; email: string }>(
    `INSERT INTO users (email, google_id)
     VALUES ($1, $2)
     RETURNING id, email`,
    [normalized, googleStub],
  );
  return inserted.rows[0];
}

export async function ensureWorkspaceMembership(
  workspaceId: string,
  userId: string,
  role: 'member' | 'viewer' = 'member',
): Promise<void> {
  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [workspaceId, userId, role],
  );
}

export function isSamlEnabled(): boolean {
  return featureFlags.samlSso;
}

export function isSamlDemoMode(): boolean {
  const raw = process.env.SAML_DEMO_MODE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}
