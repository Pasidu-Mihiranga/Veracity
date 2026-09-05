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
import { bindEvidenceToSources, bindProseToSources } from '@/lib/agents/bind-evidence';
import {
  computeEvidenceCoverage,
  describeEvidenceCoverageGaps,
} from '@/lib/agents/evidence-coverage';
import { resolveAgentSet } from '@/lib/agents/adaptive-selection';
import { planMission } from '@/lib/agents/mission-planner';
import {
  domainsForMission,
  MISSION_TEMPLATES,
} from '@/lib/agents/research-intents';
import {
  buildComparisonContract,
  buildComparisonExecutiveAnswer,
  buildDiligenceExecutiveAnswer,
  buildDueDiligencePack,
  buildInvestigationPlan,
  collectPriorOpenQuestions,
  domainsFromInvestigationQuery,
  planAdaptiveReplan,
  sanitizeDiligenceRecommendations,
} from '@/lib/agents/research-workflows';
import {
  buildBoardPack,
  buildDecisionFrame,
  buildExecutiveContent,
  rankRecommendations,
} from '@/lib/agents/decision-support';
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

function mergeDeepenedOutput(
  existing: AgentOutput,
  deepened: AgentOutput,
): AgentOutput {
  const merged = Object.assign({}, existing, deepened) as AgentOutput;
  const confidenceScore = Math.max(existing.confidenceScore, deepened.confidenceScore);
  merged.facts = [...new Set([...existing.facts, ...deepened.facts])].slice(0, 8);
  merged.interpretation = [...new Set([
    ...existing.interpretation,
    ...deepened.interpretation,
  ])].slice(0, 6);
  merged.sources = [...new Map(
    [...existing.sources, ...deepened.sources].map((source) => [source.url, source]),
  ).values()];
  merged.openQuestions = [...new Set([
    ...(existing.openQuestions ?? []),
    ...(deepened.openQuestions ?? []),
  ])].slice(0, 6);
  merged.confidenceScore = confidenceScore;
  merged.confidence = scoreToLevel(confidenceScore);
  return merged;
}
// mirofishAgent is opt-in and runs separately after the main result is sent
// (see runMirofishAgent below)

interface OrchestrateOptions {
  injectedContext?: string; // extra context injected into agents and synthesizer (e.g. feedback loop)
  /**
   * Rendered evidence pack for the project, with span ids agents can cite.
   *
   * Supplied by the caller rather than fetched here, because the orchestrator
   * does not know which project a run belongs to — only the request path does.
   */
  evidencePackBlock?: string;
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

  const {
    product,
    competitor,
    productUrl,
    competitorUrl,
    entities,
    intent,
    intentClass,
    runExecution,
    tier,
  } = classification;
  const isInvestigationFollowUp =
    domainsFromInvestigationQuery(query).length > 0
    || /\b(continue|follow up|deepen|investigate further|resolve (?:this|these)|next probe)\b/i.test(query);
  const queryEntities = extractEntitiesFromQuery(query);
  const scopeEntities =
    isInvestigationFollowUp && !queryEntities.product && product !== 'unknown product'
      ? { product, competitor }
      : queryEntities;
  const scopedHistory = filterHistoryForQueryScope(history, scopeEntities, 6);
  const scopedMemory = gateMemoryContext(query, memoryContext, scopeEntities);
  const priorOpenQuestions = collectPriorOpenQuestions(
    isInvestigationFollowUp ? history.slice(-6) : scopedHistory,
    6,
  );
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
      researchIntent: intentClass,
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

  const preserveNarrowMission =
    intentClass === 'market' && (classification.domains?.length ?? 0) === 1;
  const minAgents = preserveNarrowMission
    ? 1
    : tier === 1 ? 1 : tier === 2 ? 2 : tier === 0 ? 0 : 3;

  const missionDomains = domainsForMission({
    intent: intentClass,
    classifiedDomains: (classification.domains ?? []) as IntelligenceDomain[],
    tier,
  });
  const resolved = resolveAgentSet({
    uiSelected: options?.selectedAgents?.length
      ? options.selectedAgents
      : ALL_AGENTS.map((a) => a.id),
    classifierDomains: missionDomains,
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
  const priorInvestigationContext = priorOpenQuestions.length > 0
    ? `Unresolved questions from the prior investigation:\n${priorOpenQuestions.map((question) => `- ${question}`).join('\n')}`
    : undefined;
  const combinedPriorContext = [
    priorContext,
    priorInvestigationContext,
    selfEvaluationContext,
    options?.injectedContext,
  ]
    .filter(Boolean)
    .join('\n\n');

  const scratchpad = {
    productFacts: [] as string[],
    competitorFacts: [] as string[],
    openQuestions: [...priorOpenQuestions],
  };

  // Keep the user's original wording for search/synthesis (not only the LLM intent rewrite).
  const agentContext: AgentContext = {
    query,
    product,
    competitor,
    productUrl,
    competitorUrl,
    entities,
    industryVertical: classification.industryVertical,
    researchIntent: intentClass,
    priorContext: combinedPriorContext || undefined,
    images: images.length > 0 ? images : undefined,
    memoryContext: scopedMemory,
    // Every research agent gets the same pack, so a citation means the same
    // thing whichever agent produced it.
    evidencePackBlock: options?.evidencePackBlock,
    scratchpad,
  };

  // Step 2: Select research agents (cost-aware adaptive, or targeted follow-up)
  let researchIds = resolved.researchIds;
  if (options?.followUpMode === 'targeted') {
    const probeDomains = domainsFromInvestigationQuery(query);
    const classifiedDomains = new Set(classification.domains ?? []);
    const targeted = probeDomains.length > 0
      ? probeDomains
      : researchIds.filter((id) => classifiedDomains.has(id));
    if (targeted.length > 0) researchIds = targeted;
  }

  // Dual-entity compares: auto-include pricing (free-tier: one extra agent, no manual toggle)
  const uiAllowsPricing =
    !options?.selectedAgents?.length ||
    options.selectedAgents.includes('pricing');
  if (
    competitor &&
    options?.followUpMode !== 'targeted' &&
    uiAllowsPricing &&
    !researchIds.includes('pricing') &&
    !isPlaceholderProduct(competitor)
  ) {
    researchIds = [...researchIds, 'pricing'];
  }

  const agentsToRun = ALL_AGENTS.filter((a) => researchIds.includes(a.id as IntelligenceDomain));
  let missionSteps = planMission([
    ...researchIds,
    ...(shouldRunExecution ? (['execution-engine'] as IntelligenceDomain[]) : []),
  ], intentClass);
  const missionSummary = buildMissionSummary({
    steps: missionSteps,
    product,
    competitor,
    includeExecution: shouldRunExecution,
    intent: intentClass,
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

  // Step 3b: Quality-adaptive second pass. Add at most two previously unselected
  // collectors; otherwise preserve gaps as targeted investigation probes.
  const adaptiveReplan = planAdaptiveReplan({
    outputs,
    selectedDomains: researchIds,
    availableDomains: ALL_AGENTS.map((agent) => agent.id),
    openQuestions: scratchpad.openQuestions,
    intent: intentClass,
    maxAddedDomains: tier === 1 || options?.followUpMode === 'targeted' ? 0 : 2,
  });
  if (adaptiveReplan.triggered) {
    log?.(`Adaptive quality check: ${adaptiveReplan.reasons[0]}`);
  }
  if (adaptiveReplan.addedDomains.length > 0) {
    log?.(
      `Evidence is thin — adding targeted collector${adaptiveReplan.addedDomains.length > 1 ? 's' : ''}: ${adaptiveReplan.addedDomains.join(', ')}`,
    );
    const addedSteps = planMission(adaptiveReplan.addedDomains, intentClass);
    const addedAgents = ALL_AGENTS.filter((agent) =>
      adaptiveReplan.addedDomains.includes(agent.id),
    );
    const addedResult = await executor.execute(
      {
        steps: addedSteps,
        agents: addedAgents,
        context: {
          ...agentContext,
          priorContext: [
            agentContext.priorContext,
            `Adaptive follow-up reasons:\n${adaptiveReplan.reasons.join('\n')}`,
          ].filter(Boolean).join('\n\n'),
        },
        scratchpad,
      },
      {
        onAgentUpdate: (run) => onAgentUpdate?.(run),
        onOrchestrationLog: log,
        shouldCancel: options?.shouldCancel,
      },
    );
    agentRuns.push(...addedResult.agentRuns);
    outputs.push(...addedResult.outputs);
    Object.assign(agentLatencies, addedResult.agentLatencies);
    modelCallCount += addedAgents.length;
    researchIds = [...new Set([...researchIds, ...adaptiveReplan.addedDomains])];
    missionSteps = [
      ...missionSteps,
      ...addedSteps.filter((step) => !missionSteps.some((existing) => existing.id === step.id)),
    ].map((step) =>
      step.agentId === 'execution-engine'
        ? {
            ...step,
            dependsOn: [...new Set([
              ...step.dependsOn,
              ...addedSteps.map((added) => added.id),
            ])],
          }
        : step,
    );
  }
  const deepenDomains =
    tier >= 2 && options?.followUpMode !== 'targeted'
      ? adaptiveReplan.deepenDomains
          .filter((domain) => researchIds.includes(domain))
          .slice(0, 1)
      : [];
  adaptiveReplan.executedDeepenDomains = deepenDomains;
  if (deepenDomains.length > 0) {
    const domain = deepenDomains[0];
    log?.(`Deepening ${domain.replace(/-/g, ' ')} against unresolved questions…`);
    const deepenAgent = ALL_AGENTS.find((agent) => agent.id === domain);
    if (deepenAgent) {
      const deepenResult = await executor.execute(
        {
          steps: planMission([domain], intentClass),
          agents: [deepenAgent],
          context: {
            ...agentContext,
            query: [
              query,
              'Targeted deepening — resolve these evidence gaps:',
              ...scratchpad.openQuestions.slice(0, 4).map((question) => `- ${question}`),
            ].join('\n'),
            priorContext: [
              agentContext.priorContext,
              `Deepening reason:\n${adaptiveReplan.reasons.join('\n')}`,
            ].filter(Boolean).join('\n\n'),
          },
          scratchpad,
        },
        {
          onAgentUpdate: (run) => onAgentUpdate?.(run),
          onOrchestrationLog: log,
          shouldCancel: options?.shouldCancel,
        },
      );
      const deepened = deepenResult.outputs[0];
      if (deepened) {
        const existingIndex = outputs.findIndex((output) => output.domain === domain);
        if (existingIndex >= 0) {
          outputs[existingIndex] = mergeDeepenedOutput(
            outputs[existingIndex],
            deepened,
          );
        } else {
          outputs.push(deepened);
        }
      }
      const deepenRun = deepenResult.agentRuns[0];
      const existingRunIndex = agentRuns.findIndex((run) => run.agentId === domain);
      if (deepenRun && existingRunIndex >= 0) {
        agentRuns[existingRunIndex] = deepenRun;
      } else if (deepenRun) {
        agentRuns.push(deepenRun);
      }
      agentLatencies[domain] =
        (agentLatencies[domain] ?? 0) + (deepenResult.agentLatencies[domain] ?? 0);
      modelCallCount += 1;
    }
  }

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
      intentClass,
      classification.industryVertical,
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
  const boundRecommendations = bindEvidenceToSources(
    intentClass === 'dd_acquisition'
      ? sanitizeDiligenceRecommendations(guarded.recommendations)
      : guarded.recommendations,
    allSources,
    product,
    competitor,
    3,
    { productUrl, competitorUrl },
  );
  const unsupportedRecommendations = boundRecommendations.filter(
    (recommendation) => recommendation.evidenceStatus === 'unsupported',
  );
  const unsupportedClaimCount = boundRecommendations.reduce(
    (count, recommendation) =>
      count + (recommendation.evidenceBindings ?? [])
        .filter((binding) => binding.support === 'unsupported').length,
    0,
  );
  if (unsupportedClaimCount > 0) {
    if (!guarded.quality.flags.includes('unbound_claims')) {
      guarded.quality.flags.push('unbound_claims');
    }
    totalConfidence = boundRecommendations.length > 0
      && unsupportedRecommendations.length === boundRecommendations.length
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
  const investigationQuestions = [
    ...scratchpad.openQuestions,
    ...synthesisResult.unknowns,
  ].filter((value, index, all) => value.trim() && all.indexOf(value) === index);
  const investigationPlan = buildInvestigationPlan({
    intent: intentClass,
    product,
    openQuestions: investigationQuestions,
    coverage: evidenceCoverage,
    outputs: outputsFinal,
    replan: adaptiveReplan,
  });
  const dueDiligencePack = intentClass === 'dd_acquisition'
    ? buildDueDiligencePack(product, outputsFinal, investigationQuestions)
    : undefined;
  if (dueDiligencePack) {
    answer = buildDiligenceExecutiveAnswer(dueDiligencePack);
    if (narratedGaps.length > 0) {
      answer += `\n\nEvidence gaps: ${narratedGaps.slice(0, 3).join(' ')}`;
    }
  }
  const comparisonContract =
    intentClass === 'compare'
    && entities.length >= 2
    && !isSelfComparisonQuery(query)
    ? buildComparisonContract(entities, outputsFinal)
    : undefined;
  if (comparisonContract) {
    answer = buildComparisonExecutiveAnswer(comparisonContract);
    if (narratedGaps.length > 0) {
      answer += `\n\nEvidence gaps: ${narratedGaps.slice(0, 3).join(' ')}`;
    }
  }
  const recommendations = rankRecommendations({
    recommendations: boundRecommendations,
    learningContext: memoryContext,
    fallbackFalsifiers: synthesisResult.whatWouldChangeThis,
  });
  const combinedEvidenceLimitations = [
    ...synthesisResult.evidenceLimitations,
    ...bindingGaps,
    ...coverageGaps,
  ].filter((value, index, all) => all.indexOf(value) === index);
  const confidenceDrivers = {
    supports: synthesisResult.confidenceDrivers.supports,
    weakens: [
      ...synthesisResult.confidenceDrivers.weakens,
      ...(classification.entityResolutionConflict
        ? ['LLM and deterministic entity extraction disagreed; confidence was capped.']
        : []),
    ],
  };
  const decisionFrame = tier >= 2
    ? buildDecisionFrame({
        answer,
        recommendations,
        unknowns: synthesisResult.unknowns,
        evidenceLimitations: combinedEvidenceLimitations,
        falsifiers: synthesisResult.whatWouldChangeThis,
        parsed: synthesisResult.decisionFrame,
      })
    : undefined;
  const generatedAt = new Date().toISOString();
  const boardPack = decisionFrame
    ? buildBoardPack({
        product,
        competitor,
        answer,
        decisionFrame,
        recommendations,
        outputs: outputsFinal,
        learningContext: memoryContext,
        generatedAt,
      })
    : undefined;
  const executiveContent = decisionFrame
    ? buildExecutiveContent({
        answer,
        recommendations,
        assumptions: synthesisResult.assumptions,
        unknowns: synthesisResult.unknowns,
        evidenceLimitations: combinedEvidenceLimitations,
        whatWouldChangeThis: synthesisResult.whatWouldChangeThis,
        alternativeHypotheses: synthesisResult.alternativeHypotheses,
        confidenceDrivers,
        briefBindings: bindProseToSources(answer, allSources, product, competitor, 3, { productUrl, competitorUrl }),
      })
    : undefined;
  const finalFollowUps = [
    ...followUps,
    ...investigationPlan.targetedFollowUpPlan,
  ].filter((value, index, all) => value.trim() && all.indexOf(value) === index).slice(0, 5);

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
    industryVertical: classification.industryVertical,
    agentRuns,
    outputs: outputsFinal,
    synthesizedAnswer: answer,
    topRecommendations: recommendations,
    suggestedFollowUps: finalFollowUps,
    totalConfidence,
    researchIntent: intentClass,
    investigationPlan,
    dueDiligencePack,
    comparisonContract,
    adaptiveReplan,
    decisionFrame,
    boardPack,
    executiveContent,
    assumptions: synthesisResult.assumptions,
    unknowns: synthesisResult.unknowns,
    evidenceLimitations: combinedEvidenceLimitations,
    whatWouldChangeThis: synthesisResult.whatWouldChangeThis,
    alternativeHypotheses: synthesisResult.alternativeHypotheses,
    confidenceDrivers,
    generatedAt,
    metrics,
    quality: guarded.quality,
    evidenceCoverage,
    missionPlan: {
      intent: intentClass,
      objective: MISSION_TEMPLATES[intentClass].objective,
      deliverables: MISSION_TEMPLATES[intentClass].deliverables,
      steps: missionSteps.map((s) => ({
        id: s.id,
        label: s.label,
        agentId: s.agentId,
        dependsOn: s.dependsOn,
        rationale: s.rationale,
        stage: s.stage,
      })),
    },
    selectionMeta: {
      mode: researchIds.length >= 6 ? 'full' : resolved.mode,
      savedVsFull: Math.max(0, 6 - researchIds.length),
      researchIds: researchIds as string[],
      tier,
      tierLabel: `TIER ${tier} · ${MISSION_TEMPLATES[intentClass].label.toUpperCase()}`,
    },
  };
}

// ── Optional MiroFish agent — runs independently after main result ────────────
// Called by the route handler only when the user has enabled the scenario lab.
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
    onOrchestrationLog?.('Swarm Decision Lab: running synthetic stakeholder scenario…');
    const output = await mirofishAgent.run(agentContext);
    onAgentUpdate?.({ ...run, status: 'completed', completedAt: new Date().toISOString() });
    return output;
  } catch (err) {
    onAgentUpdate?.({ ...run, status: 'failed', completedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ── MiroFish Live agent — configured service only, no fabricated fallback ────
// Dispatched only when the user has toggled "MiroFish Live" in the UI.
export async function runMirofishLiveAgent(
  query: string,
  history: ConversationMessage[],
  onAgentUpdate?: (run: AgentRun) => void,
  images: ImageAttachment[] = [],
  memoryContext?: string,
  onOrchestrationLog?: (message: string) => void,
): Promise<AgentOutput | null> {
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
    onOrchestrationLog?.('Swarm Decision Lab (Live): interviewing configured synthetic panel…');
    const output = await mirofishLiveAgent.run(agentContext);
    onAgentUpdate?.({
      ...liveRun,
      status: 'completed',
      completedAt: new Date().toISOString(),
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
