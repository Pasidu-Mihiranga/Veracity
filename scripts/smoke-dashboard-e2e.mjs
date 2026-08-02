/** Authenticated end-to-end: signup -> project -> seed a change -> dashboard API. */
import pg from 'pg';
import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const BASE = 'http://localhost:3000';
const runId = randomUUID().slice(0, 8);
const email = `dash-smoke+${runId}@example.invalid`;
const password = 'Test-Password-123!';

let cookie = '';
const jsonHeaders = () => ({ 'content-type': 'application/json', ...(cookie ? { cookie } : {}) });

function capture(res) {
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(',').map((c) => c.split(';')[0].trim()).join('; ');
}

let pass = 0, fail = 0;
const check = (n, c, d = '') => c ? (pass++, console.log(`  ok    ${n}`)) : (fail++, console.log(`  FAIL  ${n}${d ? ` — ${d}` : ''}`));

const signup = await fetch(`${BASE}/api/auth/signup`, {
  method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ email, password }),
});
capture(signup);
check('signup', signup.ok, `${signup.status} ${(await signup.clone().text()).slice(0, 120)}`);

const projectRes = await fetch(`${BASE}/api/projects`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({ name: 'Dash smoke', product: 'Vector Agents', competitors: ['Lilian'], decision_context: 'pricing' }),
});
const projectBody = await projectRes.json();
const projectId = projectBody?.data?.project?.id ?? projectBody?.data?.id ?? projectBody?.id;
check('project created', Boolean(projectId), JSON.stringify(projectBody).slice(0, 160));

// Seed one material change with real evidence, straight into the ledger.
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows: users } = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
const userId = users[0].id;

const { rows: ents } = await client.query(
  `INSERT INTO canonical_entities (user_id, scope_key, entity_key, entity_type, display_name)
   VALUES ($1,$2,'lilian','competitor','Lilian') RETURNING id`, [userId, `smoke-${runId}`]);
const { rows: snaps } = await client.query(
  `INSERT INTO source_snapshots (entity_id, user_id, project_id, scope_key, source_type, source_url, source_title, content_hash, normalized_content)
   VALUES ($1,$2,$3,$4,'page','https://lilian.example/pricing','Pricing','h1','Team plan is $59 per month.') RETURNING id`,
  [ents[0].id, userId, projectId, `smoke-${runId}`]);
const { rows: spans } = await client.query(
  `INSERT INTO evidence_spans (snapshot_id, user_id, project_id, excerpt, start_offset, end_offset, extraction_type, entity_match)
   VALUES ($1,$2,$3,'Team plan is $59 per month',0,26,'price','confirmed') RETURNING id`,
  [snaps[0].id, userId, projectId]);
await client.query(
  `INSERT INTO change_events (user_id, project_id, entity_id, event_type, before_value, after_value, evidence_span_id, materiality, materiality_reason, confidence, dedupe_key)
   VALUES ($1,$2,$3,'pricing_changed','$49/month','$59/month',$4,0.85,'Entry-tier price moved 20% on a tracked competitor','high',$5)`,
  [userId, projectId, ents[0].id, spans[0].id, randomUUID()]);

const dash = await fetch(`${BASE}/api/projects/${projectId}/dashboard`, { headers: jsonHeaders() });
const dashBody = await dash.json();
check('dashboard responds', dash.ok, `${dash.status}`);

const digest = dashBody?.data?.digest;
check('digest contains the seeded change', digest?.itemCount === 1, JSON.stringify(digest?.itemCount));
check('headline names the change', String(digest?.headline).includes('Lilian'), digest?.headline);
const item = digest?.sections?.[0]?.items?.[0];
check('before/after survives the round trip', item?.beforeValue === '$49/month' && item?.afterValue === '$59/month');
check('materiality reason travels to the client', String(item?.materialityReason).includes('20%'));

const ev = await fetch(`${BASE}/api/evidence?ids=${item?.evidenceSpanId}`, { headers: jsonHeaders() });
const evBody = await ev.json();
check('evidence route returns the excerpt', evBody?.data?.spans?.[0]?.excerpt === 'Team plan is $59 per month',
  JSON.stringify(evBody).slice(0, 160));
check('excerpt carries its snapshot hash', Boolean(evBody?.data?.spans?.[0]?.contentHash));

// Sub-threshold changes must not reach the user.
await client.query(
  `INSERT INTO change_events (user_id, project_id, entity_id, event_type, after_value, evidence_span_id, materiality, materiality_reason, confidence, dedupe_key)
   VALUES ($1,$2,$3,'documentation_changed','tweaked',$4,0.1,'Minor docs edit','low',$5)`,
  [userId, projectId, ents[0].id, spans[0].id, randomUUID()]);
const dash2 = await (await fetch(`${BASE}/api/projects/${projectId}/dashboard`, { headers: jsonHeaders() })).json();
check('immaterial change is withheld', dash2?.data?.digest?.itemCount === 1);
check('withholding is explained', dash2?.data?.digest?.suppressed?.length >= 1,
  JSON.stringify(dash2?.data?.digest?.suppressed));

await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
await client.end();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
