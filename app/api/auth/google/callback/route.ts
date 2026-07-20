import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, findOrCreateGoogleUser, setAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  if (oauthError || !code) {
    return NextResponse.redirect(
      `${appUrl()}/auth?error=${encodeURIComponent(oauthError || 'Google sign-in was cancelled')}`,
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl()}/auth?error=${encodeURIComponent('Google OAuth env vars are missing')}`,
    );
  }

  const redirectUri = `${appUrl()}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('[google oauth token]', text);
      return NextResponse.redirect(
        `${appUrl()}/auth?error=${encodeURIComponent('Failed to exchange Google auth code')}`,
      );
    }

    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${appUrl()}/auth?error=${encodeURIComponent('No Google access token received')}`,
      );
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      return NextResponse.redirect(
        `${appUrl()}/auth?error=${encodeURIComponent('Failed to load Google profile')}`,
      );
    }

    const profile = (await profileRes.json()) as { id?: string; email?: string; verified_email?: boolean };
    if (!profile.email || !profile.id) {
      return NextResponse.redirect(
        `${appUrl()}/auth?error=${encodeURIComponent('Google account missing email')}`,
      );
    }

    const user = await findOrCreateGoogleUser(profile.email, profile.id);
    const sessionToken = await createSessionToken(user);
    const res = NextResponse.redirect(`${appUrl()}/`);
    setAuthCookie(res, sessionToken);
    return res;
  } catch (err) {
    console.error('[google oauth]', err);
    return NextResponse.redirect(
      `${appUrl()}/auth?error=${encodeURIComponent('Google sign-in failed')}`,
    );
  }
}
