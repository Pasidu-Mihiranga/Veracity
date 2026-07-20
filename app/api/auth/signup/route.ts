import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, createUser, setAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? '');
    const password = String(body.password ?? '');
    if (!email || password.length < 6) {
      return NextResponse.json({ error: 'Valid email and password (6+ chars) required' }, { status: 400 });
    }

    const user = await createUser(email, password);
    const token = await createSessionToken(user);
    const res = NextResponse.json({ user });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign up failed';
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
