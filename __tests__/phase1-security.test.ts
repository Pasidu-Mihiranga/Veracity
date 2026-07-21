import { describe, it, expect, afterEach } from 'vitest';
import {
  geminiGenerateContentUrl,
  geminiEmbedContentUrl,
  geminiAuthHeaders,
} from '@/lib/agents/gemini';
import {
  enforceSweepRateLimit,
  rateLimitExceededResponse,
  resetRateLimitCache,
  SWEEP_RATE_LIMIT,
} from '@/lib/rate-limit';
import { resetConfigCache } from '@/lib/config';

describe('TASK-1.1 Gemini header auth', () => {
  it('generateContent URL has no API key query param', () => {
    const url = geminiGenerateContentUrl('gemini-2.5-flash');
    expect(url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain('key=');
    expect(url).not.toContain('?');
  });

  it('embedContent URL has no API key query param', () => {
    const url = geminiEmbedContentUrl('gemini-embedding-001');
    expect(url).not.toContain('key=');
    expect(url).not.toContain('?');
  });

  it('auth headers use x-goog-api-key', () => {
    const headers = geminiAuthHeaders('secret-test-key') as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('secret-test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('TASK-1.1 auth secret (no plaintext fallback)', () => {
  afterEach(() => {
    resetConfigCache();
  });

  it('getAuthSecret path fails when AUTH_SECRET missing via config', async () => {
    const { parseEnv, ConfigError } = await import('@/lib/config');
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgresql://localhost/veracity',
        GEMINI_API_KEY: 'key',
        NODE_ENV: 'test',
      }),
    ).toThrow(ConfigError);
  });
});

describe('TASK-1.2 rate limiting', () => {
  afterEach(() => {
    resetRateLimitCache();
    resetConfigCache();
  });

  it('fail-opens when Upstash is not configured', async () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/veracity';
    process.env.AUTH_SECRET = 'test-auth-secret-16chars';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetConfigCache();
    resetRateLimitCache();

    const result = await enforceSweepRateLimit('user-1');
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.limit).toBe(SWEEP_RATE_LIMIT);
  });

  it('rateLimitExceededResponse returns HTTP 429 JSON', async () => {
    const res = rateLimitExceededResponse({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60_000,
      enabled: true,
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/Rate limit exceeded/i);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('TASK-1.1 no hardcoded MiroFish VPS IP in source', () => {
  it('mirofish-live tool module does not embed 168.144.36.78', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const file = fs.readFileSync(
      path.join(process.cwd(), 'lib/tools/mirofish-live.ts'),
      'utf8',
    );
    expect(file).not.toContain('168.144.36.78');
  });
});
