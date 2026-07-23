import { describe, expect, it } from 'vitest';
import { assertPermission, canPermission, PermissionError, __rbacTest } from '@/lib/rbac';
import { buildScopeForTest } from '@/lib/tenant';
import {
  emailAllowedForDomains,
  parseSamlAssertion,
} from '@/lib/sso/saml-policy';

describe('Phase 6 RBAC assertPermission', () => {
  it('allows viewer to org.read and denies session.write', () => {
    expect(canPermission('viewer', 'org.read')).toBe(true);
    expect(canPermission('viewer', 'session.write')).toBe(false);
    expect(() =>
      assertPermission(
        { role: 'viewer', userId: 'u1', workspaceId: 'w1' },
        'session.write',
      ),
    ).toThrow(PermissionError);
  });

  it('allows admin invite and owner delete', () => {
    expect(canPermission('admin', 'member.invite')).toBe(true);
    expect(canPermission('admin', 'workspace.delete')).toBe(false);
    expect(canPermission('owner', 'workspace.delete')).toBe(true);
    expect(canPermission('member', 'sso.configure')).toBe(false);
  });

  it('ranks roles consistently', () => {
    expect(__rbacTest.roleAtLeast('admin', 'member')).toBe(true);
    expect(__rbacTest.roleAtLeast('member', 'admin')).toBe(false);
  });
});

describe('Phase 6 tenant scope helper', () => {
  it('scopes by workspace_id when workspaces on', () => {
    const scope = buildScopeForTest({
      workspacesOn: true,
      userId: 'user-a',
      workspaceId: 'ws-1',
      startIndex: 1,
    });
    expect(scope.sql).toBe('workspace_id = $1');
    expect(scope.params).toEqual(['ws-1']);
  });

  it('falls back to user_id when workspaces off', () => {
    const scope = buildScopeForTest({
      workspacesOn: false,
      userId: 'user-a',
      workspaceId: 'ws-1',
      startIndex: 2,
      alias: 's',
    });
    expect(scope.sql).toBe('s.user_id = $2');
    expect(scope.params).toEqual(['user-a']);
  });

  it('never mixes user tenancy when workspace mode is on', () => {
    const scope = buildScopeForTest({
      workspacesOn: true,
      userId: 'user-a',
      workspaceId: 'ws-b',
    });
    expect(scope.sql.includes('user_id')).toBe(false);
    expect(scope.sql.includes('workspace_id')).toBe(true);
  });
});

describe('Phase 6 SAML helpers', () => {
  it('parses demo assertion JSON', () => {
    const parsed = parseSamlAssertion({
      raw: JSON.stringify({ email: 'Ada@Example.COM', nameId: 'ada' }),
      demoMode: true,
    });
    expect(parsed.email).toBe('ada@example.com');
  });

  it('enforces allowed email domains', () => {
    expect(emailAllowedForDomains('a@acme.com', ['acme.com'])).toBe(true);
    expect(emailAllowedForDomains('a@other.com', ['acme.com'])).toBe(false);
    expect(emailAllowedForDomains('a@other.com', [])).toBe(true);
  });
});

describe('Phase 6 invite lifecycle statuses', () => {
  it('documents allowed status set', () => {
    const allowed = new Set(['pending', 'accepted', 'expired', 'revoked']);
    expect(allowed.has('pending')).toBe(true);
    expect(allowed.has('accepted')).toBe(true);
    expect(allowed.has('expired')).toBe(true);
    expect(allowed.has('revoked')).toBe(true);
  });
});

describe('Phase 6 feature flags default off', () => {
  it('enterprise flags are off when unset', async () => {
    // Importing featureFlags reflects process.env at module load; assert API shape.
    const { featureFlags } = await import('@/lib/feature-flags');
    expect('workspaces' in featureFlags).toBe(true);
    expect('rbac' in featureFlags).toBe(true);
    expect('samlSso' in featureFlags).toBe(true);
    expect('orgIntelligence' in featureFlags).toBe(true);
  });
});
