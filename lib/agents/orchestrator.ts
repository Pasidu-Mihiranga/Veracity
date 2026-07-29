import { marketTrendsAgent } from './market-trends';
import { competitiveAgent } from './competitive';
import { winLossAgent } from './win-loss';
import { pricingAgent } from './pricing';
import { positioningAgent } from './positioning';
import { adjacentAgent } from './adjacent';
import { executionEngineAgent } from './execution/execution-engine';
import { mirofishAgent } from './mirofish';
import { mirofishLiveAgent } from './mirofish-live';
import { isPlaceholderProduct } from './entity-url';
import { filterAndRankSources } from '@/lib/tools/source-validator';
import {
  applyAbstainToArtifacts,
  applyEntitySourceFilterToOutputs,
  applyOutputQualityGate,
  assessOutputQuality,
} from '@/lib/agents/output-quality';
import { bindEvidenceToSources } from '@/lib/agents/bind-evidence';
import {
  computeEvidenceCoverage,
  describeEvidenceCoverageGaps,
} from '@/lib/agents/evidence-coverage';
import { resolveAgentSet } from '@/lib/agents/adaptive-selection';
import { planMission } from '@/lib/agents/mission-planner';
import { shouldRunExecution as planExecution } from '@/lib/agents/execution-planner';
import { buildMissionSummary } from '@/lib/agents/mission-summary';
import { getWorkflowExecutor } from '@/lib/agents/workflow';
import {
  classifyQuery,
  isSelfComparisonQuery,
  isUnclearOrGibberishPrompt,
} from '@/lib/agents/classify';
import {
  sanitizeOutputsForSelfEvaluation,
  synthesize,
} from '@/lib/agents/synthesize';
import { generateMindMap } from '@/lib/agents/mind-map';
import { generateDirectAnswer } from '@/lib/agents/direct-answer';
import { EST_COST_PER_MODEL_CALL } from '@/lib/agents/cost-estimates';
import { logger } from '@/lib/logger';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  AgentRun,
  OrchestratorOutput,
  RunMetrics,
  ConversationMessage,
  ConfidenceLevel,
  IntelligenceDomain,
  ImageAttachment,
} from './types';
import { scoreToLevel } from './types';
import { extractEntitiesFromQuery } from '@/lib/agents/extract-entities';
import {
  filterHistoryForQueryScope,
  gateMemoryContext,
} from '@/lib/agents/query-scope';

export type { ExecutionTier } from '@/lib/agents/classify';
export { isUnclearOrGibberishPrompt } from '@/lib/agents/classify';

// Gemini model is resolved inside lib/agents/gemini.ts via GEMINI_MODEL env
// var (default: gemini-2.5-flash). We deliberately don't override per-call
// so that one env change switches every agent at once.

// ── All registered domain agents (6 fast Stage-1 agents) ────────────────────
const ALL_AGENTS: AgentConfig[] = [
  marketTrendsAgent,
  competitiveAgent,
  winLossAgent,
  pricingAgent,
  positioningAgent,
  adjacentAgent,
];
// mirofishAgent is opt-in and runs separately after the main result is sent
// (see runMirofishAgent below)

interface OrchestrateOptions {
  injectedContext?: string; // extra context injected into agents and synthesizer (e.g. feedback loop)
  forceExecution?: boolean; // force stage-2 execution even when classifier says false
  followUpMode?: 'full' | 'targeted'; // targeted runs only classifier-selected research domains
  selectedAgents?: string[]; // optional UI-selected domains from client
  forceFullSweep?: boolean; // bypass adaptive cost-aware selection
  /** Live status lines for the UI (e.g. “Reasoning…”, “Orchestrating…”). */
  onOrchestrationLog?: (message: string) => void | Promise<void>;
  /** Fired once mission plan + estimates are ready (pre fan-out). */
  onMissionSummary?: (summary: import('@/lib/agents/mission-summary').MissionSummary) => void | Promise<void>;
  /** Async cancel check between mission waves */
  shouldCancel?: () => boolean | Promise<boolean>;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
export async function orchestrate(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  options?: OrchestrateOptions,
): Promise<OrchestratorOutput> {
  const orchestrationStart = Date.now();
  const log = options?.onOrchestrationLog;

  // Step 1: Classify query and extract context  (1 model call)
  log?.('Reasoning about your query and selecting intelligence domains…');
  const classification = await classifyQuery(query, history, images, memoryContext);
  let modelCallCount = 1;

  const { product, competitor, productUrl, competitorUrl, intent, runExecution, tier } = classification;
  const queryEntities = extractEntitiesFromQuery(query);
  const scopedHistory = filterHistoryForQueryScope(history, queryEntities, 6);
  const scopedMemory = gateMemoryContext(query, memoryContext, queryEntities);
  log?.(`Classified product: ${product}${competitor ? ` vs ${competitor}` : ''} — Tier ${tier} (${intent})`);
  if (isPlaceholderProduct(product)) {
    log?.(`Warning: product name looks like a placeholder ("${product}") — search quality may be low.`);
  }

  const forceFull = options?.forceFullSweep === true;

  // Tier 0 Fast-Path Execution (<1.0s latency, 0 search agent runs)
  if (tier === 0 && !forceFull) {
    log?.('Tier 0 Direct Answer fast-path — generating instant response…');
    const directAnswer = await generateDirectAnswer(query, history, memoryContext);
    const latencyMs = Date.now() - orchestrationStart;
    const directConfidence: ConfidenceLevel =
      isUnclearOrGibberishPrompt(query) ? 'low' : 'medium';

    const hasNamedCompare =
      Boolean(product && competitor)
      && product !== 'Veracity AI'
      && !isPlaceholderProduct(product);
    const suggestedFollowUps = hasNamedCompare
      ? [
          `How do ${product} and ${competitor} compete in the market?`,
          `Compare ${product} and ${competitor} positioning and pricing.`,
          `What market trends matter for ${product}?`,
        ]
      : [
          'Name a product or competitor for a full research sweep.',
        ];

    return {
      query,
      product,
      competitor,
      agentRuns: [],
      outputs: [],
      synthesizedAnswer: directAnswer,
      topRecommendations: [],
      suggestedFollowUps,
      totalConfidence: directConfidence,
      assumptions: [],
      unknowns: hasNamedCompare ? ['No live evidence was retrieved on the direct-answer path.'] : [],
      evidenceLimitations: ['Tier 0 responses do not run live research agents.'],
      whatWouldChangeThis: ['Run a live research sweep for source-grounded verification.'],
      alternativeHypotheses: [],
      confidenceDrivers: {
        supports: ['The response is limited to a direct platform or conceptual answer.'],
        weakens: ['No live sources or specialist research agents were used.'],
      },
      generatedAt: new Date().toISOString(),
      selectionMeta: {
        mode: 'adaptive',
        savedVsFull: 6,
        researchIds: [],
        tier: 0,
        tierLabel: 'TIER 0 · DIRECT RESPONSE',
      },
      metrics: {
        totalLatencyMs: latencyMs,
        agentLatencies: {},
        estimatedCostUsd: EST_COST_PER_MODEL_CALL * 2,
        toolCallCount: 0,
        geminiCallCount: 2,
        agentCount: 0,
        completedAgentCount: 0,
        failedAgentCount: 0,
      },
    };
  }

  const minAgents = tier === 1 ? 1 : tier === 2 ? 2 : tier === 0 ? 0 : 3;

  const resolved = resolveAgentSet({
    uiSelected: options?.selectedAgents?.length
      ? options.selectedAgents
      : ALL_AGENTS.map((a) => a.id),
    classifierDomains: (classification.domains ?? []) as IntelligenceDomain[],
    forceFullSweep: forceFull,
    minAgents,
  });

  const execGate = planExecution({
    query,
    classifierRunExecution: runExecution,
    executionAgentSelected: resolved.executionSelected,
    forceExecution: options?.forceExecution,
  });
  const shouldRunExecution = execGate.run;
  if (!shouldRunExecution) {
    log?.(execGate.reason);
  }

  // Build prior context string for agents
  const priorContext = scopedHistory
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const selfEvaluationContext = isSelfComparisonQuery(query)
    ? 'Identity constraint: "Veracity AI" means this application. Public pages for same-name companies or veracityai.com are not evidence about this application; mark its unverified capabilities as unknown.'
    : undefined;
  const combinedPriorContext = [priorContext, selfEvaluationContext, options?.injectedContext]
    .filter(Boolean)
    .join('\n\n');

  const scratchpad = {
    productFacts: [] as string[],
    competitorFacts: [] as string[],
    openQuestions: [] as string[],
  };

  // Keep the user's original wording for search/synthesis (not only the LLM intent rewrite).
  const agentContext: AgentContext = {
    query,
    product,
    competitor,
    productUrl,
    competitorUrl,
    priorContext: combinedPriorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: scopedMemory,
    scratchpad,
  };

  // Step 2: Select research agents (cost-aware adaptive, or targeted follow-up)
  let researchIds = resolved.researchIds;
  if (options?.followUpMode === 'targeted') {
    const classifiedDomains = new Set(classification.domains ?? []);
    const targeted = researchIds.filter((id) => classifiedDomains.has(id));
    if (targeted.length > 0) researchIds = targeted;
  }

  // Dual-entity compares: auto-include pricing (free-tier: one extra agent, no manual toggle)
  const uiAllowsPricing =
    !options?.selectedAgents?.length ||
    options.selectedAgents.includes('pricing');
  if (
    competitor &&
    uiAllowsPricing &&
    !researchIds.includes('pricing') &&
    !isPlaceholderProduct(competitor)
  ) {
    researchIds = [...researchIds, 'pricing'];
  }

  const agentsToRun = ALL_AGENTS.filter((a) => researchIds.includes(a.id as IntelligenceDomain));
  const missionSteps = planMission([
    ...researchIds,
    ...(shouldRunExecution ? (['execution-engine'] as IntelligenceDomain[]) : []),
  ]);
  const missionSummary = buildMissionSummary({
    steps: missionSteps,
    product,
    competitor,
    includeExecution: shouldRunExecution,
  });
  await options?.onMissionSummary?.(missionSummary);
  log?.(
    `Mission plan: ${missionSummary.agentCount} agents · ~${missionSummary.estimatedSeconds}s · ~$${missionSummary.estimatedCostUsd}`,
  );
  for (const step of missionSummary.steps) {
    log?.(`• ${step.label}`);
  }
  if (resolved.mode === 'adaptive' && resolved.savedVsFull > 0) {
    log?.(`Adaptive selection saved ${resolved.savedVsFull} agent(s) vs full sweep`);
  }

  const sweepLabel =
    options?.followUpMode === 'targeted'
      ? 'targeted follow-up'
      : resolved.mode === 'adaptive'
        ? 'adaptive research sweep'
        : 'full research sweep';
  log?.(`Dividing work across ${agentsToRun.length} specialist agents (${sweepLabel})…`);
  log?.('Orchestrating parallel research — search, fetch, and extract…');

  // Step 3: Fan-out via WorkflowExecutor (CurrentExecutor today; LangGraph optional later)
  const researchOnlySteps = missionSteps.filter((s) => s.agentId !== 'execution-engine');
  const executor = getWorkflowExecutor();
  const waveResult = await executor.execute(
    {
      steps: researchOnlySteps,
      agents: agentsToRun,
      context: agentContext,
      scratchpad,
    },
    {
      onAgentUpdate: (run) => onAgentUpdate?.(run),
      onOrchestrationLog: log,
      shouldCancel: options?.shouldCancel,
    },
  );
  const agentRuns: AgentRun[] = [...waveResult.agentRuns];
  const outputs: AgentOutput[] = [...waveResult.outputs];
  const agentLatencies: Record<string, number> = { ...waveResult.agentLatencies };

  // Each research agent makes ~1 model call
  modelCallCount += agentsToRun.length;

  // ── Stage 2: Execution Engine (only if execution intent detected) ──────────
  if (shouldRunExecution) {
    if (options?.shouldCancel && (await options.shouldCancel())) {
      log?.('Cancel requested — skipping execution engine.');
      throw new Error('Job cancelled');
    }
    log?.('Execution intent detected — running execution engine for deliverables…');
    const execStart = Date.now();
    const execRun: AgentRun = {
      agentId: 'execution-engine',
      name: 'Execution Engine',
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    agentRuns.push(execRun);
    onAgentUpdate?.(execRun);

    try {
      const executionOutput = await executionEngineAgent.run({
        ...agentContext,
        researchOutputs: outputs,
        scratchpad,
      });
      agentLatencies['execution-engine'] = Date.now() - execStart;
      execRun.status = 'completed';
      execRun.completedAt = new Date().toISOString();
      outputs.push(executionOutput);
      modelCallCount += 3; // 3 sub-agents
    } catch (err) {
      agentLatencies['execution-engine'] = Date.now() - execStart;
      execRun.status = 'failed';
      execRun.error = err instanceof Error ? err.message : String(err);
    }
    onAgentUpdate?.(execRun);
  }

  // Step 4: Entity-filter sources before synthesis so the model sees less noise
  const filtered = applyEntitySourceFilterToOutputs(outputs, product, competitor, {
    productUrl,
    competitorUrl,
  });
  const researchOutputs = sanitizeOutputsForSelfEvaluation(query, filtered.outputs);

  // Early entity-quality peek (sources only) so mind map can prefer identity-first pillars
  const preGateSources = researchOutputs.flatMap((o) => o.sources);
  const preGateAvg = researchOutputs.length > 0
    ? researchOutputs.reduce((sum, o) => sum + o.confidenceScore, 0) / researchOutputs.length
    : 0.5;
  const earlyQuality = assessOutputQuality({
    product,
    competitor,
    productUrl,
    competitorUrl,
    sources: preGateSources,
    answer: '',
    recommendations: [],
    agentConfidenceAvg: preGateAvg,
  });

  // Step 5: Synthesise + generate mind map in parallel (2 model calls)
  log?.('Reasoning over findings — synthesizing answer and strategic mind map…');
  const [synthesisResult, mindMapResult] = await Promise.all([
    synthesize(
      query,
      researchOutputs,
      scopedHistory,
      images,
      scopedMemory,
      product,
      competitor,
      options?.injectedContext,
    ),
    generateMindMap(query, product, researchOutputs, {
      identityFirst: earlyQuality.shouldAbstainFromStrongClaims,
      productUrl,
      competitorUrl,
    }),
  ]);
  modelCallCount += 2; // synthesis + mind map

  // Append mind map to outputs if generated successfully
  if (mindMapResult) {
    researchOutputs.push(mindMapResult);
  }

  // Step 6: URL hygiene + entity relevance ranking
  for (const output of researchOutputs) {
    output.sources = filterAndRankSources(output.sources, 8, {
      productUrl,
      competitorUrl,
    });
  }

  // Step 7: Post-synthesis quality gate (anti-hallucination / abstain)
  const allSources = researchOutputs.flatMap((o) => o.sources);
  const agentConfidenceAvg = researchOutputs.length > 0
    ? researchOutputs.reduce((sum, o) => sum + o.confidenceScore, 0) / researchOutputs.length
    : 0.5;
  const guarded = applyOutputQualityGate({
    product,
    competitor,
    productUrl,
    competitorUrl,
    sources: allSources,
    answer: synthesisResult.answer,
    recommendations: synthesisResult.recommendations,
    followUps: synthesisResult.followUps,
    agentConfidenceAvg,
  });
  if (guarded.quality.shouldAbstainFromStrongClaims) {
    logger.warn('orchestrator.quality_abstain', {
      product,
      competitor,
      flags: guarded.quality.flags,
      matchRatio: guarded.quality.sourceMatchRatio,
      matched: guarded.quality.matchedSourceCount,
      total: guarded.quality.totalSourceCount,
    });
    log?.('Evidence quality check flagged thin or ambiguous grounding — softening claims and Stage-1 cards…');
  }

  let answer = guarded.answer;
  const followUps = [
    ...guarded.followUps,
    ...scratchpad.openQuestions,
  ].filter((value, index, all) => value.trim() && all.indexOf(value) === index).slice(0, 5);
  let totalConfidence = classification.entityResolutionConflict && guarded.totalConfidence === 'high'
    ? 'medium'
    : guarded.totalConfidence;
  // Soft-label Stage-1 / sanitize competitive signals / identity-first mind map
  const outputsFinal = applyAbstainToArtifacts(researchOutputs, {
    product,
    competitor,
    quality: guarded.quality,
  });

  // Step 7b: Bind recommendation evidence → source URLs (Evidence Trail)
  const recommendations = bindEvidenceToSources(
    guarded.recommendations,
    allSources,
    product,
    competitor,
    3,
    { productUrl, competitorUrl },
  );
  const unsupportedRecommendations = recommendations.filter(
    (recommendation) => recommendation.evidenceStatus === 'unsupported',
  );
  const unsupportedClaimCount = recommendations.reduce(
    (count, recommendation) =>
      count + (recommendation.evidenceBindings ?? [])
        .filter((binding) => binding.support === 'unsupported').length,
    0,
  );
  if (unsupportedClaimCount > 0) {
    if (!guarded.quality.flags.includes('unbound_claims')) {
      guarded.quality.flags.push('unbound_claims');
    }
    totalConfidence = recommendations.length > 0
      && unsupportedRecommendations.length === recommendations.length
      ? 'low'
      : totalConfidence === 'high' ? 'medium' : totalConfidence;
  }
  const bindingGaps = unsupportedClaimCount > 0
    ? [
        `${unsupportedClaimCount} evidence claim${unsupportedClaimCount === 1 ? ' has' : 's have'} no bound source URL.`,
      ]
    : [];

  // Step 7c: Evidence Coverage Radar scores
  const evidenceCoverage = computeEvidenceCoverage(
    outputsFinal,
    agentRuns,
    product,
    competitor,
  );
  const coverageGaps = describeEvidenceCoverageGaps(evidenceCoverage);
  const narratedGaps = [...bindingGaps, ...coverageGaps];
  if (narratedGaps.length > 0) {
    const limitationNarrative = `Evidence gaps: ${narratedGaps.slice(0, 3).join(' ')}`;
    if (!answer.includes('Evidence gaps:')) {
      answer = `${answer}\n\n${limitationNarrative}`;
    }
  }

  // Step 8: Build run metrics
  // Tool call count: each successful agent typically makes 2-4 tool calls.
  // We estimate based on completed agents (a rough heuristic — agents don't
  // currently report exact tool call counts back).
  const completedAgents = agentRuns.filter(r => r.status === 'completed').length;
  const failedAgents = agentRuns.filter(r => r.status === 'failed').length;
  const toolCallCount = completedAgents * 3; // conservative average

  const metrics: RunMetrics = {
    totalLatencyMs: Date.now() - orchestrationStart,
    agentLatencies,
    estimatedCostUsd: Number.parseFloat((modelCallCount * EST_COST_PER_MODEL_CALL).toFixed(5)),
    toolCallCount,
    geminiCallCount: modelCallCount,
    agentCount: agentRuns.length,
    completedAgentCount: completedAgents,
    failedAgentCount: failedAgents,
  };

  return {
    query,
    product,
    competitor,
    agentRuns,
    outputs: outputsFinal,
    synthesizedAnswer: answer,
    topRecommendations: recommendations,
    suggestedFollowUps: followUps,
    totalConfidence,
    assumptions: synthesisResult.assumptions,
    unknowns: synthesisResult.unknowns,
    evidenceLimitations: [
      ...synthesisResult.evidenceLimitations,
      ...bindingGaps,
      ...coverageGaps,
    ].filter((value, index, all) => all.indexOf(value) === index),
    whatWouldChangeThis: synthesisResult.whatWouldChangeThis,
    alternativeHypotheses: synthesisResult.alternativeHypotheses,
    confidenceDrivers: {
      supports: synthesisResult.confidenceDrivers.supports,
      weakens: [
        ...synthesisResult.confidenceDrivers.weakens,
        ...(classification.entityResolutionConflict
          ? ['LLM and deterministic entity extraction disagreed; confidence was capped.']
          : []),
      ],
    },
    generatedAt: new Date().toISOString(),
    metrics,
    quality: guarded.quality,
    evidenceCoverage,
    missionPlan: {
      steps: missionSteps.map((s) => ({
        id: s.id,
        label: s.label,
        agentId: s.agentId,
        dependsOn: s.dependsOn,
        rationale: s.rationale,
      })),
    },
    selectionMeta: {
      mode: resolved.mode,
      savedVsFull: resolved.savedVsFull,
      researchIds: researchIds as string[],
    },
  };
}

// ── Optional MiroFish agent — runs independently after main result ────────────
// Called by the route handler only when the user has toggled "MiroFish Forecast".
// This keeps orchestrate() fast (6 agents) while MiroFish completes in the
// background with the stream still open.
export async function runMirofishAgent(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  onOrchestrationLog?: (message: string) => void,
): Promise<AgentOutput | null> {
  // Re-classify so mirofish has the same product context as the main run
  onOrchestrationLog?.('MiroFish: refreshing product context…');
  const classification = await classifyQuery(query, history, images, memoryContext);
  const { product, competitor, productUrl, competitorUrl, intent } = classification;

  const priorContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const agentContext: AgentContext = {
    query: intent,
    product,
    competitor,
    productUrl,
    competitorUrl,
    priorContext: priorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: memoryContext || undefined,
  };

  const run: AgentRun = { agentId: mirofishAgent.id, name: mirofishAgent.name, status: 'running', startedAt: new Date().toISOString() };
  onAgentUpdate?.(run);

  try {
    onOrchestrationLog?.('MiroFish: running forecast agent…');
    const output = await mirofishAgent.run(agentContext);
    onAgentUpdate?.({ ...run, status: 'completed', completedAt: new Date().toISOString() });
    return output;
  } catch (err) {
    onAgentUpdate?.({ ...run, status: 'failed', completedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ── MiroFish Live agent — real VPS only, no synthetic fallback ────────────────
// Dispatched only when the user has toggled "MiroFish Live" in the UI.
export async function runMirofishLiveAgent(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  onOrchestrationLog?: (message: string) => void,
): Promise<AgentOutput | null> {
  const isUnavailableLiveOutput = (output: AgentOutput): boolean => {
    const forecastLike = output as AgentOutput & { rationale?: string; swarmSize?: number };
    const interpretation = Array.isArray(output.interpretation) ? output.interpretation : [];
    const rationale = typeof forecastLike.rationale === 'string' ? forecastLike.rationale : '';
    const swarmSize = typeof forecastLike.swarmSize === 'number' ? forecastLike.swarmSize : undefined;
    return (
      interpretation.some(line => /mirofish live unavailable|live swarm unavailable|live swarm interviews failed/i.test(line)) ||
      /unavailable|interviews failed|no responses/i.test(rationale) ||
      swarmSize === 0
    );
  };

  onOrchestrationLog?.('MiroFish Live: connecting via MIROFISH_LIVE_BASE_URL…');
  const classification = await classifyQuery(query, history, images, memoryContext);
  const { product, competitor, productUrl, competitorUrl, intent } = classification;

  const priorContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
    .join('\n');

  const agentContext: AgentContext = {
    query: intent,
    product,
    competitor,
    productUrl,
    competitorUrl,
    priorContext: priorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: memoryContext || undefined,
  };

  const liveRun: AgentRun = {
    agentId: mirofishLiveAgent.id,
    name: mirofishLiveAgent.name,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  onAgentUpdate?.(liveRun);

  try {
    onOrchestrationLog?.('MiroFish Live: interviewing live swarm…');
    const output = await mirofishLiveAgent.run(agentContext);
    const failed = isUnavailableLiveOutput(output);
    onAgentUpdate?.({
      ...liveRun,
      status: failed ? 'failed' : 'completed',
      completedAt: new Date().toISOString(),
      ...(failed ? { error: (output as AgentOutput & { rationale?: string }).rationale ?? 'Live swarm unavailable' } : {}),
    });
    return output;
  } catch (err) {
    onAgentUpdate?.({
      ...liveRun,
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
