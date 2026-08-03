import type { RunMetrics } from '@/lib/agents/types';

export interface UsageInfo {
  models: { text: string; embedding: string; embeddingDimensions: number };
  providers: { id: string; label: string; kind: string; configured: boolean; usageNote: string }[];
  geminiUsage?: { totalTokens?: number; estimatedCostUsd?: number; calls?: number } | null;
  queueMetrics?: {
    jobsTotal: number;
    completed: number;
    failed: number;
    cancelled: number;
    deadLetter: number;
    retries: number;
    avgQueueWaitMs: number | null;
    avgExecutionMs: number | null;
    avgAgentRuntimeMs: number | null;
    lastJob: { id: string; status: string; metrics: Record<string, unknown> } | null;
  } | null;
  auditLogs?: { id: string; action: string; resource_type: string; created_at: string }[];
  feedbackStats?: { up: number; down: number; refineRate: number | null } | null;
}

export interface SessionUsage {
  queries: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  totalGeminiCalls: number;
  totalToolCalls: number;
}

/**
 * High-fidelity demonstration mock data for the API and Model Usage Dashboard.
 */
export const MOCK_LAST_RUN_METRICS: RunMetrics = {
  totalLatencyMs: 4820,
  agentLatencies: {
    'market-trends': 1200,
    competitive: 1850,
    pricing: 950,
    positioning: 1100,
    'win-loss': 1400,
    adjacent: 890,
    'execution-engine': 2100,
  },
  estimatedCostUsd: 0.0042,
  geminiCallCount: 14,
  toolCallCount: 18,
  agentCount: 7,
  completedAgentCount: 7,
  failedAgentCount: 0,
};

export const MOCK_SESSION_USAGE: SessionUsage = {
  queries: 5,
  totalCostUsd: 0.0218,
  totalLatencyMs: 24200,
  totalGeminiCalls: 68,
  totalToolCalls: 84,
};

export const MOCK_QUERY_CACHE_STATS = {
  hits: 22,
  misses: 3,
};

export const MOCK_AGENTS_SAVED_VS_FULL = 2;

export const MOCK_USAGE_INFO: UsageInfo = {
  models: {
    text: 'gemini-2.5-flash-lite',
    embedding: 'text-embedding-004',
    embeddingDimensions: 768,
  },
  providers: [
    {
      id: 'google_gemini',
      label: 'Google Gemini AI',
      kind: 'llm',
      configured: true,
      usageNote: 'Primary reasoning, swarm synthesis & evidence parsing engine (GEMINI_API_KEY configured).',
    },
    {
      id: 'apify',
      label: 'Apify Web Scraper',
      kind: 'scraping',
      configured: true,
      usageNote: 'Headless browser web extraction actor (APIFY_API_TOKEN configured).',
    },
    {
      id: 'firecrawl',
      label: 'Firecrawl Search Crawler',
      kind: 'search',
      configured: true,
      usageNote: 'Deep web content and search indexing API (FIRECRAWL_API_KEY configured).',
    },
    {
      id: 'postgres_vector',
      label: 'PostgreSQL Vector Store',
      kind: 'database',
      configured: true,
      usageNote: 'Local pgvector embedding index for canonical evidence recall.',
    },
  ],
  geminiUsage: {
    totalTokens: 148920,
    estimatedCostUsd: 0.0218,
    calls: 68,
  },
  queueMetrics: {
    jobsTotal: 12,
    completed: 12,
    failed: 0,
    cancelled: 0,
    deadLetter: 0,
    retries: 0,
    avgQueueWaitMs: 320,
    avgExecutionMs: 4500,
    avgAgentRuntimeMs: 3800,
    lastJob: {
      id: 'job-latest-sweep',
      status: 'completed',
      metrics: { latencyMs: 4820, agentsCount: 7 },
    },
  },
  auditLogs: [
    { id: 'log-01', action: 'COLLECTION_RUN', resource_type: 'market_project', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    { id: 'log-02', action: 'SWARM_SYNTHESIS', resource_type: 'intelligence_sweep', created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
    { id: 'log-03', action: 'EVIDENCE_SPANS_EXTRACTED', resource_type: 'evidence_ledger', created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
    { id: 'log-04', action: 'DELTA_COMPUTE_MATERIALITY', resource_type: 'market_delta', created_at: new Date(Date.now() - 1000 * 60 * 52).toISOString() },
  ],
  feedbackStats: {
    up: 14,
    down: 0,
    refineRate: 94,
  },
};
