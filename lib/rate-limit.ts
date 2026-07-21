import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getConfig } from '@/lib/config';

/** Plan TASK-1.2: max 10 research sweeps per user per hour. */
export const SWEEP_RATE_LIMIT = 10;
export const SWEEP_RATE_WINDOW = '1 h' as const;

export type SweepRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  /** False when Upstash is not configured (local/dev fail-open). */
  enabled: boolean;
};

let cachedLimiter: Ratelimit | null | undefined;

function getSweepLimiter(): Ratelimit | null {
  if (cachedLimiter !== undefined) return cachedLimiter;

  const cfg = getConfig();
  if (!cfg.UPSTASH_REDIS_REST_URL || !cfg.UPSTASH_REDIS_REST_TOKEN) {
    cachedLimiter = null;
    return null;
  }

  cachedLimiter = new Ratelimit({
    redis: new Redis({
      url: cfg.UPSTASH_REDIS_REST_URL,
      token: cfg.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(SWEEP_RATE_LIMIT, SWEEP_RATE_WINDOW),
    prefix: 'veracity:sweep',
    analytics: true,
  });
  return cachedLimiter;
}

/** Test helper — clears the Redis limiter singleton. */
export function resetRateLimitCache(): void {
  cachedLimiter = undefined;
}

/**
 * Sliding-window rate limit for expensive orchestration routes.
 * When Upstash env vars are absent, allows the request (enabled: false)
 * so local development works without Redis.
 */
export async function enforceSweepRateLimit(userId: string): Promise<SweepRateLimitResult> {
  const limiter = getSweepLimiter();
  if (!limiter) {
    return {
      success: true,
      limit: SWEEP_RATE_LIMIT,
      remaining: SWEEP_RATE_LIMIT,
      reset: Date.now() + 60 * 60 * 1000,
      enabled: false,
    };
  }

  const result = await limiter.limit(`user:${userId}`);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    enabled: true,
  };
}

export function rateLimitExceededResponse(result: SweepRateLimitResult): Response {
  const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Max ${result.limit} research sweeps per hour. Try again later.`,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  );
}
