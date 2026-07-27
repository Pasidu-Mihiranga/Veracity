/**
 * Phase 5 live sample benchmark — real domain agents + Gemini/tools.
 *
 * Skipped unless BENCH_LIVE=1 (keeps CI free).
 *
 *   BENCH_LIVE=1 BENCH_SAMPLE_SIZE=2 npm run bench:executors:live
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentConfig, IntelligenceDomain } from '@/lib/agents/types';
import type { WorkflowExecutor } from '@/lib/agents/workflow/types';

const LIVE = process.env.BENCH_LIVE === '1' || process.env.BENCH_LIVE === 'true';
const SAMPLE_SIZE = Math.max(1, Number(process.env.BENCH_SAMPLE_SIZE ?? '2') || 2);

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

type BenchQuery = {
  id: string;
  category: string;
  tier: number;
  domains: IntelligenceDomain[];
  query: string;
};

function pickSample(
  queries: BenchQuery[],
  n: number,
  allowed: Set<string>,
): BenchQuery[] {
  const preferred = queries.filter(
    (q) =>
      q.tier >= 1 &&
      q.tier <= 3 &&
      q.domains.length > 0 &&
      q.domains.every((d) => allowed.has(d)) &&
      q.domains.length <= 2,
  );
  const pool = preferred.length >= n ? preferred : queries.filter((q) => q.domains.some((d) => allowed.has(d)));
  const byCat = new Map<string, BenchQuery[]>();
  for (const q of pool) {
    const list = byCat.get(q.category) ?? [];
    list.push(q);
    byCat.set(q.category, list);
  }
  const picked: BenchQuery[] = [];
  const cats = [...byCat.keys()];
  let i = 0;
  while (picked.length < n && cats.length > 0) {
    const cat = cats[i % cats.length];
    const list = byCat.get(cat)!;
    const next = list.shift();
    if (next) {
      next.domains = next.domains.filter((d) => allowed.has(d));
      if (next.domains.length > 0) picked.push(next);
    }
    if (list.length === 0) {
      byCat.delete(cat);
      cats.splice(cats.indexOf(cat), 1);
      if (cats.length === 0) break;
      i = i % cats.length;
      continue;
    }
    i++;
  }
  return picked.slice(0, n);
}

describe.skipIf(!LIVE)('Phase 5 live sample benchmark', () => {
  it(
    `runs ${SAMPLE_SIZE} live sample(s) on both executors`,
    async () => {
      loadDotEnv();
      expect(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY required for BENCH_LIVE').toBeTruthy();

      const { planMission } = await import('@/lib/agents/mission-planner');
      const { currentExecutor } = await import('@/lib/agents/workflow/current-executor');
      const { langGraphExecutor } = await import('@/lib/agents/workflow/langgraph-executor');
      const { competitiveAgent } = await import('@/lib/agents/competitive');
      const { pricingAgent } = await import('@/lib/agents/pricing');
      const { marketTrendsAgent } = await import('@/lib/agents/market-trends');

      const AGENT_BY_ID: Partial<Record<IntelligenceDomain, AgentConfig>> = {
        competitive: competitiveAgent,
        pricing: pricingAgent,
        'market-trends': marketTrendsAgent,
      };
      const allowed = new Set(Object.keys(AGENT_BY_ID));

      const runOnce = async (exec: WorkflowExecutor, q: BenchQuery) => {
        const domains = q.domains.filter((d) => AGENT_BY_ID[d]) as IntelligenceDomain[];
        const agents = domains.map((d) => AGENT_BY_ID[d]!).filter(Boolean);
        const scratchpad = {
          productFacts: [] as string[],
          competitorFacts: [] as string[],
          openQuestions: [] as string[],
        };
        const t0 = performance.now();
        const result = await exec.execute(
          {
            steps: planMission(domains),
            agents,
            context: {
              query: q.query,
              product: 'Vector Agents',
              competitor: 'Clay',
              priorContext: 'User: live bench',
            },
            scratchpad,
          },
          { onAgentUpdate: () => undefined },
        );
        const ms = performance.now() - t0;
        return {
          ms,
          statuses: result.agentRuns.map((r) => `${r.agentId}:${r.status}`).sort(),
          completed: result.agentRuns.filter((r) => r.status === 'completed').length,
          failed: result.agentRuns.filter((r) => r.status === 'failed').length,
          factCount: result.outputs.reduce((n, o) => n + o.facts.length, 0),
          outputIds: result.outputs.map((o) => o.agentId).sort(),
        };
      };

      const corpusPath = path.join(process.cwd(), 'scripts/benchmarks/queries.json');
      const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')) as { queries: BenchQuery[] };
      const sample = pickSample(corpus.queries, SAMPLE_SIZE, allowed);
      expect(sample.length).toBeGreaterThan(0);

      const rows: Array<Record<string, unknown>> = [];
      let crashes = 0;
      let statusMismatches = 0;
      const ratios: number[] = [];

      for (const q of sample) {
        let current;
        let langgraph;
        try {
          current = await runOnce(currentExecutor, q);
          langgraph = await runOnce(langGraphExecutor, q);
        } catch (err) {
          crashes++;
          rows.push({
            id: q.id,
            query: q.query,
            error: err instanceof Error ? err.message : String(err),
          });
          continue;
        }

        const statusOk = JSON.stringify(current.statuses) === JSON.stringify(langgraph.statuses);
        if (!statusOk) statusMismatches++;
        const ratio = current.ms > 0 ? langgraph.ms / current.ms : 1;
        ratios.push(ratio);
        rows.push({
          id: q.id,
          category: q.category,
          query: q.query,
          domains: q.domains,
          current,
          langgraph,
          statusOk,
          latencyRatio: Number(ratio.toFixed(4)),
        });
      }

      const avgRatio =
        ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
      const latencyOk = avgRatio <= 1.25;
      const pass = crashes === 0 && statusMismatches === 0 && latencyOk;

      const summary = {
        generatedAt: new Date().toISOString(),
        sampleSize: sample.length,
        crashes,
        statusMismatches,
        avgLatencyRatio: Number(avgRatio.toFixed(4)),
        gates: {
          crashesZero: crashes === 0,
          statusParity: statusMismatches === 0,
          latencyOk,
          pass,
        },
        recommendation: pass
          ? 'Live sample healthy — still keep flag OFF until larger live corpus meets ≤+5% / accuracy gates (ADR-0008).'
          : 'Live sample failed gates — keep CurrentExecutor; investigate before any enablement.',
      };

      const resultsPath = path.join(process.cwd(), 'scripts/benchmarks/results-live-sample.json');
      fs.writeFileSync(resultsPath, JSON.stringify({ summary, rows }, null, 2));

      const reportPath = path.join(process.cwd(), 'docs/architecture/benchmark-live-sample.md');
      const caseLines = rows
        .map((r) => {
          const err = typeof r.error === 'string' ? ` ERROR ${r.error}` : '';
          return `- \`${r.id}\`: ratio=${r.latencyRatio ?? 'n/a'} statusOk=${r.statusOk ?? false}${err}`;
        })
        .join('\n');

      fs.writeFileSync(
        reportPath,
        `# Live Sample Benchmark (Phase 5)

**Date:** ${summary.generatedAt}  
**Sample size:** ${summary.sampleSize}  
**Verdict:** ${pass ? '**PASS** (sample)' : '**FAIL**'}

| Gate | Result |
|------|--------|
| Crashes | ${crashes === 0 ? 'PASS' : 'FAIL'} (${crashes}) |
| Status parity | ${statusMismatches === 0 ? 'PASS' : 'FAIL'} (${statusMismatches}) |
| Avg latency ratio ≤ 1.25 | ${latencyOk ? 'PASS' : 'FAIL'} (${summary.avgLatencyRatio}) |

## Recommendation

${summary.recommendation}

Per [ADR-0008](../adr/0008-phase5-enablement-hold.md), production default remains **CurrentExecutor**.

## Cases

${caseLines}
`,
      );

      expect(crashes).toBe(0);
      expect(statusMismatches).toBe(0);
      expect(latencyOk).toBe(true);
    },
    600_000,
  );
});
