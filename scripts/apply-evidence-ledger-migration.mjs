import pg from 'pg';
import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured');

const EXPECTED_TABLES = [
  'evidence_spans',
  'metric_observations',
  'change_events',
  'claims',
  'chart_specs',
];

const EXPECTED_SNAPSHOT_COLUMNS = ['normalized_content', 'retrieval_status', 'project_id'];

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const sql = await readFile(resolve('db/migrations/0009_evidence_ledger.sql'), 'utf8');

  // One transaction: a half-applied ledger is worse than none, because later
  // code would see some tables and assume the rest exist.
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');

  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [EXPECTED_TABLES],
  );
  const foundTables = tables.map((r) => r.table_name);
  const missingTables = EXPECTED_TABLES.filter((t) => !foundTables.includes(t));
  if (missingTables.length > 0) {
    throw new Error(`missing tables after migration: ${missingTables.join(', ')}`);
  }

  const { rows: columns } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'source_snapshots'
        AND column_name = ANY($1)`,
    [EXPECTED_SNAPSHOT_COLUMNS],
  );
  const foundColumns = columns.map((r) => r.column_name);
  const missingColumns = EXPECTED_SNAPSHOT_COLUMNS.filter((c) => !foundColumns.includes(c));
  if (missingColumns.length > 0) {
    throw new Error(`missing source_snapshots columns: ${missingColumns.join(', ')}`);
  }

  // The dedupe index is what stops a re-run reporting the same change twice, so
  // verify it exists rather than assuming the CREATE succeeded.
  const { rows: indexes } = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'change_events_dedupe_idx'`,
  );
  if (indexes.length !== 1) throw new Error('change_events dedupe index was not created');

  const { rows: counts } = await client.query(
    `SELECT
       (SELECT count(*) FROM evidence_spans) AS spans,
       (SELECT count(*) FROM metric_observations) AS observations,
       (SELECT count(*) FROM change_events) AS events,
       (SELECT count(*) FROM claims) AS claims,
       (SELECT count(*) FROM chart_specs) AS charts`,
  );

  console.log('Evidence ledger migration applied and verified.');
  console.log(
    `  spans=${counts[0].spans} observations=${counts[0].observations} ` +
      `events=${counts[0].events} claims=${counts[0].claims} charts=${counts[0].charts}`,
  );
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  await client.end();
}
