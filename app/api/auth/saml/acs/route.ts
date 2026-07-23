import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setAuthCookie } from '@/lib/auth-session';
import {
  emailAllowedForDomains,
  ensureWorkspaceMembership,
  findOrCreateSsoUser,
  getSsoConfig,
  isSamlDemoMode,
  isSamlEnabled,
  parseSamlAssertion,
} from '@/lib/sso/saml';
import { WORKSPACE_COOKIE } from '@/lib/workspace';

export async function POST(req: NextRequest) {
  if (!isSamlEnabled()) {
    return NextResponse.json({ error: 'SAML disabled' }, { status: 404 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let raw = '';
  let workspaceId = '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    raw = String(form.get('SAMLResponse') ?? '');
    workspaceId = String(form.get('RelayState') ?? '');
  } else {
    const body = await req.json().catch(() => ({}));
    raw = typeof body.SAMLResponse === 'string' ? body.SAMLResponse : '';
    workspaceId = typeof body.RelayState === 'string' ? body.RelayState : '';
  }

  if (!raw || !workspaceId) {
    return NextResponse.json({ error: 'SAMLResponse and RelayState required' }, { status: 400 });
  }

  try {
    const config = await getSsoConfig(workspaceId);
    if (!config?.enabled && !isSamlDemoMode()) {
      return NextResponse.json({ error: 'SSO not enabled' }, { status: 400 });
    }

    const assertion = parseSamlAssertion({
      raw,
      demoMode: isSamlDemoMode(),
    });

    const domains = config?.allowed_email_domains ?? [];
    if (!emailAllowedForDomains(assertion.email, domains)) {
      return NextResponse.json({ error: 'Email domain not allowed' }, { status: 403 });
    }

    const user = await findOrCreateSsoUser(assertion.email);
    await ensureWorkspaceMembership(workspaceId, user.id, 'member');

    const token = await createSessionToken(user);
    const res = NextResponse.redirect(new URL('/', req.url));
    setAuthCookie(res, token);
    res.cookies.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ACS failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
