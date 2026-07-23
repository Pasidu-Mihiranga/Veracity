import type { IntelligenceDomain } from '@/lib/agents/types';
import { detectExecutionIntent } from '@/lib/agents/execution-intent';

/**
 * Central gate for Stage-2 Execution Engine.
 */
export function shouldRunExecution(input: {
  query: string;
  classifierRunExecution: boolean;
  executionAgentSelected: boolean;
  forceExecution?: boolean;
}): { run: boolean; reason: string } {
  if (!input.executionAgentSelected) {
    return { run: false, reason: 'Execution deferred: execution-engine not selected' };
  }
  if (input.forceExecution) {
    return { run: true, reason: 'Execution forced by client' };
  }
  if (input.classifierRunExecution) {
    return { run: true, reason: 'Classifier detected execution intent' };
  }
  if (detectExecutionIntent(input.query)) {
    return { run: true, reason: 'Query matches execution artifact keywords' };
  }
  return { run: false, reason: 'Execution deferred: research-only' };
}

export function isResearchDomain(id: string): id is IntelligenceDomain {
  return [
    'market-trends',
    'competitive',
    'win-loss',
    'pricing',
    'positioning',
    'adjacent',
    'execution-engine',
  ].includes(id);
}
