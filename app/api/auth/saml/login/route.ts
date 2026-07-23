import { NextRequest, NextResponse } from 'next/server';
import {
  getSsoConfig,
  isSamlDemoMode,
  isSamlEnabled,
} from '@/lib/sso/saml';

/** Initiate SAML login — redirects to IdP or returns demo form when SAML_DEMO_MODE=1. */
export async function GET(req: NextRequest) {
  if (!isSamlEnabled()) {
    return NextResponse.json({ error: 'SAML disabled' }, { status: 404 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspace');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace required' }, { status: 400 });
  }

  const config = await getSsoConfig(workspaceId);
  if (!config?.enabled && !isSamlDemoMode()) {
    return NextResponse.json({ error: 'SSO not enabled for workspace' }, { status: 400 });
  }

  if (isSamlDemoMode()) {
    const html = `<!DOCTYPE html>
<html><head><title>Veracity Demo IdP</title></head>
<body style="font-family:system-ui;padding:2rem">
  <h1>Demo SAML IdP</h1>
  <p>Workspace: ${workspaceId}</p>
  <form method="POST" action="/api/auth/saml/acs">
    <input type="hidden" name="RelayState" value="${workspaceId}" />
    <label>Email <input name="SAMLResponse" value='{"email":"demo.sso@example.com","nameId":"demo.sso@example.com"}' style="width:28rem" /></label>
    <button type="submit">Sign in (demo ACS)</button>
  </form>
</body></html>`;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!config?.idp_sso_url) {
    return NextResponse.json({ error: 'IdP SSO URL not configured' }, { status: 400 });
  }

  const url = new URL(config.idp_sso_url);
  url.searchParams.set('SAMLRequest', 'placeholder');
  url.searchParams.set('RelayState', workspaceId);
  return NextResponse.redirect(url.toString());
}
