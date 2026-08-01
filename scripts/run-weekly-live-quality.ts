import { mkdir, writeFile } from 'node:fs/promises';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { ConversationMessage, OrchestratorOutput } from '@/lib/agents/types';
import { diffCompetitorProfileOutputs } from '@/lib/continuous-intelligence/profile-snapshots';

type Check = { name: string; passed: boolean; detail: string };
type BenchmarkResult = {
  id: 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
  prompt: string;
  checks: Check[];
  passed: boolean;
  confidence?: string;
  failedAgents?: number;
};

const prompts = {
  B1: 'If I were competing directly with ChatGPT, Claude, Gemini, Perplexity, and Glean Enterprise, what would I need to improve to become one of the best AI research assistants? Be critical. Do not try to make yourself look better. Assume an enterprise customer is evaluating whether they should trust you.',
  B2: 'We are evaluating acquiring a mid-market API management vendor similar to WSO2’s commercial product line. Produce a due-diligence investigation plan and an initial evidence-based assessment of risks. Separate known facts from unknowns. Do not invent financials.',
  B3: 'Compare Notion and Confluence for enterprise knowledge management buyers in 2026. Focus on positioning, pricing signals, and switching risks. Cite only evidence you actually retrieved.',
  B4: 'Compare WSO2 and SyscoLabs for a B2B software buyer. If they are not comparable peers, say so clearly and explain what evidence would be required to continue.',
  B5: 'Run watchlist monitoring for competitor X. Report only material changes since last sweep.',
} as const;

async function runLive(
  id: 'B1' | 'B2' | 'B3' | 'B4',
  history: ConversationMessage[] = [],
): Promise<OrchestratorOutput> {
  return orchestrate(prompts[id], history, () => undefined, [], undefined, {
    forceFullSweep: true,
  });
}

function common(result: OrchestratorOutput): Omit<BenchmarkResult, 'id' | 'prompt' | 'checks' | 'passed'> {
  return {
    confidence: result.totalConfidence,
    failedAgents: result.agentRuns.filter((run) => run.status === 'failed').length,
  };
}

async function main() {
  if (process.env.LIVE_QUALITY !== '1') {
    throw new Error('Set LIVE_QUALITY=1 to run the live B1–B5 quality suite.');
  }
  const results: BenchmarkResult[] = [];

  const b1 = await runLive('B1');
  const b1Checks: Check[] = [
    check('assumptions', (b1.assumptions?.length ?? 0) > 0, `${b1.assumptions?.length ?? 0}`),
    check('falsifiers', (b1.whatWouldChangeThis?.length ?? 0) > 0, `${b1.whatWouldChangeThis?.length ?? 0}`),
    check(
      'no unsupported high-confidence recommendation',
      !b1.topRecommendations.some((rec) =>
        rec.confidence === 'high' && rec.evidenceStatus !== 'supported'),
      `${b1.topRecommendations.length} recommendations`,
    ),
    check(
      'critical gap language',
      /gap|missing|weak|risk|improv|limitation/i.test(b1.synthesizedAnswer),
      b1.synthesizedAnswer.slice(0, 160),
    ),
  ];
  results.push(result('B1', b1Checks, common(b1)));

  const b2 = await runLive('B2');
  const b2Checks: Check[] = [
    check('due-diligence pack', Boolean(b2.dueDiligencePack), b2.researchIntent ?? 'none'),
    check('explicit unknowns', (b2.unknowns?.length ?? 0) > 0, `${b2.unknowns?.length ?? 0}`),
    check(
      'no fabricated financial precision',
      !/\b(?:ARR|revenue|valuation|EBITDA)\s*(?:is|of|=|:)\s*\$?\d/i.test(b2.synthesizedAnswer),
      b2.synthesizedAnswer.slice(0, 160),
    ),
    check(
      'investigation probes',
      (b2.investigationPlan?.proposedNextProbes.length ?? 0) > 0,
      `${b2.investigationPlan?.proposedNextProbes.length ?? 0}`,
    ),
  ];
  results.push(result('B2', b2Checks, common(b2)));

  const b3 = await runLive('B3');
  const b3Text = `${b3.synthesizedAnswer} ${JSON.stringify(b3.comparisonContract ?? {})}`;
  const b3Checks: Check[] = [
    check('both entities', /notion/i.test(b3Text) && /confluence/i.test(b3Text), b3.product),
    check('comparison contract', Boolean(b3.comparisonContract), b3.researchIntent ?? 'none'),
    check(
      'retrieved URLs only',
      b3.outputs.flatMap((output) => output.sources).every((source) => /^https?:\/\//.test(source.url)),
      `${b3.outputs.flatMap((output) => output.sources).length} sources`,
    ),
    check('pricing caveat or primary evidence', /pricing|directional|unknown|not retrieved/i.test(b3Text), 'pricing checked'),
  ];
  results.push(result('B3', b3Checks, common(b3)));

  const b4History: ConversationMessage[] = [{
    role: 'assistant',
    content: 'Prior unrelated context: the user researched Lilian and competitor Clay.',
    timestamp: '2026-07-29T00:00:00.000Z',
  }];
  const b4 = await runLive('B4', b4History);
  const b4Text = `${b4.synthesizedAnswer} ${JSON.stringify(b4.comparisonContract ?? {})}`;
  const b4Checks: Check[] = [
    check('no memory contamination', !/\b(?:Lilian|Clay)\b/i.test(b4Text), b4Text.slice(0, 160)),
    check('peer mismatch stated', /not comparable|comparable product peers|peer relationship|mismatch/i.test(b4Text), b4Text.slice(0, 160)),
    check('official URLs requested', /official (?:product )?urls?/i.test(b4Text), 'official URLs'),
    check('buyer intent requested', /buyer intent|use case|procurement criteria/i.test(b4Text), 'buyer intent'),
  ];
  results.push(result('B4', b4Checks, common(b4)));

  const before = monitoringOutput('Enterprise pricing is $20 per user per month.');
  const priceChange = monitoringOutput('Enterprise pricing increased to $35 per user per month.');
  const copyChange = monitoringOutput('Enterprise pricing is $20 per user monthly.');
  const material = diffCompetitorProfileOutputs(before, priceChange);
  const nonMaterial = diffCompetitorProfileOutputs(before, copyChange);
  const b5Checks: Check[] = [
    check('profile diff is material', material.material, material.changedFields.join(',')),
    check('pricing categorized', material.materialEvents.some((event) => event.category === 'pricing'), material.materialEvents.map((event) => event.category).join(',')),
    check('copy tweak suppressed', !nonMaterial.material, `${nonMaterial.suppressedSignals.length} suppressed`),
    check('source preserved', material.materialEvents.every((event) => event.sourceUrls.length > 0), 'source URLs'),
  ];
  results.push(result('B5', b5Checks, {}));

  const report = {
    suite: 'Veracity B1-B5 weekly live quality',
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    passed: results.every((item) => item.passed),
    results,
  };
  await mkdir('artifacts/evals', { recursive: true });
  const file = `artifacts/evals/weekly-${report.generatedAt.slice(0, 10)}.json`;
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

function result(
  id: BenchmarkResult['id'],
  checks: Check[],
  metadata: Partial<BenchmarkResult>,
): BenchmarkResult {
  return {
    id,
    prompt: prompts[id],
    checks,
    passed: checks.every((item) => item.passed),
    ...metadata,
  };
}

function check(name: string, passed: boolean, detail: string): Check {
  return { name, passed, detail };
}

function monitoringOutput(fact: string): OrchestratorOutput {
  return {
    query: prompts.B5,
    product: 'Vector',
    competitor: 'Competitor X',
    agentRuns: [],
    outputs: [{
      agentId: 'pricing',
      domain: 'pricing',
      confidence: 'high',
      confidenceScore: 0.9,
      facts: [fact],
      interpretation: [],
      sources: [{
        title: 'Official competitor pricing',
        url: 'https://competitor.example/pricing',
        timestamp: '2026-07-29T00:00:00.000Z',
        tool: 'firecrawl',
      }],
      generatedAt: '2026-07-29T00:00:00.000Z',
      artifactType: 'pricing-table',
    }],
    synthesizedAnswer: fact,
    topRecommendations: [],
    suggestedFollowUps: [],
    totalConfidence: 'high',
    generatedAt: '2026-07-29T00:00:00.000Z',
  };
}

void main();

