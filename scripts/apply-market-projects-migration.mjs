import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
import pg from 'pg';

const { Pool } = pg;
const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  const migrationPath = resolve(process.cwd(), 'db/migrations/0006_market_projects.sql');
  const sql = await readFile(migrationPath, 'utf8');
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const verification = await client.query(`
      SELECT
        to_regclass('public.market_projects')::text AS projects_table,
        (
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'chat_sessions'
            AND column_name = 'project_id'
        ) AS project_column,
        (SELECT count(*)::text FROM market_projects) AS project_count
    `);
    const row = verification.rows[0];
    if (row?.projects_table !== 'market_projects' || row.project_column !== 'project_id') {
      throw new Error('Migration verification failed');
    }
    process.stdout.write(`Market Projects migration applied. Existing projects: ${row.project_count}.\n`);
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
  const nested = error && typeof error === 'object' && Array.isArray(error.errors)
    ? error.errors.map((item) => `${item.code ?? item.name ?? 'error'}: ${item.message ?? ''}`).join('; ')
    : '';
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`${message || 'Migration failed'}${nested ? ` (${nested})` : ''}\n`);
  process.exitCode = 1;
}
