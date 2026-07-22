import { z } from 'zod';

/**
 * Centralized environment validation (ADR-0001 / TASK-0.2).
 *
 * Required secrets have NO plaintext fallbacks. Call `getConfig()` (or read
 * `config`) on first use — invalid/missing values throw immediately so the
 * process fails fast instead of running with unsafe defaults.
 */

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const requiredString = z.preprocess(
  emptyToUndefined,
  z.string({ error: 'Required environment variable is missing' }).min(1),
);

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url().optional(),
);

const optionalInt = (defaultValue: number, min?: number, max?: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }, z.number().int().min(min ?? Number.MIN_SAFE_INTEGER).max(max ?? Number.MAX_SAFE_INTEGER));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ── Required core ──────────────────────────────────────
  DATABASE_URL: requiredString,
  AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z
      .string({ error: 'AUTH_SECRET is required' })
      .min(16, 'AUTH_SECRET must be at least 16 characters'),
  ),
  GEMINI_API_KEY: requiredString,
  /** Optional second key used when the primary key hits 401/403/429. */
  GEMINI_API_KEY_FALLBACK: optionalString,

  // ── AI (optional overrides) ────────────────────────────
  GEMINI_MODEL: optionalString,
  GEMINI_EMBEDDING_MODEL: optionalString,
  HUGGING_FACE_EMBEDDING_MODEL: optionalString,
  GEMINI_EMBEDDING_DIMENSIONS: optionalInt(768, 1, 3072),
  GEMINI_THINKING_BUDGET: optionalInt(0, -1, 32768),

  // ── App / OAuth ────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: optionalUrl,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  // ── Tool APIs (optional — agents degrade when absent) ──
  SERPAPI_KEY: optionalString,
  FIRECRAWL_API_KEY: optionalString,
  SCRAPE_DO_TOKEN: optionalString,
  APIFY_API_TOKEN: optionalString,
  APIFY_TWITTER_ACTOR_ID: optionalString,
  APIFY_MAX_WAIT_SECS: optionalInt(40, 5, 300),
  APIFY_DEBUG: optionalString,
  REDDIT_CLIENT_ID: optionalString,
  REDDIT_CLIENT_SECRET: optionalString,
  META_ADS_TOKEN: optionalString,

  // ── MiroFish ───────────────────────────────────────────
  MIROFISH_BASE_URL: optionalString,
  MIROFISH_SIMULATIONS: optionalString,
  MIROFISH_LIVE_BASE_URL: optionalString,
  MIROFISH_LIVE_SIMULATIONS: optionalString,
  MIROFISH_LIVE_DEFAULT_SIMULATION_ID: optionalString,
  MIROFISH_LIVE_MAX_AGENTS: optionalInt(5, 1, 6),
  MIROFISH_LIVE_INTERVIEW_TIMEOUT_SEC: optionalInt(240, 30, 360),
  MIROFISH_LIVE_STRICT_SERIAL_MODE: optionalString,

  // ── Rate limiting (optional locally; enable in production) ─
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n- ${issues.join('\n- ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/** Pure parser — preferred for unit tests. Does not touch the process cache. */
export function parseEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'env';
      return `${path}: ${issue.message}`;
    });
    throw new ConfigError(issues);
  }
  return result.data;
}

let cached: AppConfig | null = null;

/** Lazy singleton over `process.env`. Throws ConfigError on first invalid access. */
export function getConfig(): AppConfig {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Test helper — clears the singleton so the next getConfig() re-reads env. */
export function resetConfigCache(): void {
  cached = null;
}

/**
 * Convenience proxy so callers can use `config.AUTH_SECRET` without importing
 * getConfig(). Access still validates lazily on first property read.
 */
export const config: AppConfig = new Proxy({} as AppConfig, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;
    return getConfig()[prop as keyof AppConfig];
  },
});
