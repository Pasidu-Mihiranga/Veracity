/**
 * MiroFish swarm-simulation tool
 *
 * MiroFish (https://github.com/666ghj/MiroFish) is a self-hosted swarm
 * intelligence prediction engine.  It runs a Flask backend on port 5001.
 *
 * Preferred hot path: POST /api/simulation/interview/all against a
 * **pre-prepared** simulation (local `mirofish-service` and full MiroFish).
 * Per-agent /config + /interview is used only as a fallback for older hosts.
 *
 * Configuration (add to .env.local):
 *   MIROFISH_BASE_URL=http://localhost:5001
 *   MIROFISH_SIMULATIONS={"vector agents":"sim_xxx"}
 */

import { getCached, setCache } from '../supabase';
import type { ToolResult } from './types';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = (process.env.MIROFISH_BASE_URL ?? 'http://localhost:5001').replace(/\/$/, '');

let SIMULATIONS_MAP: Record<string, string> = {};
try {
  SIMULATIONS_MAP = JSON.parse(process.env.MIROFISH_SIMULATIONS ?? '{}');
} catch {
  // malformed JSON — silently fall back to empty map
}

// Cache swarm interview responses for 1 hour (forecasts are stable short-term)
// (TTL is enforced by the shared cache layer.)


// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwarmInterviewResponse {
  agent_id: number;
  response: string;
  platform: 'twitter' | 'reddit';
  /** Optional persona metadata when returned by MiroFish */
  persona?: { name?: string; role?: string; sentiment?: string };
}

export interface SwarmInterviewBundle {
  simulationId: string;
  prompt: string;
  responses: SwarmInterviewResponse[];
  totalCount: number;
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Look up the simulation_id for a product (case-insensitive, fuzzy).
 *
 * Resolution order:
 * 1. Exact lowercase match  ("vector agents" → "sim_xxx")
 * 2. Partial/contains match — the configured key is a substring of the
 *    product string, or vice-versa.  Handles Gemini returning "Vector Agents
 *    (Lilian)", "Lilian by Vector Agents", "the product", etc.
 * 3. First configured simulation (catch-all when only one sim exists).
 *
 * Returns undefined only when SIMULATIONS_MAP is empty.
 */
export function getSimulationIdForProduct(product: string): string | undefined {
  if (!product) return undefined;

  const keys = Object.keys(SIMULATIONS_MAP);
  if (keys.length === 0) return undefined;

  const needle = product.toLowerCase().trim();

  // 1. Exact match
  if (SIMULATIONS_MAP[needle]) return SIMULATIONS_MAP[needle];

  // 2. Fuzzy: key is substring of needle, or needle is substring of key
  const fuzzy = keys.find(k => needle.includes(k) || k.includes(needle));
  if (fuzzy) return SIMULATIONS_MAP[fuzzy];

  // 3. Single-sim fallback — if there's only one bootstrapped sim, use it
  const uniqueIds = [...new Set(Object.values(SIMULATIONS_MAP))];
  if (uniqueIds.length === 1) return uniqueIds[0];
  if (keys.length === 1) return SIMULATIONS_MAP[keys[0]];

  return undefined;
}

/**
 * Health-check: is the simulation in a state that accepts /interview requests?
 * Times out after 5 s so a dead backend can't stall the orchestrator.
 */
export async function isSimulationReady(simulationId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/simulation/${encodeURIComponent(simulationId)}/run-status`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const json = await res.json() as { data?: { status?: string }; status?: string };
    const status = json?.data?.status ?? json?.status ?? '';
    // Accept 'completed', 'waiting_command', 'finished', 'running' — anything
    // that means the simulation env is alive and agents can be interviewed
    return ['completed', 'waiting_command', 'finished', 'running'].includes(status);
  } catch {
    return false;
  }
}

function normalizeInterviewEntries(
  raw: unknown,
  preferredPlatform: 'twitter' | 'reddit',
): SwarmInterviewResponse[] {
  const out: SwarmInterviewResponse[] = [];

  const pushOne = (item: Record<string, unknown>, fallbackId: number) => {
    const response = String(item.response ?? item.result ?? item.content ?? '').trim();
    if (!response) return;
    const platformRaw = String(item.platform ?? preferredPlatform);
    const platform: 'twitter' | 'reddit' = platformRaw === 'twitter' ? 'twitter' : 'reddit';
    const agentId = typeof item.agent_id === 'number'
      ? item.agent_id
      : Number(item.agent_id ?? fallbackId);
    out.push({
      agent_id: Number.isFinite(agentId) ? agentId : fallbackId,
      response,
      platform,
      persona: typeof item.persona === 'object' && item.persona
        ? { name: String((item.persona as { name?: string }).name ?? item.persona) }
        : typeof item.persona === 'string'
          ? { name: item.persona, role: String(item.role ?? '') }
          : undefined,
    });
  };

  if (Array.isArray(raw)) {
    raw.forEach((item, idx) => {
      if (item && typeof item === 'object') pushOne(item as Record<string, unknown>, idx);
    });
    return out;
  }

  if (raw && typeof raw === 'object') {
    Object.values(raw as Record<string, unknown>).forEach((item, idx) => {
      if (item && typeof item === 'object') pushOne(item as Record<string, unknown>, idx);
    });
  }

  return out;
}

/**
 * Preferred path for local mirofish-service and modern MiroFish hosts.
 */
async function interviewAllAgents(
  simulationId: string,
  prompt: string,
  platform: 'twitter' | 'reddit',
  timeoutSec: number,
): Promise<SwarmInterviewResponse[]> {
  const res = await fetch(`${BASE_URL}/api/simulation/interview/all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      simulation_id: simulationId,
      prompt,
      platform,
      timeout: timeoutSec,
    }),
    signal: AbortSignal.timeout((timeoutSec + 15) * 1_000),
  });
  if (!res.ok) throw new Error(`interview/all failed: HTTP ${res.status}`);

  const json = await res.json() as {
    success?: boolean;
    error?: string;
    data?: {
      responses?: unknown;
      result?: { results?: unknown; responses?: unknown };
      results?: unknown;
    };
  };
  if (json.success === false) throw new Error(json.error ?? 'interview/all failed');

  const payload =
    json.data?.responses
    ?? json.data?.result?.results
    ?? json.data?.result?.responses
    ?? json.data?.results
    ?? [];

  return normalizeInterviewEntries(payload, platform);
}

async function fetchAgentIds(simulationId: string, maxAgents = 6): Promise<number[]> {
  const res = await fetch(
    `${BASE_URL}/api/simulation/${encodeURIComponent(simulationId)}/config`,
    { signal: AbortSignal.timeout(5_000) },
  );
  if (!res.ok) throw new Error(`Could not fetch sim config: ${res.status}`);
  const json = await res.json() as { data?: { agent_configs?: { agent_id: number }[] } };
  const all = (json.data?.agent_configs ?? []).map(a => a.agent_id);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, maxAgents);
}

async function interviewSingleAgent(
  simulationId: string,
  agentId: number,
  prompt: string,
  platform: 'reddit' | 'twitter',
  timeoutSec: number,
): Promise<SwarmInterviewResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/simulation/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulation_id: simulationId, agent_id: agentId, prompt, platform, timeout: timeoutSec }),
      signal: AbortSignal.timeout((timeoutSec + 5) * 1_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; data?: { result?: string; response?: string } };
    if (!json.success) return null;
    const response = json.data?.result ?? json.data?.response ?? '';
    if (!response) return null;
    return { agent_id: agentId, response, platform };
  } catch {
    return null;
  }
}

async function interviewPerAgentFallback(
  simulationId: string,
  prompt: string,
  platform: 'twitter' | 'reddit',
  timeoutSec: number,
): Promise<SwarmInterviewResponse[]> {
  const agentIds = await fetchAgentIds(simulationId, 5);
  if (agentIds.length === 0) return [];

  const responses: SwarmInterviewResponse[] = [];
  for (const agentId of agentIds) {
    const resp = await interviewSingleAgent(simulationId, agentId, prompt, platform, timeoutSec);
    if (resp) responses.push(resp);
    if (agentId !== agentIds[agentIds.length - 1]) {
      await new Promise(r => setTimeout(r, 4_500));
    }
  }
  return responses;
}

/**
 * Poll simulated personas with *prompt* and return aggregated responses.
 * Uses /interview/all first (local Gemini MiroFish), then per-agent fallback.
 */
export async function interviewSwarm(
  simulationId: string,
  prompt: string,
  options: { platform?: 'twitter' | 'reddit'; timeoutSec?: number } = {},
): Promise<ToolResult<SwarmInterviewBundle>> {
  const cacheKey = `mirofish:interview:${simulationId}:${prompt}`;

  try {
    const cached = await getCached('mirofish_interview', cacheKey);
    if (cached) {
      return { ...(cached as ToolResult<SwarmInterviewBundle>), cached: true };
    }
  } catch {
    // cache miss is fine — continue
  }

  const platform = options.platform ?? 'reddit';
  const timeoutSec = options.timeoutSec ?? 120;

  let responses: SwarmInterviewResponse[] = [];
  let usedAll = false;
  try {
    responses = await interviewAllAgents(simulationId, prompt, platform, timeoutSec);
    usedAll = responses.length > 0;
  } catch {
    responses = [];
  }

  if (responses.length === 0) {
    responses = await interviewPerAgentFallback(simulationId, prompt, platform, options.timeoutSec ?? 45);
  }

  if (responses.length === 0) {
    throw new Error('All agent interviews failed — check MiroFish logs / Gemini quota');
  }

  // Cap for synthesis cost on free tier
  const capped = responses.slice(0, 12);

  const bundle: SwarmInterviewBundle = {
    simulationId,
    prompt,
    responses: capped,
    totalCount: capped.length,
  };

  const confidence = Math.min(0.9, capped.length >= 4 ? 0.72 : capped.length >= 2 ? 0.55 : 0.35);

  const result: ToolResult<SwarmInterviewBundle> = {
    data: bundle,
    source: 'MiroFish Swarm',
    sourceUrl: usedAll
      ? `${BASE_URL}/api/simulation/interview/all`
      : `${BASE_URL}/api/simulation/interview`,
    timestamp: new Date().toISOString(),
    confidence,
    cached: false,
  };

  try {
    await setCache('mirofish_interview', cacheKey, result);
  } catch {
    // non-fatal
  }

  return result;
}
