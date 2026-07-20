import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

export const AUTH_COOKIE = 'veracity_session';

export type AuthUser = {
  id: string;
  email: string;
};

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL || 'dev-veracity-secret-change-me';
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const id = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (!id || !email) return null;
    return { id, email };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getUserFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  return verifySessionToken(token);
}
