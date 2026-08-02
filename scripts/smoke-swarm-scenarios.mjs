/**
 * Proves the Swarm Decision Lab tables hold their invariants against a real
 * database: a scenario branches without destroying its base, rounds and
 * responses persist, per-persona failures are recorded rather than dropped, and
 * the constraints reject malformed writes.
 *
 * Everything runs in one transaction and is rolled back.
 *
 * Run with: npm run test:e2e:swarm-scenarios
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

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

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

const BRIEF = {
  id: 'scenario-smoke',
  version: 1,
  decisionQuestion: 'Hold pricing or match the cut?',
  alternatives: [
    { id: 'A', label: 'Hold', description: 'Keep $59.' },
    { id: 'B', label: 'Match', description: 'Drop to $49.' },
  ],
};

try {
  await client.query('BEGIN');

  console.log('\nSetup');
  await client.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
    userId,
    `swarm-smoke+${userId}@example.invalid`,
  ]);
  const project = await client.query(
    `INSERT INTO market_projects (user_id, name, product) VALUES ($1, 'Swarm smoke', 'Vector Agents') RETURNING id`,
    [userId],
  );
  const projectId = project.rows[0].id;
  check('user and project created', Boolean(projectId));

  console.log('\nScenario versioning');
  const base = await client.query(
    `INSERT INTO swarm_scenarios (user_id, project_id, brief, version, model_version, panel_version)
     VALUES ($1, $2, $3::jsonb, 1, 'gemini-x', 'panel-1') RETURNING id`,
    [userId, projectId, JSON.stringify(BRIEF)],
  );
  const baseId = base.rows[0].id;
  check('base scenario stored', Boolean(baseId));

  const branch = await client.query(
    `INSERT INTO swarm_scenarios
       (user_id, project_id, brief, version, parent_version, branch_reason, model_version, panel_version)
     VALUES ($1, $2, $3::jsonb, 2, 1, 'Test the opposite assumption', 'gemini-x', 'panel-1')
     RETURNING id`,
    [userId, projectId, JSON.stringify({ ...BRIEF, version: 2 })],
  );
  check('branch stored as a new version', Boolean(branch.rows[0].id));

  const stillThere = await client.query(
    `SELECT version FROM swarm_scenarios WHERE id = $1`, [baseId],
  );
  check('branching did not destroy the base', stillThere.rows[0].version === 1);

  await mustReject(
    'a branch cannot point at a later version than itself',
    `INSERT INTO swarm_scenarios (user_id, brief, version, parent_version)
     VALUES ($1, '{}'::jsonb, 1, 5)`,
    [userId],
  );

  await mustReject(
    'an invalid status is rejected',
    `INSERT INTO swarm_scenarios (user_id, brief, status) VALUES ($1, '{}'::jsonb, 'vibes')`,
    [userId],
  );

  console.log('\nRounds and responses');
  const roundIds = [];
  for (const round of [1, 2, 3]) {
    const r = await client.query(
      `INSERT INTO swarm_rounds (scenario_id, user_id, round, purpose, scope)
       VALUES ($1, $2, $3, $4, 'panel') RETURNING id`,
      [baseId, userId, round, `round ${round}`],
    );
    roundIds.push(r.rows[0].id);
  }
  check('three rounds stored', roundIds.length === 3);

  await mustReject(
    'a duplicate round for the same scope is rejected',
    `INSERT INTO swarm_rounds (scenario_id, user_id, round, scope) VALUES ($1, $2, 1, 'panel')`,
    [baseId, userId],
  );

  const segmentFollowUp = await client.query(
    `INSERT INTO swarm_rounds (scenario_id, user_id, round, scope, scope_target)
     VALUES ($1, $2, 4, 'segment', 'econ') RETURNING id`,
    [baseId, userId],
  );
  check('a segment follow-up is a further round, not a new scenario',
    Boolean(segmentFollowUp.rows[0].id));

  for (const [i, persona] of ['p1', 'p2', 'p3'].entries()) {
    await client.query(
      `INSERT INTO swarm_responses
         (round_id, scenario_id, user_id, persona_id, segment_id, response,
          chosen_alternative_id, blocking_objection)
       VALUES ($1, $2, $3, $4, 'econ', $5, $6, 'Contract lock-in')`,
      [roundIds[2], baseId, userId, persona, `persona ${persona} decided`, i === 2 ? 'B' : 'A'],
    );
  }
  await client.query(
    `INSERT INTO swarm_responses
       (round_id, scenario_id, user_id, persona_id, segment_id, response, status, failure_reason)
     VALUES ($1, $2, $3, 'p4', 'user', '', 'failed', 'model unavailable')`,
    [roundIds[2], baseId, userId],
  );

  const stored = await client.query(
    `SELECT status, count(*)::int AS n FROM swarm_responses
      WHERE scenario_id = $1 GROUP BY status ORDER BY status`,
    [baseId],
  );
  const byStatus = Object.fromEntries(stored.rows.map((r) => [r.status, r.n]));
  check('a failed persona is recorded, not dropped', byStatus.failed === 1, JSON.stringify(byStatus));
  check('successful responses stored verbatim', byStatus.ok === 3);

  await mustReject(
    'a successful response cannot have an empty body',
    `INSERT INTO swarm_responses (round_id, scenario_id, user_id, persona_id, segment_id, response, status)
     VALUES ($1, $2, $3, 'p9', 'econ', '   ', 'ok')`,
    [roundIds[0], baseId, userId],
  );

  console.log('\nEvidence separation');
  const leakage = await client.query(
    `SELECT count(*)::int AS n FROM evidence_spans WHERE user_id = $1`,
    [userId],
  );
  check('no synthetic response leaked into the evidence ledger', leakage.rows[0].n === 0);

  console.log('\nCascade');
  await client.query(`DELETE FROM swarm_scenarios WHERE id = $1`, [baseId]);
  const orphans = await client.query(
    `SELECT (SELECT count(*)::int FROM swarm_rounds WHERE scenario_id = $1) AS rounds,
            (SELECT count(*)::int FROM swarm_responses WHERE scenario_id = $1) AS responses`,
    [baseId],
  );
  check('deleting a scenario removes its rounds and responses',
    orphans.rows[0].rounds === 0 && orphans.rows[0].responses === 0);

  console.log('\nCleaning up');
  await client.query('ROLLBACK');
  const leftover = await client.query(
    `SELECT count(*)::int AS n FROM swarm_scenarios WHERE user_id = $1`, [userId],
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
