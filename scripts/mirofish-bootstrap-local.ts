#!/usr/bin/env tsx
/**
 * Bootstrap a simulation against the local Gemini MiroFish service
 * (`mirofish-service/server.py`).
 *
 * Unlike mirofish-bootstrap-auto.ts (full MiroFish ontology API), this uses:
 *   POST /api/graph/build  (multipart: file)
 *   → create → prepare → start → print env lines
 *
 * Usage:
 *   MIROFISH_BASE_URL=http://localhost:5001 \
 *     npx tsx scripts/mirofish-bootstrap-local.ts "Vector Agents" scripts/seeds/vector-agents.txt
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = (process.env.MIROFISH_BASE_URL ?? 'http://localhost:5001').replace(/\/$/, '');

const productName = process.argv[2]?.trim();
let seedFilePath = process.argv[3]?.trim();

if (!productName || !seedFilePath) {
  console.error('Usage: npx tsx scripts/mirofish-bootstrap-local.ts "Product Name" seed-file.txt');
  process.exit(1);
}

seedFilePath = seedFilePath.replace(/^~/, process.env.HOME ?? '');
if (!fs.existsSync(seedFilePath)) {
  console.error(`File not found: ${seedFilePath}`);
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function apiPost(p: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { success: boolean; data?: Record<string, unknown>; error?: string };
  if (!json.success) throw new Error(`${p} failed: ${json.error ?? 'unknown'}`);
  return json.data ?? {};
}

async function apiGet(p: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${p}`);
  const json = await res.json() as { success: boolean; data?: Record<string, unknown>; error?: string };
  if (!json.success) throw new Error(`${p} failed: ${json.error ?? 'unknown'}`);
  return json.data ?? {};
}

async function main() {
  console.log(`\n🐟 Local MiroFish Bootstrap — ${productName}\nBackend: ${BASE_URL}\n`);

  try {
    const health = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!health.ok) throw new Error(`health ${health.status}`);
  } catch {
    console.error(`Cannot reach ${BASE_URL}. Start with: npm run mirofish`);
    process.exit(1);
  }

  // 1. Build graph from seed (multipart form — local service API)
  console.log('1️⃣  Uploading seed + building graph…');
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(seedFilePath)]), path.basename(seedFilePath));
  const buildRes = await fetch(`${BASE_URL}/api/graph/build`, { method: 'POST', body: formData });
  const buildJson = await buildRes.json() as {
    success: boolean;
    data?: { task_id: string; graph_id: string; project_id: string };
    error?: string;
  };
  if (!buildJson.success || !buildJson.data) {
    throw new Error(`Graph build failed: ${buildJson.error ?? 'unknown'}`);
  }
  const { task_id: taskId, graph_id: graphId, project_id: projectId } = buildJson.data;
  console.log(`  project=${projectId}  graph=${graphId}  task=${taskId}`);

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const t = await apiGet(`/api/graph/task/${taskId}`);
    if (t.status === 'completed') break;
    if (t.status === 'failed') throw new Error(`Graph build failed: ${t.error ?? 'unknown'}`);
    process.stdout.write('.');
    await sleep(2_000);
  }
  console.log('\n  ✅ Graph ready');

  // 2. Create simulation
  console.log('\n2️⃣  Creating simulation…');
  const created = await apiPost('/api/simulation/create', {
    project_id: projectId,
    graph_id: graphId,
  });
  const simulationId = String(created.simulation_id ?? '');
  if (!simulationId) throw new Error('No simulation_id returned');
  console.log(`  ✅ ${simulationId}`);

  // 3. Prepare personas
  console.log('\n3️⃣  Preparing personas (Gemini)…');
  const prepared = await apiPost('/api/simulation/prepare', { simulation_id: simulationId });
  const prepTaskId = prepared.task_id ? String(prepared.task_id) : '';
  if (prepTaskId) {
    const prepDeadline = Date.now() + 300_000;
    while (Date.now() < prepDeadline) {
      const s = await apiPost('/api/simulation/prepare/status', { task_id: prepTaskId });
      if (s.status === 'completed') break;
      if (s.status === 'failed') throw new Error(`Prepare failed: ${s.error ?? 'unknown'}`);
      process.stdout.write('.');
      await sleep(3_000);
    }
  }
  console.log('\n  ✅ Personas ready');

  // 4. Start
  console.log('\n4️⃣  Starting simulation…');
  await apiPost('/api/simulation/start', { simulation_id: simulationId });
  console.log('  ✅ Status: waiting_command');

  const envKey = productName.toLowerCase().trim();
  const simMap: Record<string, string> = {
    [envKey]: simulationId,
    lilian: simulationId,
    'the product': simulationId,
    vectoragents: simulationId,
    vector: simulationId,
    'ai sdr': simulationId,
    'vector agents': simulationId,
  };

  console.log('\n' + '='.repeat(60));
  console.log('✅  Done!\n');
  console.log(`Simulation ID: ${simulationId}`);
  console.log('\nAdd these to .env (or .env.local) and restart Next.js:\n');
  console.log(`MIROFISH_BASE_URL=${BASE_URL}`);
  console.log(`MIROFISH_SIMULATIONS=${JSON.stringify(simMap)}`);
  console.log(`MIROFISH_LIVE_BASE_URL=${BASE_URL}`);
  console.log(`MIROFISH_LIVE_SIMULATIONS=${JSON.stringify(simMap)}`);
  console.log(`MIROFISH_LIVE_DEFAULT_SIMULATION_ID=${simulationId}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error('\n❌ Bootstrap failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
