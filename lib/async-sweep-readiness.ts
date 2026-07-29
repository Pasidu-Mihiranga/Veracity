export type AsyncSweepReadinessInput = {
  featureEnabled: boolean;
  eventKey?: string | null;
  signingKey?: string | null;
  inngestDev?: boolean;
  production?: boolean;
};

export type AsyncSweepReadiness = {
  ready: boolean;
  mode: 'cloud' | 'dev' | 'sync-fallback';
  reasons: string[];
};

/**
 * Async is the default product path, but only when its transport can both send
 * and authenticate work. NODE_ENV=development alone is intentionally not a
 * transport readiness signal.
 */
export function assessAsyncSweepReadiness(
  input: AsyncSweepReadinessInput,
): AsyncSweepReadiness {
  const reasons: string[] = [];
  if (!input.featureEnabled) reasons.push('feature-disabled');
  const hasEventKey = Boolean(input.eventKey?.trim());
  const hasSigningKey = Boolean(input.signingKey?.trim());
  const devReady = Boolean(input.inngestDev);
  const cloudReady = hasEventKey && (!input.production || hasSigningKey);
  if (!cloudReady && !devReady) {
    reasons.push(
      input.production && hasEventKey && !hasSigningKey
        ? 'missing-signing-key'
        : 'transport-not-configured',
    );
  }
  const ready = reasons.length === 0;
  return {
    ready,
    mode: ready ? (devReady && !hasEventKey ? 'dev' : 'cloud') : 'sync-fallback',
    reasons,
  };
}

