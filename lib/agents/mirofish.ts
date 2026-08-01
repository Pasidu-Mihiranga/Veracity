/**
 * MiroFish Scenario Agent — optional synthetic stakeholder panel
 *
 * Runs in parallel with the 6 research agents.  Calls a pre-prepared MiroFish
 * swarm simulation to stress-test a decision against synthetic perspectives.
 *
 * Fast path: uses /api/simulation/interview/all on an existing simulation.
 * Slow setup path: handled once out-of-band via scripts/mirofish-bootstrap.ts.
 */

import { interviewSwarm, isSimulationReady, getSimulationIdForProduct } from '../tools/mirofish';
import { searchTrends } from '../tools/serpapi';
import { generateHuggingFaceText, generateHuggingFaceJson } from './gemini';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  SwarmScenarioOutput,
  AgentSource,
} from './types';
import { scoreToLevel } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Turn the user's query into a swarm poll question that stays faithful to the original intent. */
async function formulateScenarioQuestion(
  query: string,
  product: string,
  competitor: string | undefined,
  priorContext: string | undefined,
): Promise<string> {
  const prompt = `You prepare questions for a synthetic stakeholder scenario panel.

Product: ${product}${competitor ? `\nCompetitor: ${competitor}` : ''}
${priorContext ? `Prior context:\n${priorContext}\n` : ''}
User query: "${query}"

Rephrase the user's query into ONE question suitable for polling a simulated swarm of market personas.
Critical rules:
- PRESERVE the original intent exactly — do NOT change the topic or introduce new subjects the user did not mention
- If the user asked about threats, competitors, or market landscape, ask the swarm about threats/competitors/landscape
- If the user asked about a specific company, region, or product, keep that exact focus
- Only use "Will X happen by [horizon]?" form if the user explicitly asked about a future event
- For descriptive questions (threats, competitors, positioning, strategy), use open-ended form: "From your perspective, what are the main [topic] for [subject]?"
- Include geographic or domain context from the original query (e.g. "in Sri Lanka", "in 2026")
- Keep it specific and measurable

Reply with ONLY the rephrased question string, no JSON, no preamble.`;

  const result = await generateHuggingFaceText(prompt, { maxNewTokens: 160, temperature: 0.2 });
  return result.trim() || query;
}

/** Summarize the configured synthetic panel without claiming survey validity. */
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

  const prompt = `You are a market-intelligence analyst synthesising a swarm of simulated market personas.

Scenario question: "${params.scenarioQuestion}"
Product/Subject: ${params.product}
Swarm size: ${params.swarmSize} personas responded
${params.priorContext ? `Prior research context:\n${params.priorContext}\n` : ''}
Trend baseline: ${params.trendSummary || 'unavailable'}

Swarm responses (sample):
${responsesSample}

Summarise this synthetic panel. Stay true to what was asked and preserve disagreement.
Do not estimate real-world probability, market share, confidence intervals, or population representativeness.
Distribution counts MUST be non-negative integers and MUST sum exactly to ${params.swarmSize}.

Reply with ONLY valid JSON matching this exact shape:
{
  "timeHorizon": "string",            // e.g. "2026", "next 12 months" — use context from the question
  "distribution": [                   // 4-6 buckets reflecting swarm sentiment on THIS specific question
    { "label": "high threat", "count": 0 },
    { "label": "moderate threat", "count": 0 },
    { "label": "neutral", "count": 0 },
    { "label": "low threat", "count": 0 }
  ],
  "perspectives": [                   // representative majority and dissenting perspectives
    { "persona": "string", "weight": -1.0 to 1.0, "excerpt": "short quote directly addressing the question" }
  ],
  "confidenceScore": 0.0-1.0,        // quality/completeness of the synthesis, not predictive confidence
  "scenarioObservations": ["string"], // 2-4 observations about this synthetic panel only
  "interpretation": ["string"],       // 2-3 analyst insights that directly address what was asked
  "rationale": "string"               // 2-3 sentence summary that directly answers the original question
}`;

  return generateHuggingFaceJson<any>('You summarize synthetic stakeholder scenarios without claiming real-world prediction.', prompt, {
    maxNewTokens: 1400,
    temperature: 0.2,
  });
}

async function run(ctx: AgentContext): Promise<AgentOutput> {
  const { query, product, competitor, priorContext } = ctx;
  const sources: AgentSource[] = [];
  let trendSummary = '';

  // Step 0: Resolve simulation_id for the active product
  const simulationId = getSimulationIdForProduct(product);

  // Step 1: Quick health check — does not block if backend is down
  const useRealSwarm = simulationId
    ? await isSimulationReady(simulationId).catch(() => false)
    : false;

  if (!simulationId) {
    throw new Error(`No prepared MiroFish scenario is configured for ${product}.`);
  }
  if (!useRealSwarm) {
    throw new Error(`The configured MiroFish scenario for ${product} is unavailable.`);
  }

  // Step 2: Formulate a faithful scenario question from the user query
  const scenarioQuestion = await formulateScenarioQuestion(
    query, product, competitor, priorContext,
  ).catch(() => query);

  // Step 3: Interview only the explicitly configured scenario. Provider
  // failures are errors; they must never be replaced with plausible role-play.
  const [interviewResult, trendsResult] = await Promise.all([
    interviewSwarm(simulationId, scenarioQuestion, { timeoutSec: 90 }),
    searchTrends([product, competitor].filter(Boolean) as string[]).catch(() => null),
  ]);
  const swarmBundle = interviewResult.data;

  if (trendsResult) {
    trendSummary = Array.isArray(trendsResult.data)
      ? (trendsResult.data as Array<{ keyword?: string; value?: number }>)
          .slice(0, 3)
          .map(p => `${p.keyword ?? ''}: ${p.value ?? ''}`)
          .join(', ')
      : String(trendsResult.data ?? '');
    sources.push({
      url: trendsResult.sourceUrl ?? '',
      title: 'Google Trends baseline',
      timestamp: trendsResult.timestamp,
      tool: 'serpapi',
    });
  }
  sources.push({
    url: interviewResult.sourceUrl ?? `${process.env.MIROFISH_BASE_URL ?? 'http://localhost:5001'}/api/simulation/interview/all`,
    title: `Configured MiroFish scenario — ${swarmBundle.totalCount} synthetic personas interviewed`,
    timestamp: new Date().toISOString(),
    tool: 'mirofish',
  });

  if (!swarmBundle.totalCount) {
    throw new Error('The configured MiroFish scenario returned no persona responses.');
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

  const { normalizeScenarioDistribution } = await import('@/lib/swarm-scenario');
  const distribution = normalizeScenarioDistribution(synthesised.distribution, swarmBundle.totalCount);
  const distributionLimitation = distribution.length === 0
    ? ['Generated category counts did not reconcile to panel size, so the distribution chart is hidden.']
    : [];

  return {
    agentId: 'mirofish',
    domain: 'mirofish',
    artifactType: 'scenario-distribution',
    dataClass: 'synthetic',
    confidence: scoreToLevel(synthesised.confidenceScore),
    confidenceScore: synthesised.confidenceScore,
    facts: [],
    interpretation: synthesised.interpretation,
    sources,
    generatedAt: new Date().toISOString(),
    question: scenarioQuestion,
    swarmSize: swarmBundle.totalCount,
    timeHorizon: synthesised.timeHorizon,
    distribution,
    perspectives: synthesised.perspectives ?? [],
    scenarioObservations: synthesised.scenarioObservations ?? [],
    personaResponses: swarmBundle.responses.map((response, index) => ({
      persona: response.persona?.name ?? `Synthetic persona ${index + 1}`,
      response: response.response,
    })),
    rationale: synthesised.rationale,
    methodology: `Configured MiroFish panel; ${swarmBundle.totalCount} synthetic personas interviewed independently and summarized by the configured language model.`,
    limitations: [
      'Synthetic personas are not a representative survey sample.',
      'Responses reflect model behavior and scenario inputs, not observed customer decisions.',
      'Use this output to discover objections and test assumptions, not to estimate market probability.',
      ...distributionLimitation,
    ],
  } as SwarmScenarioOutput;
}

// ── Export ────────────────────────────────────────────────────────────────────

export const mirofishAgent: AgentConfig = {
  id: 'mirofish',
  name: 'Swarm Decision Lab',
  description: 'Optional synthetic stakeholder scenario used to stress-test decisions and surface dissent',
  run,
};
