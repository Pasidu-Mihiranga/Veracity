/**
 * Bring a database up to date. One command, safe to re-run.
 *
 * This exists because the README used to ask for eight separate commands in the
 * right order, and missing any of them produced a running app that failed at
 * the first request with a raw Postgres error:
 *
 *   error: relation "market_projects" does not exist
 *   error: column "project_id" does not exist
 *
 * Nothing told the developer their database was behind — the app started
 * cleanly and only broke once the browser asked for data. The second error is
 * the nastier one: `chat_sessions` already existed, so `CREATE TABLE IF NOT
 * EXISTS` skipped it silently and the newer column never landed.
 *
 * Order matters. `db/schema.sql` is the consolidated current state and runs
 * first; the numbered migrations then run oldest to newest to repair anything
 * that predates them. Both are written to be idempotent, so a database that is
 * already current ends up unchanged.
 */

import pg from 'pg';
import nextEnv from '@next/env';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  process.stderr.write(
    '\n  DATABASE_URL is not set.\n' +
      '  Copy .env.example to .env and fill it in — see README step 4.\n\n',
  );
  process.exit(1);
}

/**
 * Objects the app requests on its very first page load.
 *
 * Checked afterwards so a partial run fails here rather than in the browser.
 * These two are exactly what broke: the table that did not exist, and the
 * column that a skipped CREATE TABLE never added.
 */
const REQUIRED = [
  { kind: 'table', name: 'market_projects' },
  { kind: 'table', name: 'chat_sessions' },
  { kind: 'table', name: 'conversation_summaries' },
  { kind: 'column', name: 'chat_sessions.project_id' },
  { kind: 'column', name: 'chat_sessions.folder_name' },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
} catch (err) {
  // A refused connection arrives with an empty `message` and only a `code`, so
  // reporting `err.message` alone prints a blank line and explains nothing.
  const reason = err.message || err.code || String(err);
  const host = (() => {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return `${u.hostname}:${u.port || 5432}`;
    } catch {
      return 'the configured host';
    }
  })();

  process.stderr.write(
    `\n  Could not connect to ${host} — ${reason}\n\n` +
      '  Is the database running? For the one this repo manages:\n' +
      '    npm run db:local:start\n\n',
  );
  process.exit(1);
}

let applied = 0;

/** Run one SQL file in its own transaction so a failure cannot half-apply it. */
async function apply(label, path) {
  const sql = await readFile(path, 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    applied += 1;
    process.stdout.write(`  ok    ${label}\n`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    process.stderr.write(`  FAIL  ${label}\n\n  ${err.message}\n\n`);
    throw err;
  }
}

try {
  process.stdout.write('\n  Applying schema\n');
  await apply('db/schema.sql', resolve('db/schema.sql'));

  // Sorted by filename, which is why they are zero-padded.
  const files = (await readdir(resolve('db/migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  process.stdout.write(`\n  Applying ${files.length} migrations\n`);
  for (const file of files) {
    await apply(file, resolve('db/migrations', file));
  }

  // Verify behaviour, not just that the statements ran. A migration that
  // succeeds without producing the object it promised is the failure mode this
  // whole script exists to prevent.
  process.stdout.write('\n  Verifying\n');
  const missing = [];

  for (const item of REQUIRED) {
    if (item.kind === 'table') {
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1`,
        [item.name],
      );
      if (rows.length === 0) missing.push(`table ${item.name}`);
    } else {
      const [table, column] = item.name.split('.');
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column],
      );
      if (rows.length === 0) missing.push(`column ${item.name}`);
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      `  Missing after migrating:\n${missing.map((m) => `    - ${m}`).join('\n')}\n\n`,
    );
    process.exit(1);
  }

  const { rows: counts } = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
  );

  process.stdout.write(
    `  ok    all ${REQUIRED.length} required objects present\n\n` +
      `  Database is up to date — ${applied} files applied, ${counts[0].n} tables.\n\n`,
  );
} catch {
  process.stderr.write('  Database was NOT fully migrated. Nothing partial was left behind.\n\n');
  process.exit(1);
} finally {
  await client.end();
}
