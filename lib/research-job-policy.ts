import type { ResearchJobStatus } from '@/lib/research-jobs-types';

export type { ResearchJobStatus };

/** Pure helper — mirrors worker retry / DLQ policy. */
export function decideJobFailureAction(input: {
  isTransient: boolean;
  nextAttempt: number;
  maxAttempts: number;
}): 'retry' | 'dead_letter' | 'fail' {
  if (!input.isTransient) return 'fail';
  if (input.nextAttempt < input.maxAttempts) return 'retry';
  return 'dead_letter';
}

export function retryBackoffMs(attempt: number): number {
  return attempt <= 1 ? 1000 : 4000;
}

/** Pure cancel transition used by requestCancelJob. */
export function applyCancelStatus(status: ResearchJobStatus): ResearchJobStatus {
  return status === 'queued' ? 'cancelled' : status;
}
