import pg from 'pg';
import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured');

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const sql = await readFile(resolve('db/migrations/0008_project_decisions.sql'), 'utf8');
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'decision_memory'
       AND column_name = 'project_id'`,
  );
  if (rows.length !== 1) throw new Error('decision_memory.project_id was not created');
  console.log('Project decision migration applied and verified.');
} finally {
  await client.end();
}
