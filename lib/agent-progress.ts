import type { AgentRun, OrchestratorOutput } from '@/lib/agents/types';
import type { PipelineStage } from '@/types/chat-ui';
import type { Domain } from '@/lib/domain-meta';

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
