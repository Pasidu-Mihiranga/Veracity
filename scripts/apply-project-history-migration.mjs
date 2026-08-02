import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
import pg from 'pg';

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const sql = await readFile(resolve(process.cwd(), 'db/migrations/0007_project_research_history.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    const result = await client.query(`SELECT
      to_regclass('public.project_research_snapshots')::text AS snapshots,
      to_regclass('public.project_research_events')::text AS events`);
    if (!result.rows[0]?.snapshots || !result.rows[0]?.events) throw new Error('Migration verification failed');
    process.stdout.write('Project research history migration applied and verified.\n');
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
  process.stderr.write(`${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`);
  process.exitCode = 1;
}
