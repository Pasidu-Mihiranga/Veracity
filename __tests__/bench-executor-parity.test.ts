/**
 * Phase 4 dual-executor parity benchmark (ADR-0007).
 * Invoked via: npm run bench:executors
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { planMission } from '@/lib/agents/mission-planner';
import { currentExecutor } from '@/lib/agents/workflow/current-executor';
import { langGraphExecutor } from '@/lib/agents/workflow/langgraph-executor';
import type { AgentConfig, AgentContext, AgentOutput, IntelligenceDomain } from '@/lib/agents/types';
import type { WorkflowExecutor } from '@/lib/agents/workflow/types';

type BenchQuery = {
  id: string;
  category: string;
  tier: number;
  domains: IntelligenceDomain[];
  query: string;
  injectedContext?: string;
};

type CaseResult = {
  id: string;
  category: string;
  tier: number;
  agentCount: number;
  skipped: boolean;
  skipReason?: string;
  parityOk: boolean;
  currentMs: number;
  langgraphMs: number;
  latencyRatio: number | null;
  mismatch?: string;
};

const corpusPath = path.join(process.cwd(), 'scripts/benchmarks/queries.json');
const resultsPath = path.join(process.cwd(), 'scripts/benchmarks/results-executor-parity.json');
const reportPath = path.join(process.cwd(), 'docs/architecture/benchmark-langgraph-vs-current.md');

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stubOutput(agentId: string, facts: string[]): AgentOutput {
  return {
    agentId,
    domain: agentId as AgentOutput['domain'],
    confidence: 'high',
    confidenceScore: 0.82,
    facts,
    interpretation: ['ok'],
    sources: [
      {
        url: `https://example.com/${agentId}`,
        title: `${agentId} source`,
        timestamp: new Date().toISOString(),
        tool: 'serpapi',
      },
    ],
    generatedAt: new Date().toISOString(),
    artifactType: 'competitive-matrix',
  };
}

function makeAgents(ids: IntelligenceDomain[]): AgentConfig[] {
  return ids.map((id) => ({
    id,
    name: id,
    description: 'bench stub',
    run: async (ctx: AgentContext) => {
      // ~40ms simulated agent work so graph framework overhead is a small fraction
      // of wall time (mirrors real tool+LLM latency scale better than 0–2ms stubs).
      await new Promise((r) => setTimeout(r, 40));
      const sawPrior = (ctx.priorContext ?? '').includes('-fact');
      return stubOutput(id, [`${id}-fact`, `prior:${sawPrior ? 'yes' : 'no'}`]);
    },
  }));
}

async function runExecutor(
  exec: WorkflowExecutor,
  domains: IntelligenceDomain[],
  query: BenchQuery,
): Promise<{ ms: number; signature: string }> {
  const scratchpad = {
    productFacts: [] as string[],
    competitorFacts: [] as string[],
    openQuestions: [] as string[],
  };
  const steps = planMission(domains);
  const agents = makeAgents(domains);
  const t0 = performance.now();
  const result = await exec.execute(
    {
      steps,
      agents,
      context: {
        query: query.query,
        product: 'BenchProduct',
        competitor: 'BenchRival',
        priorContext: query.injectedContext ? `Injected:\n${query.injectedContext}` : 'User: bench',
      },
      scratchpad,
    },
    { onAgentUpdate: () => undefined },
  );
  const ms = performance.now() - t0;
  const signature = JSON.stringify({
    statuses: result.agentRuns.map((r) => `${r.agentId}:${r.status}`).sort(),
    outputs: result.outputs
      .map((o) => ({ id: o.agentId, facts: o.facts }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    productFacts: [...scratchpad.productFacts].sort(),
    competitorFacts: [...scratchpad.competitorFacts].sort(),
  });
  return { ms, signature };
}

describe('Phase 4 executor parity benchmark', () => {
  it(
    'runs ≥100-query corpus and writes report',
    async () => {
      const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as {
        count: number;
        queries: BenchQuery[];
      };
      expect(corpus.queries.length).toBeGreaterThanOrEqual(100);

      // Warmup both executors once (avoid cold-start skew on p50)
      const warmDomains: IntelligenceDomain[] = ['competitive', 'win-loss'];
      const warmQ: BenchQuery = {
        id: 'warm',
        category: 'tier1_2',
        tier: 2,
        domains: warmDomains,
        query: 'warmup',
      };
      await runExecutor(currentExecutor, warmDomains, warmQ);
      await runExecutor(langGraphExecutor, warmDomains, warmQ);

      const cases: CaseResult[] = [];
      for (const q of corpus.queries) {
        if (q.tier === 0 || q.domains.length === 0) {
          cases.push({
            id: q.id,
            category: q.category,
            tier: q.tier,
            agentCount: 0,
            skipped: true,
            skipReason: 'Tier 0 / no research domains — wave executor not invoked',
            parityOk: true,
            currentMs: 0,
            langgraphMs: 0,
            latencyRatio: null,
          });
          continue;
        }

        const domains = q.domains;
        const current = await runExecutor(currentExecutor, domains, q);
        const langgraph = await runExecutor(langGraphExecutor, domains, q);
        const parityOk = current.signature === langgraph.signature;
        cases.push({
          id: q.id,
          category: q.category,
          tier: q.tier,
          agentCount: domains.length,
          skipped: false,
          parityOk,
          currentMs: current.ms,
          langgraphMs: langgraph.ms,
          latencyRatio: current.ms > 0 ? langgraph.ms / current.ms : null,
          mismatch: parityOk ? undefined : 'signature mismatch',
        });
      }

      const ran = cases.filter((c) => !c.skipped);
      const mismatches = ran.filter((c) => !c.parityOk);
      const currentLat = ran.map((c) => c.currentMs).sort((a, b) => a - b);
      const lgLat = ran.map((c) => c.langgraphMs).sort((a, b) => a - b);
      const p50Current = percentile(currentLat, 50);
      const p95Current = percentile(currentLat, 95);
      const p50Lg = percentile(lgLat, 50);
      const p95Lg = percentile(lgLat, 95);
      const p50Ratio = p50Current > 0 ? p50Lg / p50Current : 1;
      const p95Ratio = p95Current > 0 ? p95Lg / p95Current : 1;

      const overheadP50 = p50Lg - p50Current;
      const overheadP95 = p95Lg - p95Current;
      // Absolute overhead gate for stub mode: LangGraph adds fixed control-plane cost
      // (~5–15ms). Ratio gates are misleading when agent work is tens of ms; live
      // multi-second sweeps remain bound to ≤+5% (ADR-0007 / Phase 5).
      const ABS_OVERHEAD_P50_MS = 20;
      const ABS_OVERHEAD_P95_MS = 30;
      const latencyGateStub = overheadP50 <= ABS_OVERHEAD_P50_MS && overheadP95 <= ABS_OVERHEAD_P95_MS;
      const parityGate = mismatches.length === 0;
      const pass = parityGate && latencyGateStub;

      const summary = {
        generatedAt: new Date().toISOString(),
        corpusCount: corpus.queries.length,
        ranCount: ran.length,
        skippedCount: cases.length - ran.length,
        parityFailures: mismatches.length,
        p50CurrentMs: Number(p50Current.toFixed(3)),
        p95CurrentMs: Number(p95Current.toFixed(3)),
        p50LanggraphMs: Number(p50Lg.toFixed(3)),
        p95LanggraphMs: Number(p95Lg.toFixed(3)),
        p50Ratio: Number(p50Ratio.toFixed(4)),
        p95Ratio: Number(p95Ratio.toFixed(4)),
        overheadP50Ms: Number(overheadP50.toFixed(3)),
        overheadP95Ms: Number(overheadP95.toFixed(3)),
        gates: {
          parity: parityGate,
          latencyStubAbsolute: latencyGateStub,
          pass,
        },
        note: 'Stub-agent wave-executor parity + absolute overhead. Live Gemini ≤+5% latency/cost still required before default-on.',
      };

      fs.writeFileSync(resultsPath, JSON.stringify({ summary, cases }, null, 2));

      const byCat: Record<string, number> = {};
      for (const c of cases) byCat[c.category] = (byCat[c.category] || 0) + 1;

      const md = `# Benchmark: LangGraphExecutor vs CurrentExecutor

**Date:** ${summary.generatedAt}  
**Mode:** Deterministic stub agents (wave-executor parity)  
**Corpus:** ${summary.corpusCount} queries (\`scripts/benchmarks/queries.json\`)  
**Verdict:** ${pass ? '**PASS** (parity + stub latency gates)' : '**FAIL** — keep CurrentExecutor default'}

## Gates (success metrics)

| Gate | Result | Detail |
|------|--------|--------|
| Outcome parity | ${parityGate ? 'PASS' : 'FAIL'} | ${mismatches.length} mismatches / ${ran.length} ran |
| Stub absolute overhead (p50 ≤20ms, p95 ≤30ms) | ${latencyGateStub ? 'PASS' : 'FAIL'} | overhead p50 ${summary.overheadP50Ms}ms, p95 ${summary.overheadP95Ms}ms (ratios ${summary.p50Ratio} / ${summary.p95Ratio}) |
| Live accuracy / evidence / cost / latency ≤+5% | **Deferred** | Required before \`NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR\` default-on (ADR-0007) |

## Latency

| Executor | p50 (ms) | p95 (ms) |
|----------|----------|----------|
| Current | ${summary.p50CurrentMs} | ${summary.p95CurrentMs} |
| LangGraph | ${summary.p50LanggraphMs} | ${summary.p95LanggraphMs} |
| Absolute overhead | ${summary.overheadP50Ms} | ${summary.overheadP95Ms} |

## Corpus mix

${Object.entries(byCat)
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join('\n')}

- Wave executor exercised: **${ran.length}** cases  
- Skipped (Tier 0 / empty domains): **${summary.skippedCount}**

## Recommendation

${
  pass
    ? `Wave-executor parity and stub latency gates **passed**. LangGraph remains **feature-flag OFF** until a live (≥100 query) accuracy/evidence/cost benchmark also passes (ADR-0007 / Phase 5).`
    : `Do **not** enable \`NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR\`. Investigate mismatches / latency before Phase 5.`
}

## Artifacts

- Corpus: \`scripts/benchmarks/queries.json\`
- Results: \`scripts/benchmarks/results-executor-parity.json\`
- Runner: \`npm run bench:executors\`
`;

      fs.writeFileSync(reportPath, md);

      expect(parityGate).toBe(true);
      expect(latencyGateStub).toBe(true);
      expect(pass).toBe(true);
    },
    120_000,
  );
});
