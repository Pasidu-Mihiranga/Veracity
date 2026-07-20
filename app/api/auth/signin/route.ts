import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSessionToken, setAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? '');
    const password = String(body.password ?? '');
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createSessionToken(user);
    const res = NextResponse.json({ user });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign in failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
