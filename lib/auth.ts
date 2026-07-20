import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  AUTH_COOKIE,
  clearAuthCookie,
  createSessionToken,
  getUserFromToken,
  setAuthCookie,
  type AuthUser,
} from '@/lib/auth-session';

export {
  AUTH_COOKIE,
  clearAuthCookie,
  createSessionToken,
  setAuthCookie,
};
export type { AuthUser };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return getUserFromToken(cookieStore.get(AUTH_COOKIE)?.value);
}

export async function getUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  return getUserFromToken(req.cookies.get(AUTH_COOKIE)?.value);
}

export async function createUser(email: string, password: string): Promise<AuthUser> {
  const passwordHash = await hashPassword(password);
  const { rows } = await query<{ id: string; email: string }>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email`,
    [email.toLowerCase().trim(), passwordHash],
  );
  return rows[0];
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const { rows } = await query<{ id: string; email: string; password_hash: string | null }>(
    `SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase().trim()],
  );
  const row = rows[0];
  if (!row?.password_hash) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, email: row.email };
}

/** Find or create a user signed in via Google OAuth. */
export async function findOrCreateGoogleUser(email: string, googleId: string): Promise<AuthUser> {
  const normalized = email.toLowerCase().trim();

  const byGoogle = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE google_id = $1 LIMIT 1`,
    [googleId],
  );
  if (byGoogle.rows[0]) return byGoogle.rows[0];

  const byEmail = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  if (byEmail.rows[0]) {
    await query(`UPDATE users SET google_id = $1 WHERE id = $2`, [googleId, byEmail.rows[0].id]);
    return byEmail.rows[0];
  }

  const inserted = await query<{ id: string; email: string }>(
    `INSERT INTO users (email, google_id, password_hash)
     VALUES ($1, $2, NULL)
     RETURNING id, email`,
    [normalized, googleId],
  );
  return inserted.rows[0];
}
