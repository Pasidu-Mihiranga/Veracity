/**
 * End-to-end proof that the evidence ledger holds its invariants against a real
 * PostgreSQL database, not just in unit tests with in-memory objects.
 *
 * Walks the full chain: snapshot -> evidence span -> metric observation ->
 * change event -> chart spec, then attempts the writes that must be rejected.
 * Everything it creates is removed at the end.
 *
 * Run with: npm run test:e2e:evidence-ledger
 */

import pg from 'pg';
import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured');

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const userId = randomUUID();
let passed = 0;
let failed = 0;
const created = { entity: null, snapshots: [], project: null };

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Run a statement that must be rejected by the database. */
async function mustReject(name, sql, params) {
  try {
    await client.query('SAVEPOINT probe');
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT probe');
    check(name, false, 'the write was accepted but should have been rejected');
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT probe');
    check(name, true);
  }
}

try {
  await client.query('BEGIN');

  console.log('\nSetting up a user, project, and entity');

  // Projects are owned, so the smoke run needs a real user row. Everything is
  // created inside one transaction and rolled back at the end.
  const user = await client.query(
    `INSERT INTO users (id, email) VALUES ($1, $2) RETURNING id`,
    [userId, `ledger-smoke+${userId}@example.invalid`],
  );
  check('smoke user created', user.rows[0].id === userId);

  const project = await client.query(
    `INSERT INTO market_projects (user_id, name, product, competitors)
     VALUES ($1, 'Ledger smoke', 'Vector Agents', ARRAY['Lilian'])
     RETURNING id`,
    [userId],
  );
  created.project = project.rows[0].id;
  check('project created', Boolean(created.project));

  const entity = await client.query(
    `INSERT INTO canonical_entities
       (user_id, scope_key, entity_key, entity_type, display_name)
     VALUES ($1, 'smoke', 'lilian', 'competitor', 'Lilian')
     RETURNING id`,
    [userId],
  );
  created.entity = entity.rows[0].id;
  check('entity created', Boolean(created.entity));

  console.log('\nSnapshot -> span -> observation');

  const january = await client.query(
    `INSERT INTO source_snapshots
       (entity_id, user_id, project_id, scope_key, source_type, source_url,
        source_title, content_hash, normalized_content, observed_at)
     VALUES ($1, $2, $3, 'smoke', 'page', 'https://lilian.example/pricing',
             'Pricing', 'hash-january', 'Team plan is $49 per month.', '2026-01-01T00:00:00Z')
     RETURNING id`,
    [created.entity, userId, created.project],
  );
  created.snapshots.push(january.rows[0].id);
  check('january snapshot stored', Boolean(january.rows[0].id));

  const span = await client.query(
    `INSERT INTO evidence_spans
       (snapshot_id, user_id, project_id, excerpt, start_offset, end_offset,
        extraction_type, entity_match)
     VALUES ($1, $2, $3, 'Team plan is $49 per month', 0, 26, 'price', 'confirmed')
     RETURNING id`,
    [january.rows[0].id, userId, created.project],
  );
  check('evidence span stored with offsets', Boolean(span.rows[0].id));

  const observation = await client.query(
    `INSERT INTO metric_observations
       (user_id, project_id, entity_id, evidence_span_id, metric_key, value, unit,
        period_start, method)
     VALUES ($1, $2, $3, $4, 'plan_price', 49, 'USD/month', '2026-01-01T00:00:00Z', 'extracted')
     RETURNING id`,
    [userId, created.project, created.entity, span.rows[0].id],
  );
  check('observation stored against its span', Boolean(observation.rows[0].id));

  console.log('\nInvariants the database must enforce');

  await mustReject(
    'a number with no evidence span is rejected',
    `INSERT INTO metric_observations
       (user_id, project_id, entity_id, evidence_span_id, metric_key, value, unit)
     VALUES ($1, $2, $3, NULL, 'plan_price', 999, 'USD/month')`,
    [userId, created.project, created.entity],
  );

  await mustReject(
    'an empty excerpt is rejected',
    `INSERT INTO evidence_spans (snapshot_id, user_id, excerpt)
     VALUES ($1, $2, '   ')`,
    [january.rows[0].id, userId],
  );

  await mustReject(
    'reversed span offsets are rejected',
    `INSERT INTO evidence_spans (snapshot_id, user_id, excerpt, start_offset, end_offset)
     VALUES ($1, $2, 'text', 400, 20)`,
    [january.rows[0].id, userId],
  );

  await mustReject(
    'an unknown change event type is rejected',
    `INSERT INTO change_events
       (user_id, project_id, event_type, after_value, materiality, materiality_reason, dedupe_key)
     VALUES ($1, $2, 'vibes_shifted', 'x', 0.5, 'r', $3)`,
    [userId, created.project, randomUUID()],
  );

  await mustReject(
    'materiality above 1 is rejected',
    `INSERT INTO change_events
       (user_id, project_id, event_type, after_value, materiality, materiality_reason, dedupe_key)
     VALUES ($1, $2, 'pricing_changed', 'x', 1.5, 'r', $3)`,
    [userId, created.project, randomUUID()],
  );

  await mustReject(
    'an invalid chart data class is rejected',
    `INSERT INTO chart_specs (user_id, project_id, spec, data_class)
     VALUES ($1, $2, '{}'::jsonb, 'vibes')`,
    [userId, created.project],
  );

  console.log('\nChange detection and deduplication');

  const march = await client.query(
    `INSERT INTO source_snapshots
       (entity_id, user_id, project_id, scope_key, source_type, source_url,
        source_title, content_hash, normalized_content, observed_at)
     VALUES ($1, $2, $3, 'smoke', 'page', 'https://lilian.example/pricing',
             'Pricing', 'hash-march', 'Team plan is $59 per month.', '2026-03-01T00:00:00Z')
     RETURNING id`,
    [created.entity, userId, created.project],
  );
  created.snapshots.push(march.rows[0].id);

  const dedupeKey = `${created.entity}:pricing_changed:49:59`;
  const first = await client.query(
    `INSERT INTO change_events
       (user_id, project_id, entity_id, event_type, before_value, after_value,
        from_snapshot_id, to_snapshot_id, evidence_span_id,
        materiality, materiality_reason, confidence, dedupe_key)
     VALUES ($1, $2, $3, 'pricing_changed', '$49/month', '$59/month', $4, $5, $6,
             0.8, 'Entry-tier price moved 20% on a tracked competitor', 'high', $7)
     ON CONFLICT (project_id, dedupe_key) DO NOTHING
     RETURNING id`,
    [
      userId, created.project, created.entity, january.rows[0].id,
      march.rows[0].id, span.rows[0].id, dedupeKey,
    ],
  );
  check('change event recorded', first.rows.length === 1);

  const repeat = await client.query(
    `INSERT INTO change_events
       (user_id, project_id, entity_id, event_type, before_value, after_value,
        materiality, materiality_reason, dedupe_key)
     VALUES ($1, $2, $3, 'pricing_changed', '$49/month', '$59/month', 0.8, 'same', $4)
     ON CONFLICT (project_id, dedupe_key) DO NOTHING
     RETURNING id`,
    [userId, created.project, created.entity, dedupeKey],
  );
  check('a re-run does not duplicate the same change', repeat.rows.length === 0);

  console.log('\nReproducing a chart from stored observations');

  await client.query(
    `INSERT INTO evidence_spans
       (id, snapshot_id, user_id, project_id, excerpt, extraction_type, entity_match)
     VALUES ($1, $2, $3, $4, 'Team plan is $59 per month', 'price', 'confirmed')`,
    [
      '00000000-0000-4000-8000-00000000beef', march.rows[0].id, userId, created.project,
    ],
  );
  await client.query(
    `INSERT INTO metric_observations
       (user_id, project_id, entity_id, evidence_span_id, metric_key, value, unit, period_start)
     VALUES ($1, $2, $3, $4, 'plan_price', 59, 'USD/month', '2026-03-01T00:00:00Z')`,
    [userId, created.project, created.entity, '00000000-0000-4000-8000-00000000beef'],
  );

  const series = await client.query(
    `SELECT o.value::float8 AS value, o.unit, o.period_start, s.excerpt, snap.source_url
       FROM metric_observations o
       JOIN evidence_spans s ON s.id = o.evidence_span_id
       JOIN source_snapshots snap ON snap.id = s.snapshot_id
      WHERE o.user_id = $1 AND o.project_id = $2 AND o.metric_key = 'plan_price'
      ORDER BY o.period_start ASC`,
    [userId, created.project],
  );

  check('every chart row joins back to an excerpt and a source URL',
    series.rows.length === 2 && series.rows.every((r) => r.excerpt && r.source_url));
  check('the series reads 49 then 59',
    series.rows[0].value === 49 && series.rows[1].value === 59,
    JSON.stringify(series.rows.map((r) => r.value)));

  const chart = await client.query(
    `INSERT INTO chart_specs (user_id, project_id, spec, data_class)
     VALUES ($1, $2, $3::jsonb, 'measured')
     RETURNING id`,
    [
      userId, created.project,
      JSON.stringify({ id: 'smoke', kind: 'line', unit: 'USD/month' }),
    ],
  );
  check('chart spec stored with its data class', Boolean(chart.rows[0].id));

  console.log('\nCleaning up');
  await client.query('ROLLBACK');
  console.log('  ok    all smoke data rolled back');

  const leftover = await client.query(
    `SELECT count(*)::int AS n FROM evidence_spans WHERE user_id = $1`,
    [userId],
  );
  check('no smoke rows remain', leftover.rows[0].n === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('\nSmoke run failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
