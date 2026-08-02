import pg from 'pg';
import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const sql = await readFile(resolve('db/migrations/0012_conversation_summaries.sql'), 'utf8');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');

  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'conversation_summaries'`,
  );
  if (tables.length !== 1) throw new Error('conversation_summaries was not created');

  // The one-per-session rule is what the upsert path depends on, so prove it
  // rather than trusting the DDL.
  const { rows: idx } = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'conversation_summaries_session_idx'`,
  );
  if (idx.length !== 1) throw new Error('one-summary-per-session index missing');

  const { rows: counts } = await client.query(
    `SELECT count(*)::int AS n FROM conversation_summaries`,
  );

  console.log('Conversation summary migration applied and verified.');
  console.log(`  summaries=${counts[0].n}`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  await client.end();
}
