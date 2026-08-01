import type { AgentOutput, AgentRun, OrchestratorOutput } from '@/lib/agents/types';
import type { PipelineStage } from '@/types/chat-ui';
import type { Domain } from '@/lib/domain-meta';

export type ConvergeAgentStatus = 'queued' | 'running' | 'done' | 'failed' | 'blocked';

export type ConvergeAgent = {
  id: string;
  name: string;
  task: string;
  status: ConvergeAgentStatus;
  colorFg: string;
  startedAt?: number;
  progressPct?: number;
  progressLabel?: string;
  waitingOn?: string;
  completionSummary?: { headline: string; stats: string[] };
  motionSeed: number;
};

/** Plain labels/accents — avoid importing JSX DOMAIN_META into non-UI modules. */
const DOMAIN_SHORT: Record<Domain, string> = {
  'market-trends': 'Market Trends',
  competitive: 'Competitive',
  'win-loss': 'Win / Loss',
  pricing: 'Pricing',
  positioning: 'Positioning',
  adjacent: 'Adjacent',
  'execution-engine': 'Execution',
  mirofish: 'MiroFish',
  'mirofish-live': 'MiroFish Live',
};

const DOMAIN_ACCENT: Record<Domain, { dark: string; light: string }> = {
  'market-trends': { dark: '#00C4FF', light: '#0052A3' },
  competitive: { dark: '#3D9EFF', light: '#1A5A9A' },
  'win-loss': { dark: '#7EC8FF', light: '#0B4F8C' },
  pricing: { dark: '#2A7FD4', light: '#0B4F8C' },
  positioning: { dark: '#1A5A9A', light: '#063A6B' },
  adjacent: { dark: '#5AB0E8', light: '#1A5A9A' },
  'execution-engine': { dark: '#00C4FF', light: '#0052A3' },
  mirofish: { dark: '#9ED8FF', light: '#0B4F8C' },
  'mirofish-live': { dark: '#1A5A9A', light: '#063A6B' },
};

const RESEARCH_DOMAINS: Domain[] = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
];

const POST_RESEARCH_DOMAINS: Domain[] = [
  'execution-engine',
  'mirofish',
  'mirofish-live',
];

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

function softProgressFromStart(startedAt?: number, now = Date.now()): number {
  if (!startedAt) return 12;
  const elapsed = Math.max(0, now - startedAt);
  // Soft curve toward ~85% over ~45s — never fake 100% early
  const t = Math.min(1, elapsed / 45_000);
  return Math.round(8 + 77 * (1 - Math.pow(1 - t, 1.6)));
}

function phaseFromLogs(domain: Domain, lines: string[]): string | null {
  const joined = lines.join(' ').toLowerCase();
  const short = DOMAIN_SHORT[domain].toLowerCase();
  const domainKey = domain.replace(/-/g, ' ');
  const relevant = lines
    .filter((l) => {
      const lower = l.toLowerCase();
      return lower.includes(short) || lower.includes(domain) || lower.includes(domainKey);
    })
    .map((l) => l.toLowerCase());
  const hay = relevant.length ? relevant.join(' ') : joined;

  if (/embed|vector/.test(hay)) return 'Embedding';
  if (/scrap|firecrawl|crawl/.test(hay)) return 'Scraping';
  if (/search|serp|google|hn|reddit/.test(hay)) return 'Searching';
  if (/synth|draft|summar/.test(hay)) return 'Synthesizing';
  if (/scenario|mirofish|swarm/.test(hay)) return 'Testing scenario';
  if (/execut|outreach|variant|copy/.test(hay)) return 'Drafting';
  return null;
}

function sourceCountFromLogs(lines: string[]): number | null {
  for (const line of [...lines].reverse()) {
    const m = line.match(/(\d+)\s+(sources?|results?|hits|posts|ads|tweets|vectors)/i);
    if (m) return Number.parseInt(m[1], 10);
  }
  return null;
}

function completionSummaryFor(
  domain: Domain,
  output: AgentOutput | undefined,
): { headline: string; stats: string[] } {
  const short = DOMAIN_SHORT[domain];
  const headline = `${short} complete`;
  const stats: string[] = [];
  if (output) {
    const facts = output.facts?.length ?? 0;
    const sources = output.sources?.length ?? 0;
    if (facts > 0) stats.push(`${facts} finding${facts === 1 ? '' : 's'}`);
    if (sources > 0) stats.push(`${sources} source${sources === 1 ? '' : 's'}`);
    if (output.confidence) stats.push(`${output.confidence} confidence`);

    const any = output as unknown as Record<string, unknown>;
    const matrix = any.matrix;
    if (Array.isArray(matrix) && matrix.length) {
      stats.push(`${matrix.length} competitor${matrix.length === 1 ? '' : 's'}`);
    }
    const trends = any.trends;
    if (Array.isArray(trends) && trends.length) {
      stats.push(`${trends.length} trend${trends.length === 1 ? '' : 's'}`);
    }
  }
  if (!stats.length) stats.push('Signals grounded');
  return { headline, stats: stats.slice(0, 3) };
}

function researchTerminal(
  domains: Domain[],
  getRunForDomain: (domain: Domain) => AgentRun | undefined,
): boolean {
  const research = domains.filter((d) => RESEARCH_DOMAINS.includes(d));
  if (!research.length) return true;
  return research.every((d) => {
    const s = getRunForDomain(d)?.status;
    return s === 'completed' || s === 'failed';
  });
}

/**
 * Map live agent runs + optional outputs/logs into converge-card props.
 */
export function mapRunsToConvergeAgents(args: {
  domains: Domain[];
  getRunForDomain: (domain: Domain) => AgentRun | undefined;
  getOutputForDomain?: (domain: Domain) => AgentOutput | undefined;
  orchestrationLines?: string[];
  isDark: boolean;
  now?: number;
}): ConvergeAgent[] {
  const {
    domains,
    getRunForDomain,
    getOutputForDomain,
    orchestrationLines = [],
    isDark,
    now = Date.now(),
  } = args;

  const researchDone = researchTerminal(domains, getRunForDomain);
  const sourceHits = sourceCountFromLogs(orchestrationLines);

  return domains.map((domain) => {
    const shortName = DOMAIN_SHORT[domain];
    const run = getRunForDomain(domain);
    const output = getOutputForDomain?.(domain);
    const raw = run?.status ?? 'pending';
    const startedAt = run?.startedAt ? Date.parse(run.startedAt) : undefined;
    const motionSeed = hashSeed(domain);
    const accents = DOMAIN_ACCENT[domain];
    const colorFg = isDark ? accents.dark : accents.light;

    let status: ConvergeAgentStatus;
    let waitingOn: string | undefined;

    if (raw === 'completed') status = 'done';
    else if (raw === 'failed') status = 'failed';
    else if (raw === 'running') status = 'running';
    else if (
      POST_RESEARCH_DOMAINS.includes(domain) &&
      (raw === 'pending' || !run) &&
      !researchDone
    ) {
      status = 'blocked';
      waitingOn = 'Research';
    } else {
      status = 'queued';
    }

    const phase = phaseFromLogs(domain, orchestrationLines);
    let task: string;
    if (status === 'blocked') task = `Waiting for ${waitingOn}`;
    else if (status === 'queued') task = 'Queued';
    else if (status === 'failed') task = run?.error?.slice(0, 80) || 'Failed';
    else if (status === 'done') task = 'Complete';
    else task = phase ? `${phase}…` : 'Researching live signals…';

    // Prefer latest orch line that mentions this agent
    const mention = [...orchestrationLines]
      .reverse()
      .find((l) => {
        const lower = l.toLowerCase();
        return (
          lower.includes(shortName.toLowerCase()) ||
          lower.includes(domain) ||
          lower.includes(domain.replace(/-/g, ' '))
        );
      });
    if (status === 'running' && mention) {
      task = mention.length > 64 ? `${mention.slice(0, 61)}…` : mention;
    }

    let progressPct: number | undefined;
    let progressLabel: string | undefined;

    if (status === 'running') {
      progressPct = softProgressFromStart(startedAt, now);
      if (sourceHits != null) progressLabel = `${sourceHits} sources`;
      else if (phase) progressLabel = phase;
      else progressLabel = `${progressPct}%`;
    } else if (status === 'done' && output?.confidence) {
      progressPct = 100;
      progressLabel = `${output.confidence} confidence`;
    } else if (status === 'done') {
      progressPct = 100;
      progressLabel = 'Complete';
    }

    return {
      id: domain,
      name: shortName,
      task,
      status,
      colorFg,
      startedAt: Number.isFinite(startedAt) ? startedAt : undefined,
      progressPct,
      progressLabel,
      waitingOn,
      completionSummary: status === 'done' ? completionSummaryFor(domain, output) : undefined,
      motionSeed,
    };
  });
}


export function getRunForDomain(
  runs: AgentRun[] | undefined,
  domain: Domain,
): AgentRun | undefined {
  const list = runs ?? [];
  const exact = list.find((r) => r.agentId === domain);
  if (exact) return exact;

  if (domain === 'mirofish-live') {
    return list.find((r) => /mirofish live/i.test(r.name ?? ''));
  }
  if (domain === 'mirofish') {
    return list.find(
      (r) => /mirofish/i.test(r.name ?? '') && !/mirofish live/i.test(r.name ?? ''),
    );
  }

  return list.find((r) => r.name?.toLowerCase().includes(domain.split('-')[0]));
}

export function getOutputForDomain(
  output: OrchestratorOutput | undefined,
  domain: Domain,
) {
  return output?.outputs?.find((o) => o.domain === domain);
}

export function buildPipelineStages(args: {
  orchestrationLines: string[];
  agentRuns: AgentRun[] | undefined;
  orchestratorOutput: OrchestratorOutput | undefined;
  isLoading: boolean;
  executionEnabled: boolean;
}): PipelineStage[] {
  const {
    orchestrationLines,
    agentRuns,
    orchestratorOutput,
    isLoading,
    executionEnabled,
  } = args;

  const hasLine = (needle: string) =>
    orchestrationLines.some((line) => line.toLowerCase().includes(needle.toLowerCase()));

  const researchRuns = (agentRuns ?? []).filter((r) =>
    ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'].includes(
      r.agentId,
    ),
  );
  const researchRunning = researchRuns.some((r) => r.status === 'running');
  const researchTerminal =
    researchRuns.length > 0 &&
    researchRuns.every((r) => r.status === 'completed' || r.status === 'failed');
  const researchFailed =
    researchRuns.length > 0 && researchRuns.every((r) => r.status === 'failed');
  const executionRun = (agentRuns ?? []).find((r) => r.agentId === 'execution-engine');
  const executionSeen = !!executionRun || hasLine('execution intent detected');
  const executionSkipped = !executionSeen && !isLoading;
  const synthesisStarted = hasLine('synthesizing answer') || !!orchestratorOutput;
  const runDone = !!orchestratorOutput && !isLoading;

  return [
    {
      id: 'reasoning',
      label: 'Reasoning',
      state: runDone || hasLine('reasoning about your query') ? 'completed' : 'running',
    },
    {
      id: 'planning',
      label: 'Orchestrating',
      state:
        runDone || hasLine('dividing work across') || hasLine('orchestrating parallel research')
          ? 'completed'
          : hasLine('starting orchestration')
            ? 'running'
            : 'pending',
    },
    {
      id: 'research',
      label: 'Research Swarm',
      state: researchFailed
        ? 'failed'
        : researchTerminal || runDone
          ? 'completed'
          : researchRunning || hasLine('parallel research')
            ? 'running'
            : 'pending',
    },
    {
      id: 'execution',
      label: 'Execution Engine',
      state:
        executionRun?.status === 'failed'
          ? 'failed'
          : executionRun?.status === 'completed'
            ? 'completed'
            : executionRun?.status === 'running'
              ? 'running'
              : executionSkipped || !executionEnabled
                ? 'completed'
                : executionSeen
                  ? 'running'
                  : 'pending',
    },
    {
      id: 'synthesis',
      label: 'Synthesis',
      state: runDone ? 'completed' : synthesisStarted ? 'running' : 'pending',
    },
  ];
}
