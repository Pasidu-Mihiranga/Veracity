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
   VALUES ($1,$2,'lilian','competitor','Lilian') RETURNING id`, [userId, `project:${projectId}`]);
const { rows: snaps } = await client.query(
  `INSERT INTO source_snapshots (entity_id, user_id, project_id, scope_key, source_type, source_url, source_title, content_hash, normalized_content)
   VALUES ($1,$2,$3,$4,'page','https://lilian.example/pricing','Pricing','h1','Team plan is $59 per month.') RETURNING id`,
  [ents[0].id, userId, projectId, `project:${projectId}`]);
const { rows: spans } = await client.query(
  `INSERT INTO evidence_spans (snapshot_id, user_id, project_id, excerpt, start_offset, end_offset, extraction_type, entity_match)
   VALUES ($1,$2,$3,'Team plan is $59 per month',0,26,'price','confirmed') RETURNING id`,
  [snaps[0].id, userId, projectId]);
await client.query(
  `INSERT INTO change_events (user_id, project_id, entity_id, event_type, before_value, after_value, evidence_span_id, materiality, materiality_reason, confidence, dedupe_key)
   VALUES ($1,$2,$3,'pricing_changed','$49/month','$59/month',$4,0.85,'Entry-tier price moved 20% on a tracked competitor','high',$5)`,
  [userId, projectId, ents[0].id, spans[0].id, randomUUID()]);

// A price span carries a metric observation in the real pipeline
// (pricesToSpans emits one). Without it the verifier correctly rejects any
// numeric claim citing this span, because nothing measures the number.
await client.query(
  `INSERT INTO metric_observations (user_id, project_id, entity_id, evidence_span_id, metric_key, value, unit)
   VALUES ($1,$2,$3,$4,'plan_price',59,'USD/month')`,
  [userId, projectId, ents[0].id, spans[0].id]);

// ── Collection route contract ───────────────────────────────────────────────
// Exercised without depending on any external site being up: a project with no
// sources must refuse with a specific instruction rather than returning an
// empty run that reads as "we looked and found nothing".
const bareProject = await (await fetch(`${BASE}/api/projects`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({ name: 'No sources', product: 'Nothing', competitors: [] }),
})).json();
const bareId = bareProject?.data?.project?.id;

const noSources = await fetch(`${BASE}/api/projects/${bareId}/collect`, {
  method: 'POST', headers: jsonHeaders(),
});
const noSourcesBody = await noSources.json();
check('collect refuses a project with no sources', noSources.status === 400, String(noSources.status));
// apiError nests as { error: { code, message } }, not a bare string.
const refusalText = noSourcesBody?.error?.message ?? String(noSourcesBody?.error ?? '');
check('the refusal says what to do about it',
  refusalText.includes('product URL'), refusalText.slice(0, 140));
check('the refusal carries a machine-readable code',
  noSourcesBody?.error?.code === 'NO_SOURCES', JSON.stringify(noSourcesBody?.error?.code));

const missing = await fetch(`${BASE}/api/projects/00000000-0000-4000-8000-000000000000/collect`, {
  method: 'POST', headers: jsonHeaders(),
});
check('collect 404s for a project the user does not own', missing.status === 404, String(missing.status));

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

// ── Research claims reach the ledger ────────────────────────────────────────
// Posting an assistant message with orchestrator output must persist the
// agents' statements as claims, classified by whether a stored excerpt
// supports them.
const session = await client.query(
  `INSERT INTO chat_sessions (user_id, project_id, title) VALUES ($1, $2, 'Claims smoke') RETURNING id`,
  [userId, projectId],
);
const sessionId = session.rows[0].id;

const orchestratorOutput = {
  product: 'Vector Agents',
  competitor: 'Lilian',
  synthesizedAnswer: 'Lilian repriced downward.',
  generatedAt: new Date().toISOString(),
  outputs: [
    {
      agentId: 'pricing',
      // Supported by the span seeded earlier ("Team plan is $59 per month").
      facts: ['Team plan is $59 per month'],
      interpretation: ['They are competing on price.'],
      sources: [{ url: 'https://lilian.example/pricing', title: 'Pricing' }],
    },
    {
      agentId: 'market-trends',
      // Nothing supports this, so it must be demoted to interpretation.
      facts: ['The category is consolidating rapidly'],
      interpretation: ['SYNTHESIS_ERROR: should be dropped'],
      sources: [],
    },
  ],
};

const posted = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({
    role: 'assistant',
    content: 'Lilian repriced downward.',
    metadata: { orchestratorOutput },
  }),
});
check('assistant message accepted', posted.ok, String(posted.status));

const stored = await client.query(
  `SELECT statement, claim_type, confidence, cardinality(supporting_span_ids) AS spans
     FROM claims WHERE user_id = $1 AND project_id = $2 ORDER BY claim_type, statement`,
  [userId, projectId],
);

const facts = stored.rows.filter((r) => r.claim_type === 'fact');
const interps = stored.rows.filter((r) => r.claim_type === 'interpretation');

check('a supported statement is stored as a fact',
  facts.length === 1 && facts[0].statement.includes('$59'),
  JSON.stringify(stored.rows.map((r) => [r.claim_type, r.statement.slice(0, 40)])));
check('the fact carries its supporting span', Number(facts[0]?.spans) > 0);
check('a single-source fact is not labelled high', facts[0]?.confidence !== 'high', facts[0]?.confidence);
check('an unsupported "fact" is demoted to interpretation',
  interps.some((r) => r.statement.includes('consolidating')));
check('synthesis-error markers are not stored',
  !stored.rows.some((r) => r.statement.includes('SYNTHESIS_ERROR')));

// A numeric claim whose cited span has no observation must be refused. This is
// the ledger's core rule reaching all the way through the request path.
const unbacked = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({
    role: 'assistant',
    content: 'Unbacked numeric claim.',
    metadata: {
      orchestratorOutput: {
        product: 'Vector Agents', generatedAt: new Date().toISOString(),
        outputs: [{
          agentId: 'pricing',
          facts: ['Team plan is $59 per month and churn fell 87 percent'],
          interpretation: [], sources: [],
        }],
      },
    },
  }),
});
check('unbacked numeric message still accepted', unbacked.ok);

const afterUnbacked = await client.query(
  `SELECT count(*)::int AS n FROM claims
    WHERE user_id = $1 AND project_id = $2 AND statement LIKE '%87 percent%'`,
  [userId, projectId],
);
check('a numeric claim with no matching observation never reaches the ledger',
  afterUnbacked.rows[0].n === 0, String(afterUnbacked.rows[0].n));

// ── Explain reads the ledger back ───────────────────────────────────────────
const explain = await fetch(`${BASE}/api/projects/${projectId}/explain`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({ question: 'What is the team plan price?', mode: 'explain' }),
});
// Without a live model key this returns 409 with a reason; with one it answers.
// Either is correct — what must never happen is a silent full sweep.
check('explain answers or explains why it cannot',
  explain.status === 200 || explain.status === 409, String(explain.status));

const explainBody = await explain.json();
if (explain.status === 409) {
  check('the refusal names a reason',
    Boolean(explainBody?.error?.message), JSON.stringify(explainBody).slice(0, 120));
} else {
  check('the answer cites stored claims',
    Array.isArray(explainBody?.data?.citedClaimIds));
}

// ── Evidence pack: agents can cite, and citations are validated ─────────────
const packed = await client.query(
  `SELECT s.id FROM evidence_spans s WHERE s.user_id = $1 AND s.project_id = $2 LIMIT 1`,
  [userId, projectId],
);
const citableSpanId = packed.rows[0].id;

const cited = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({
    role: 'assistant',
    content: 'Cited findings.',
    metadata: {
      orchestratorOutput: {
        product: 'Vector Agents', generatedAt: new Date().toISOString(),
        outputs: [{
          agentId: 'pricing',
          facts: [
            // A real citation the agent was given.
            `Team plan is $59 per month [${citableSpanId}]`,
            // An id that does not exist — must be stripped, not stored.
            'Revenue tripled [99999999-9999-4999-8999-999999999999]',
          ],
          interpretation: [], sources: [],
        }],
      },
    },
  }),
});
check('cited message accepted', cited.ok, String(cited.status));

const citedClaims = await client.query(
  `SELECT statement, claim_type, supporting_span_ids FROM claims
    WHERE user_id = $1 AND project_id = $2 AND statement LIKE '%Team plan%'
    ORDER BY created_at DESC LIMIT 1`,
  [userId, projectId],
);
check('an agent citation binds the claim to that exact span',
  citedClaims.rows[0]?.supporting_span_ids?.includes(citableSpanId),
  JSON.stringify(citedClaims.rows[0]));
check('citation markup never reaches the stored statement',
  !citedClaims.rows[0]?.statement.includes('['), citedClaims.rows[0]?.statement);

const ghostClaim = await client.query(
  `SELECT statement FROM claims WHERE user_id = $1 AND statement LIKE '%99999999%'`,
  [userId],
);
check('an invented span id is stripped rather than stored', ghostClaim.rows.length === 0);

// ── Charts route reads the ledger ───────────────────────────────────────────
const charts = await fetch(`${BASE}/api/projects/${projectId}/charts`, { headers: jsonHeaders() });
const chartsBody = await charts.json();
check('charts route responds', charts.ok, String(charts.status));
check('a measured chart is built from the stored observation',
  Array.isArray(chartsBody?.data?.charts) && chartsBody.data.charts.length > 0,
  JSON.stringify(chartsBody?.data?.charts?.length));

const priceChart = chartsBody?.data?.charts?.find((c) => String(c.id).includes('plan_price'));
if (priceChart) {
  check('the chart is classed measured', priceChart.dataClass === 'measured', priceChart.dataClass);
  check('every chart row traces to an evidence span',
    Array.isArray(priceChart.evidenceSpanIds) && priceChart.evidenceSpanIds.length > 0);
  check('the chart states its formula', Boolean(priceChart.formula));
} else {
  check('a plan_price chart was planned', false, JSON.stringify(chartsBody?.data?.unavailable));
}

const coverage = chartsBody?.data?.charts?.find((c) => String(c.id).includes('evidence-coverage'));
check('evidence coverage is derived, not measured',
  !coverage || coverage.dataClass === 'derived', coverage?.dataClass);

// ── Timeline shows everything, including sub-threshold changes ──────────────
const timeline = await fetch(`${BASE}/api/projects/${projectId}/timeline`, { headers: jsonHeaders() });
const timelineBody = await timeline.json();
check('timeline route responds', timeline.ok, String(timeline.status));

const tlEvents = timelineBody?.data?.events ?? [];
check('timeline includes the material change',
  tlEvents.some((e) => e.event_type === 'pricing_changed'), String(tlEvents.length));
check('timeline also includes the change the digest suppressed',
  tlEvents.some((e) => e.event_type === 'documentation_changed'),
  JSON.stringify(tlEvents.map((e) => e.event_type)));

const coverageRows = timelineBody?.data?.coverage ?? [];
check('coverage reports what has been read per entity',
  coverageRows.length > 0 && coverageRows.some((r) => r.entity_label === 'Lilian'),
  JSON.stringify(coverageRows.slice(0, 2)));
check('coverage counts the stored excerpts',
  coverageRows.some((r) => Number(r.span_count) > 0));

// ── Follow-up refuses a scenario that never ran ─────────────────────────────
const draftScenario = await client.query(
  `INSERT INTO swarm_scenarios (user_id, project_id, brief, version, status)
   VALUES ($1, $2, $3::jsonb, 1, 'draft') RETURNING id`,
  [userId, projectId, JSON.stringify({ id: 's1', version: 1, decisionQuestion: 'Q', alternatives: [] })],
);
const followUp = await fetch(`${BASE}/api/scenarios/${draftScenario.rows[0].id}/follow-up`, {
  method: 'POST', headers: jsonHeaders(),
  body: JSON.stringify({ question: 'Why?', scope: 'panel' }),
});
check('follow-up refuses a panel that never answered', followUp.status === 409, String(followUp.status));
const followUpBody = await followUp.json();
check('the refusal explains there is no panel to question',
  String(followUpBody?.error?.message).includes('no panel'),
  String(followUpBody?.error?.message).slice(0, 90));

await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
await client.end();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
