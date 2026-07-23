'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';

type Member = {
  id: string;
  user_id: string;
  role: string;
  email?: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
};

type SsoConfig = {
  enabled: boolean;
  idp_entity_id: string | null;
  idp_sso_url: string | null;
  idp_x509_cert: string | null;
  allowed_email_domains: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string | null;
};

export function WorkspaceMembersDrawer({ open, onClose, workspaceId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [sso, setSso] = useState<SsoConfig | null>(null);
  const [ssoForm, setSsoForm] = useState({
    enabled: false,
    idpEntityId: '',
    idpSsoUrl: '',
    idpX509Cert: '',
    domains: '',
  });
  const [acceptToken, setAcceptToken] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId || !featureFlags.workspaces) return;
    const res = await fetch(`/api/workspaces/${workspaceId}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members ?? []);
    setInvites(data.invites ?? []);

    if (featureFlags.samlSso) {
      const ssoRes = await fetch(`/api/workspaces/${workspaceId}/sso`, { credentials: 'include' });
      if (ssoRes.ok) {
        const ssoData = await ssoRes.json();
        const c = ssoData.config as SsoConfig | null;
        setSso(c);
        if (c) {
          setSsoForm({
            enabled: c.enabled,
            idpEntityId: c.idp_entity_id ?? '',
            idpSsoUrl: c.idp_sso_url ?? '',
            idpX509Cert: c.idp_x509_cert ?? '',
            domains: (c.allowed_email_domains ?? []).join(', '),
          });
        }
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const invite = async () => {
    if (!workspaceId || !email.trim()) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? 'Invite failed');
      return;
    }
    setMsg(`Invite token: ${data.invite?.token ?? ''}`);
    setEmail('');
    void load();
  };

  const revoke = async (inviteId: string) => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/invites`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', inviteId }),
    });
    void load();
  };

  const changeRole = async (userId: string, nextRole: string) => {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: nextRole }),
    });
    void load();
  };

  const accept = async () => {
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: acceptToken.trim() }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Joined workspace ${data.workspaceId}` : data.error);
    if (res.ok) window.location.reload();
  };

  const saveSso = async () => {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/sso`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: ssoForm.enabled,
        idpEntityId: ssoForm.idpEntityId,
        idpSsoUrl: ssoForm.idpSsoUrl,
        idpX509Cert: ssoForm.idpX509Cert,
        allowedEmailDomains: ssoForm.domains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      }),
    });
    setMsg(res.ok ? 'SSO config saved' : 'SSO save failed');
    void load();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <div className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-serif">Workspace members</div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {msg && (
          <div className="text-[11px] font-mono bg-muted border border-border rounded-lg p-2 break-all">
            {msg}
          </div>
        )}

        {featureFlags.rbac && (
          <>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Members
              </div>
              <div className="flex flex-col gap-1">
                {members.map((m) => (
                  <div key={m.id} className="veracity-card p-2 flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{m.email ?? m.user_id}</span>
                    <select
                      className="font-mono text-[10px] border border-border rounded px-1 py-0.5 bg-background"
                      value={m.role}
                      onChange={(e) => void changeRole(m.user_id, e.target.value)}
                      disabled={m.role === 'owner'}
                    >
                      <option value="viewer">viewer</option>
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Invite
              </div>
              <div className="flex gap-1 mb-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-background"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="font-mono text-[10px] border border-border rounded-lg px-1 bg-background"
                >
                  <option value="viewer">viewer</option>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="button"
                  onClick={() => void invite()}
                  className="bg-gradient-signature text-white text-xs rounded-lg px-3"
                >
                  Invite
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {invites.map((inv) => (
                  <div key={inv.id} className="veracity-card p-2 text-[11px] flex flex-col gap-1">
                    <div className="flex justify-between gap-2">
                      <span>{inv.email}</span>
                      <span className="font-mono uppercase text-muted-foreground">{inv.status}</span>
                    </div>
                    {inv.status === 'pending' && (
                      <button
                        type="button"
                        className="text-red-600 text-left font-mono text-[10px]"
                        onClick={() => void revoke(inv.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Accept invite token
              </div>
              <div className="flex gap-1">
                <input
                  value={acceptToken}
                  onChange={(e) => setAcceptToken(e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-background"
                  placeholder="paste token"
                />
                <button
                  type="button"
                  onClick={() => void accept()}
                  className="text-xs border border-accent/20 bg-accent/5 text-accent rounded-lg px-3"
                >
                  Accept
                </button>
              </div>
            </div>
          </>
        )}

        {featureFlags.samlSso && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              SAML SSO
            </div>
            <div className="veracity-card p-3 flex flex-col gap-2 text-xs">
              <label className="flex items-center gap-2 font-mono text-[10px]">
                <input
                  type="checkbox"
                  checked={ssoForm.enabled}
                  onChange={(e) => setSsoForm((s) => ({ ...s, enabled: e.target.checked }))}
                />
                Enabled
              </label>
              <input
                value={ssoForm.idpEntityId}
                onChange={(e) => setSsoForm((s) => ({ ...s, idpEntityId: e.target.value }))}
                placeholder="IdP Entity ID"
                className="px-2 py-1.5 rounded-lg border border-border bg-background"
              />
              <input
                value={ssoForm.idpSsoUrl}
                onChange={(e) => setSsoForm((s) => ({ ...s, idpSsoUrl: e.target.value }))}
                placeholder="IdP SSO URL"
                className="px-2 py-1.5 rounded-lg border border-border bg-background"
              />
              <textarea
                value={ssoForm.idpX509Cert}
                onChange={(e) => setSsoForm((s) => ({ ...s, idpX509Cert: e.target.value }))}
                placeholder="IdP X509 cert"
                rows={3}
                className="px-2 py-1.5 rounded-lg border border-border bg-background font-mono text-[10px]"
              />
              <input
                value={ssoForm.domains}
                onChange={(e) => setSsoForm((s) => ({ ...s, domains: e.target.value }))}
                placeholder="Allowed domains (comma-separated)"
                className="px-2 py-1.5 rounded-lg border border-border bg-background"
              />
              <div className="font-mono text-[10px] text-muted-foreground">
                ACS: /api/auth/saml/acs
                {workspaceId && (
                  <>
                    {' · '}
                    <a
                      className="text-accent"
                      href={`/api/auth/saml/login?workspace=${workspaceId}`}
                    >
                      Demo login
                    </a>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => void saveSso()}
                className="bg-gradient-signature text-white rounded-lg py-2"
              >
                Save SSO
              </button>
              {sso && (
                <div className="font-mono text-[10px] text-muted-foreground">
                  Current: {sso.enabled ? 'enabled' : 'disabled'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
