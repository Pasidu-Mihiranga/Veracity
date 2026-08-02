import pg from 'pg';
import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured');

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const sql = await readFile(resolve('db/migrations/0011_entity_ownership.sql'), 'utf8');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');

  const { rows: leftover } = await client.query(
    `SELECT conname FROM pg_constraint
      WHERE conrelid = 'canonical_entities'::regclass
        AND conname = 'canonical_entities_scope_key_entity_type_entity_key_key'`,
  );
  if (leftover.length > 0) throw new Error('the owner-less constraint still exists');

  const { rows: idx } = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'canonical_entities_owner_scope_idx'`,
  );
  if (idx.length !== 1) throw new Error('owner-scoped unique index was not created');

  // Prove the fix rather than trusting the DDL: two users must be able to
  // create the same entity key, and one user must still not duplicate it.
  await client.query('BEGIN');
  const a = randomUUID();
  const b = randomUUID();
  await client.query(`INSERT INTO users (id, email) VALUES ($1, $2), ($3, $4)`,
    [a, `probe-a+${a}@example.invalid`, b, `probe-b+${b}@example.invalid`]);

  await client.query(
    `INSERT INTO canonical_entities (user_id, scope_key, entity_key, entity_type, display_name)
     VALUES ($1, 'probe', 'lilian', 'competitor', 'Lilian')`, [a]);
  await client.query(
    `INSERT INTO canonical_entities (user_id, scope_key, entity_key, entity_type, display_name)
     VALUES ($1, 'probe', 'lilian', 'competitor', 'Lilian')`, [b]);

  let duplicateRejected = false;
  try {
    await client.query('SAVEPOINT dup');
    await client.query(
      `INSERT INTO canonical_entities (user_id, scope_key, entity_key, entity_type, display_name)
       VALUES ($1, 'probe', 'lilian', 'competitor', 'Lilian')`, [a]);
    await client.query('RELEASE SAVEPOINT dup');
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT dup');
    duplicateRejected = true;
  }
  await client.query('ROLLBACK');

  if (!duplicateRejected) throw new Error('one user can now duplicate an entity key');

  console.log('Entity ownership migration applied and verified.');
  console.log('  two users can share an entity key; one user still cannot duplicate it');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  await client.end();
}
