import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
import pg from 'pg';

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;

function formatError(error) {
  const nested = error && typeof error === 'object' && Array.isArray(error.errors)
    ? error.errors.map((item) => `${item.code ?? item.name ?? 'error'}: ${item.message ?? ''}`).join('; ')
    : '';
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return `${message || 'Schema setup failed'}${nested ? ` (${nested})` : ''}`;
}

async function main() {
  loadEnvConfig(process.cwd());
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  const sql = await readFile(resolve(process.cwd(), 'db/schema.sql'), 'utf8');
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    const verification = await client.query(`
      SELECT
        to_regclass('public.users')::text AS users_table,
        to_regclass('public.chat_sessions')::text AS sessions_table,
        to_regclass('public.market_projects')::text AS projects_table,
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_enabled
    `);
    const row = verification.rows[0];
    if (!row?.users_table || !row.sessions_table || !row.projects_table || !row.vector_enabled) {
      throw new Error('Schema verification failed');
    }
    process.stdout.write('Veracity schema applied and verified (users, sessions, projects, pgvector).\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}
