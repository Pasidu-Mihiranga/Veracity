import nextEnv from '@next/env';
import pg from 'pg';

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;
loadEnvConfig(process.cwd());

const baseUrl = process.env.VERACITY_SMOKE_BASE_URL ?? 'http://localhost:3000';
const email = `codex-market-project-${Date.now()}@local.invalid`;
const password = 'LocalSmoke-Only-9x!';
let cookie = '';

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
    redirect: 'manual',
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

async function runLiveResearch(sessionId) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      query: 'What is one currently verifiable market signal for Acme? Keep the answer concise.',
      history: [],
      selectedAgents: ['market-trends'],
      followUpMode: 'targeted',
      turnMode: 'verify',
      sessionId,
      conversationId: sessionId,
    }),
  });
  if (!response.ok) throw new Error(`Live research failed (${response.status}): ${await response.text()}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Live research returned unsupported mode/content type: ${contentType}`);
  }
  const text = await response.text();
  const chunks = text
    .split('\n\n')
    .filter((part) => part.startsWith('data: '))
    .map((part) => JSON.parse(part.slice(6)));
  const error = chunks.find((chunk) => chunk.type === 'error');
  if (error) throw new Error(`Live research stream error: ${error.message ?? JSON.stringify(error)}`);
  const result = chunks.findLast((chunk) => chunk.type === 'result')?.output;
  if (!result?.synthesizedAnswer?.trim()) throw new Error('Live research returned no synthesized answer');
  return result;
}

async function main() {
  await request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
  const created = await request('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Smoke project', product: 'Acme', competitors: ['Rival'], geography: 'Test market',
      decisionContext: 'Validate the project evidence loop', approvedSources: ['a.example'], blockedSources: [],
    }),
  });
  const projectId = created.data.project.id;
  const session = await request('/api/sessions', {
    method: 'POST', body: JSON.stringify({ title: 'Baseline smoke', projectId }),
  });
  const sessionId = session.data.session.id;
  await request(`/api/sessions/${sessionId}/messages`, {
    method: 'POST', body: JSON.stringify({ role: 'user', content: 'Build the baseline.' }),
  });
  const liveOutput = process.env.VERACITY_LIVE_RESEARCH === '1'
    ? await runLiveResearch(sessionId)
    : null;
  await request(`/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'assistant',
      content: liveOutput?.synthesizedAnswer ?? 'Stored smoke-test research response.',
      metadata: {
        type: 'intelligence',
        orchestratorOutput: liveOutput ?? {
          product: 'Acme', competitor: 'Rival', synthesizedAnswer: 'Stored smoke-test research response.',
          generatedAt: new Date().toISOString(),
          outputs: [{ sources: [
            { url: 'https://a.example/source' }, { url: 'https://b.example/source' },
          ] }],
          evidenceCoverage: [{ score: 0.8 }],
        },
      },
    }),
  });
  const overview = await request(`/api/projects/${projectId}/overview`);
  if (overview.data.conversationCount !== 1 || overview.data.researchRunCount !== 1) {
    throw new Error(`Unexpected overview counts: ${JSON.stringify(overview.data)}`);
  }
  if (!liveOutput && overview.data.latestSnapshot?.source_count !== 2) {
    throw new Error(`Unexpected source count: ${JSON.stringify(overview.data.latestSnapshot)}`);
  }
  const decisionResponse = await request('/api/decisions', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      title: 'Adopt the evidence loop',
      rationale: 'The stored research snapshot is available.',
      decision: 'accepted',
      reason: 'Smoke-test the project decision lifecycle',
      confidence: 0.8,
      sourceRecommendationKey: `smoke-${Date.now()}`,
      evidenceUrls: ['https://a.example/source'],
    }),
  });
  if (decisionResponse.decision?.project_id !== projectId) {
    throw new Error(`Decision was not linked to its project: ${JSON.stringify(decisionResponse)}`);
  }
  const projectDecisions = await request(`/api/decisions?projectId=${encodeURIComponent(projectId)}`);
  if (!projectDecisions.decisions?.some((decision) => decision.id === decisionResponse.decision.id)) {
    throw new Error(`Project decision was not listed: ${JSON.stringify(projectDecisions)}`);
  }
  const outcomeResponse = await request('/api/decisions', {
    method: 'POST',
    body: JSON.stringify({
      id: decisionResponse.decision.id,
      outcome: 'validated',
      note: 'Observed during the authenticated smoke journey',
    }),
  });
  if (outcomeResponse.decision?.outcome !== 'validated' || !outcomeResponse.decision?.outcome_note) {
    throw new Error(`Decision outcome was not recorded: ${JSON.stringify(outcomeResponse)}`);
  }
  await request(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Smoke project updated', product: 'Acme', competitors: ['Rival', 'Rival Two'],
      geography: 'Test market', decisionContext: 'Validate the updated loop',
      approvedSources: ['a.example'], blockedSources: ['avoid.example'],
    }),
  });
  await request(`/api/projects/${projectId}`, { method: 'DELETE' });
  process.stdout.write('Authenticated Market Project smoke test passed.\n');
}

try {
  await main();
} finally {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await pool.query('DELETE FROM users WHERE email = $1', [email]).catch(() => undefined);
    await pool.end();
  }
}
