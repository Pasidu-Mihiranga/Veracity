/**
 * MiroFish Live Agent
 *
 * Runs against the real MiroFish VPS at MIROFISH_LIVE_BASE_URL.
 * Unlike the standard mirofish agent there is NO synthetic fallback —
 * if the backend is unreachable the agent fails clearly rather than silently
 * substituting synthetic data or invented neutral values.
 *
 * This agent is opt-in only (not in ALL_AGENTS) and is dispatched via
 * runMirofishLiveAgent in orchestrator.ts when the user has toggled it.
 */

import {
  interviewLiveSwarm,
  isLiveSimulationReady,
  getLiveSimulationIdForProduct,
  getLiveBaseUrlOrLabel,
} from '../tools/mirofish-live';
import { searchTrends } from '../tools/serpapi';
import { generateHuggingFaceText, generateHuggingFaceJson } from './gemini';
import { getConfig } from '../config';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  SwarmScenarioOutput,
  AgentSource,
} from './types';
import { scoreToLevel } from './types';
import { normalizeScenarioDistribution } from '../swarm-scenario';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLiveMaxAgents(): number {
  return getConfig().MIROFISH_LIVE_MAX_AGENTS;
}

function getLiveInterviewTimeoutSec(): number {
  return getConfig().MIROFISH_LIVE_INTERVIEW_TIMEOUT_SEC;
}

function hasNonAscii(text: string | undefined): boolean {
  if (!text) return false;
  return /[^\x00-\x7F]/.test(text);
}

async function translateToEnglishIfNeeded(text: string | undefined): Promise<string | undefined> {
  if (!text) return text;
  if (!hasNonAscii(text)) return text;
  try {
    const translated = await generateHuggingFaceText(
      `Translate to fluent English. Keep meaning and be concise.\n\nText:\n${text}\n\nEnglish:`,
      { maxNewTokens: 120, temperature: 0.1 },
    );
    return translated.trim() || text;
  } catch {
    return text;
  }
}

async function formulateScenarioQuestion(
  query: string,
  product: string,
  competitor: string | undefined,
  priorContext: string | undefined,
): Promise<string> {
  const fallback = query.trim();
  const prompt = `You prepare questions for a synthetic stakeholder scenario panel.

Product: ${product}${competitor ? `\nCompetitor: ${competitor}` : ''}
${priorContext ? `Prior context:\n${priorContext}\n` : ''}
User query: "${query}"

Rephrase the user's query into ONE question suitable for polling a simulated swarm of market personas.
Critical rules:
- PRESERVE the original intent exactly — do NOT change the topic
- For descriptive questions use open-ended form: "From your perspective, what are the main [topic] for [subject]?"
- For future event questions use: "Will X happen by [horizon]?"
- Keep it specific and measurable

Reply with ONLY the rephrased question string, no JSON, no preamble.`;

  const result = await generateHuggingFaceText(prompt, { maxNewTokens: 160, temperature: 0.2 });
  return sanitiseInterviewQuestion(result, fallback);
}

function sanitiseInterviewQuestion(raw: string | undefined, fallback: string): string {
  const value = (raw ?? '').trim();
  if (!value) return fallback;

  // Remove control chars and common mojibake symbols that blow up token count.
  let cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[�]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If model returns extra leading junk, keep from first plausible sentence start.
  const starts = ['From your perspective', 'Will ', 'What ', 'How ', 'Why '];
  const idx = starts
    .map(s => cleaned.indexOf(s))
    .filter(i => i >= 0)
    .sort((a, b) => a - b)[0];
  if (typeof idx === 'number' && idx > 0) cleaned = cleaned.slice(idx).trim();

  // Hard cap prompt length to keep interview requests under Groq TPM.
  const MAX_CHARS = 220;
  if (cleaned.length > MAX_CHARS) cleaned = `${cleaned.slice(0, MAX_CHARS - 3).trim()}...`;

  return cleaned || fallback;
}

async function synthesiseScenario(params: {
  scenarioQuestion: string;
  product: string;
  swarmResponses: string[];
  swarmSize: number;
  trendSummary: string;
  priorContext: string | undefined;
}): Promise<{
  timeHorizon: string;
  distribution: { label: string; count: number }[];
  perspectives: { persona: string; weight: number; excerpt?: string }[];
  confidenceScore: number;
  scenarioObservations: string[];
  interpretation: string[];
  rationale: string;
}> {
  const responsesSample = params.swarmResponses.slice(0, 30).join('\n---\n');
  const prompt = `You are a market-intelligence analyst synthesising a configured panel of synthetic personas.

Scenario question: "${params.scenarioQuestion}"
Product/Subject: ${params.product}
Panel size: ${params.swarmSize} synthetic personas responded from MiroFish VPS
${params.priorContext ? `Prior research context:\n${params.priorContext}\n` : ''}
Trend baseline: ${params.trendSummary || 'unavailable'}

Live swarm responses (sample):
${responsesSample}

Summarise this synthetic panel. Stay true to what was asked and preserve disagreement.
Do not estimate real-world probability, market share, confidence intervals, or population representativeness.
Distribution counts MUST be non-negative integers and MUST sum exactly to ${params.swarmSize}.

Reply with ONLY valid JSON:
{
  "timeHorizon": "string",
  "distribution": [
    { "label": "high", "count": 0 },
    { "label": "moderate", "count": 0 },
    { "label": "neutral", "count": 0 },
    { "label": "low", "count": 0 }
  ],
  "perspectives": [
    { "persona": "string", "weight": -1.0 to 1.0, "excerpt": "short quote" }
  ],
  "confidenceScore": 0.0-1.0,
  "scenarioObservations": ["string"],
  "interpretation": ["string"],
  "rationale": "string"
}

All output must be in English.
If source snippets are non-English, translate them into English before writing observations, interpretation, or perspective excerpts.`;

  return generateHuggingFaceJson<any>(
    'You summarize synthetic stakeholder scenarios without claiming real-world prediction.',
    prompt,
    { maxNewTokens: 1400, temperature: 0.2 },
  );
}

// ── Main run ─────────────────────────────────────────────────────────────────

async function run(ctx: AgentContext): Promise<AgentOutput> {
  const { query, product, competitor, priorContext } = ctx;
  const sources: AgentSource[] = [];

  // Step 0: Resolve simulation_id from LIVE map
  const simulationId = getLiveSimulationIdForProduct(product);
  if (!simulationId) {
    throw new Error('No simulation configured. Add MIROFISH_LIVE_SIMULATIONS and prepare the scenario before enabling the live panel.');
  }

  // Step 1: Health check — fail fast if VPS is down
  const ready = await isLiveSimulationReady(simulationId).catch(() => false);
  if (!ready) {
    throw new Error(`MiroFish Live at ${getLiveBaseUrlOrLabel()} is unreachable or the configured scenario is not ready.`);
  }

  // Step 2: Formulate a faithful scenario question
  const scenarioQuestion = await formulateScenarioQuestion(
    query, product, competitor, priorContext,
  ).catch(() => sanitiseInterviewQuestion(query, query));

  // Step 3: Interview live swarm + trend baseline in parallel
  let swarmBundle: { responses: { response: string }[]; totalCount: number };
  let trendSummary = '';

  const [interviewResult, trendsResult] = await Promise.allSettled([
    interviewLiveSwarm(simulationId, scenarioQuestion, {
      timeoutSec: getLiveInterviewTimeoutSec(),
      maxAgents: getLiveMaxAgents(),
    }),
    // Keep trends non-blocking and lightweight in strict serial mode.
    searchTrends([product, competitor].filter(Boolean) as string[]),
  ]);

  if (interviewResult.status === 'rejected') {
    throw new Error(`Live scenario interviews failed: ${interviewResult.reason instanceof Error ? interviewResult.reason.message : String(interviewResult.reason)}`);
  }

  swarmBundle = interviewResult.value.data;

  sources.push({
    url: interviewResult.value.sourceUrl ?? `${getLiveBaseUrlOrLabel()}/api/simulation/interview`,
    title: `MiroFish Live VPS — ${swarmBundle.totalCount} synthetic personas interviewed`,
    timestamp: new Date().toISOString(),
    tool: 'mirofish-live',
  });

  if (trendsResult.status === 'fulfilled') {
    const td = trendsResult.value;
    trendSummary = Array.isArray(td.data)
      ? (td.data as Array<{ keyword?: string; value?: number }>)
          .slice(0, 3)
          .map(p => `${p.keyword ?? ''}: ${p.value ?? ''}`)
          .join(', ')
      : String(td.data ?? '');
    sources.push({
      url: td.sourceUrl ?? '',
      title: 'Google Trends baseline',
      timestamp: td.timestamp,
      tool: 'serpapi',
    });
  }

  if (!swarmBundle.totalCount) {
    throw new Error('The configured live scenario returned no persona responses.');
  }

  // Step 4: Synthesise responses as a labeled scenario, never a forecast.
  const swarmResponseTexts = swarmBundle.responses.map(r => r.response).filter(Boolean);
  const synthesised = await synthesiseScenario({
    scenarioQuestion,
    product,
    swarmResponses: swarmResponseTexts,
    swarmSize: swarmBundle.totalCount,
    trendSummary,
    priorContext,
  });

  const [observationsEn, interpretationEn, rationaleEn, perspectivesEn] = await Promise.all([
    Promise.all((synthesised.scenarioObservations ?? []).map(f => translateToEnglishIfNeeded(f))).then(arr => arr.filter(Boolean) as string[]),
    Promise.all((synthesised.interpretation ?? []).map(i => translateToEnglishIfNeeded(i))).then(arr => arr.filter(Boolean) as string[]),
    translateToEnglishIfNeeded(synthesised.rationale).then(v => v ?? synthesised.rationale),
    Promise.all((synthesised.perspectives ?? []).map(async s => ({
      ...s,
      persona: (await translateToEnglishIfNeeded(s.persona)) ?? s.persona,
      excerpt: await translateToEnglishIfNeeded(s.excerpt),
    }))),
  ]);

  const distribution = normalizeScenarioDistribution(synthesised.distribution, swarmBundle.totalCount);
  const distributionLimitation = distribution.length === 0
    ? ['Generated category counts did not reconcile to panel size, so the distribution chart is hidden.']
    : [];

  return {
    agentId: 'mirofish-live',
    domain: 'mirofish-live',
    artifactType: 'scenario-distribution',
    dataClass: 'synthetic',
    confidence: scoreToLevel(synthesised.confidenceScore),
    confidenceScore: synthesised.confidenceScore,
    facts: [],
    interpretation: interpretationEn,
    sources,
    generatedAt: new Date().toISOString(),
    question: scenarioQuestion,
    swarmSize: swarmBundle.totalCount,
    timeHorizon: synthesised.timeHorizon,
    distribution,
    perspectives: perspectivesEn ?? [],
    scenarioObservations: observationsEn,
    personaResponses: swarmBundle.responses.map((response, index) => ({
      persona: `Synthetic persona ${index + 1}`,
      response: response.response,
    })),
    rationale: rationaleEn ?? synthesised.rationale,
    methodology: `Configured MiroFish Live panel; ${swarmBundle.totalCount} synthetic personas interviewed and summarized by the configured language model.`,
    limitations: [
      'Synthetic personas are not a representative survey sample.',
      'Responses reflect model behavior and scenario inputs, not observed customer decisions.',
      'Use this output to discover objections and test assumptions, not to estimate market probability.',
      ...distributionLimitation,
    ],
  } as SwarmScenarioOutput;
}

export const mirofishLiveAgent: AgentConfig = {
  id: 'mirofish-live',
  name: 'Swarm Decision Lab (Live)',
  description: 'Configured synthetic stakeholder scenario served by MIROFISH_LIVE_BASE_URL. No fabricated fallback.',
  run,
};
