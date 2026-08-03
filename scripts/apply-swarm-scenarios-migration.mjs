import pg from 'pg';
import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured');

const EXPECTED = ['swarm_scenarios', 'swarm_rounds', 'swarm_responses'];

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const sql = await readFile(resolve('db/migrations/0010_swarm_scenarios.sql'), 'utf8');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [EXPECTED],
  );
  const found = rows.map((r) => r.table_name);
  const missing = EXPECTED.filter((t) => !found.includes(t));
  if (missing.length > 0) throw new Error(`missing tables: ${missing.join(', ')}`);

  const { rows: counts } = await client.query(
    `SELECT
       (SELECT count(*) FROM swarm_scenarios) AS scenarios,
       (SELECT count(*) FROM swarm_rounds) AS rounds,
       (SELECT count(*) FROM swarm_responses) AS responses`,
  );

  console.log('Swarm scenario migration applied and verified.');
  console.log(
    `  scenarios=${counts[0].scenarios} rounds=${counts[0].rounds} responses=${counts[0].responses}`,
  );
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  await client.end();
}
