/**
 * Create the local development login.
 *
 * Signing up by hand before every demo is friction with no upside, so `npm run
 * dev:local` seeds a known account. The password is weak on purpose — it is
 * typed dozens of times a day against a database that holds nothing real.
 *
 * That is only safe because this refuses to run anywhere else. A weak, publicly
 * documented admin account reaching a shared or hosted database would be a
 * straightforward account takeover, so two independent guards must both pass:
 *
 *   1. NODE_ENV must not be production.
 *   2. DATABASE_URL must point at a loopback host.
 *
 * Neither is a warning. Failing either exits non-zero without touching the
 * database. Do not add a --force flag; the whole value of this file is that it
 * cannot be pointed somewhere it does not belong.
 *
 * Idempotent: re-running resets the password on the existing account rather than
 * failing, so a forgotten local password is one command away from working.
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const EMAIL = process.env.DEV_SEED_EMAIL ?? 'admin@local.com';
const PASSWORD = process.env.DEV_SEED_PASSWORD ?? 'admin1234';

/** Hosts where a throwaway admin account cannot hurt anyone. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

function refuse(reason) {
  process.stderr.write(
    `\n  Refusing to seed the dev login.\n  ${reason}\n\n` +
      `  This account is weak by design and only belongs in a local database.\n\n`,
  );
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  refuse('NODE_ENV is production.');
}

const url = process.env.DATABASE_URL;
if (!url) refuse('DATABASE_URL is not configured.');

let host;
try {
  host = new URL(url).hostname;
} catch {
  refuse(`DATABASE_URL is not a valid URL, so its host cannot be checked.`);
}

if (!LOOPBACK.has(host)) {
  refuse(`DATABASE_URL points at "${host}", which is not a loopback address.`);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const email = EMAIL.toLowerCase().trim();

  // ON CONFLICT rather than an existence check: two `npm run dev:local` calls
  // racing on the same database should not leave one of them in an error state.
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, (xmax = 0) AS created`,
    [email, passwordHash],
  );

  const { id, created } = rows[0];

  // Prove the credentials actually authenticate. Writing a hash that the login
  // path rejects — a column rename, a changed cost factor — would look like a
  // successful seed and fail at the login screen.
  const { rows: check } = await client.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [id],
  );
  if (!(await bcrypt.compare(PASSWORD, check[0].password_hash))) {
    throw new Error('seeded password does not verify — the login would fail');
  }

  process.stdout.write(
    `  Dev login ${created ? 'created' : 'ready'}: ${email} / ${PASSWORD}\n`,
  );
} finally {
  await client.end();
}
