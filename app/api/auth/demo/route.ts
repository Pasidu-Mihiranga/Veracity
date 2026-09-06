import { NextResponse } from 'next/server';
import { authenticateUser, createUser, createSessionToken, setAuthCookie, hashPassword } from '@/lib/auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const demoEmail = 'demo@veracity.ai';
    const demoPassword = 'DemoVeracity2026!';

    let user = await authenticateUser(demoEmail, demoPassword);

    if (!user) {
      try {
        user = await createUser(demoEmail, demoPassword);
      } catch {
        // User may exist with different hash — update password hash
        const passwordHash = await hashPassword(demoPassword);
        const { rows } = await query<{ id: string; email: string }>(
          `INSERT INTO users (email, password_hash)
           VALUES ($1, $2)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
           RETURNING id, email`,
          [demoEmail, passwordHash],
        );
        user = rows[0];
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Failed to authenticate demo user' }, { status: 500 });
    }

    const token = await createSessionToken(user);
    const res = NextResponse.json({
      success: true,
      user,
      email: demoEmail,
      password: demoPassword,
    });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Demo sign in failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
