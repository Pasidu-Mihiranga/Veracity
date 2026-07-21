import { describe, it, expect, afterEach } from 'vitest';
import { parseEnv, getConfig, resetConfigCache, ConfigError } from '@/lib/config';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veracity',
  AUTH_SECRET: 'test-auth-secret-16+',
  GEMINI_API_KEY: 'test-gemini-key',
  NODE_ENV: 'test' as const,
};

describe('parseEnv / lib/config', () => {
  afterEach(() => {
    resetConfigCache();
  });

  it('parses a valid environment', () => {
    const cfg = parseEnv(VALID_ENV);
    expect(cfg.DATABASE_URL).toContain('veracity');
    expect(cfg.AUTH_SECRET).toBe('test-auth-secret-16+');
    expect(cfg.GEMINI_API_KEY).toBe('test-gemini-key');
    expect(cfg.GEMINI_EMBEDDING_DIMENSIONS).toBe(768);
    expect(cfg.GEMINI_THINKING_BUDGET).toBe(0);
  });

  it('throws ConfigError when GEMINI_API_KEY is missing', () => {
    const { GEMINI_API_KEY: _, ...rest } = VALID_ENV;
    expect(() => parseEnv(rest)).toThrow(ConfigError);
    expect(() => parseEnv(rest)).toThrow(/GEMINI_API_KEY/);
  });

  it('throws ConfigError when AUTH_SECRET is missing', () => {
    const { AUTH_SECRET: _, ...rest } = VALID_ENV;
    expect(() => parseEnv(rest)).toThrow(ConfigError);
    expect(() => parseEnv(rest)).toThrow(/AUTH_SECRET/);
  });

  it('throws ConfigError when AUTH_SECRET is too short', () => {
    expect(() => parseEnv({ ...VALID_ENV, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('throws ConfigError when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = VALID_ENV;
    expect(() => parseEnv(rest)).toThrow(ConfigError);
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('treats blank strings as missing required values', () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, GEMINI_API_KEY: '   ' }),
    ).toThrow(ConfigError);
  });

  it('accepts optional tool keys as undefined', () => {
    const cfg = parseEnv(VALID_ENV);
    expect(cfg.SERPAPI_KEY).toBeUndefined();
    expect(cfg.FIRECRAWL_API_KEY).toBeUndefined();
  });

  it('getConfig caches and resetConfigCache clears', () => {
    process.env.DATABASE_URL = VALID_ENV.DATABASE_URL;
    process.env.AUTH_SECRET = VALID_ENV.AUTH_SECRET;
    process.env.GEMINI_API_KEY = VALID_ENV.GEMINI_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';

    resetConfigCache();
    const a = getConfig();
    const b = getConfig();
    expect(a).toBe(b);

    resetConfigCache();
    const c = getConfig();
    expect(c).not.toBe(a);
    expect(c.GEMINI_API_KEY).toBe(VALID_ENV.GEMINI_API_KEY);
  });
});
