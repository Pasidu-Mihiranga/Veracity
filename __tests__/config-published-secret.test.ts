/**
 * The published-placeholder guard on AUTH_SECRET.
 *
 * `.env.example` ships `AUTH_SECRET=change-me-to-a-long-random-string`, and
 * copying that file is the documented first setup step. The existing length
 * rule does not catch it — the placeholder is 33 characters and passes — which
 * is worse than no rule, because it reads as validation that already happened.
 *
 * AUTH_SECRET signs session cookies, so a known value is not a weak password.
 * It is the ability to mint a valid session for any user id without one.
 */

import { describe, it, expect } from 'vitest';
import { parseEnv, ConfigError } from '@/lib/config';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/veracity',
  GEMINI_API_KEY: 'test-key',
};

function parse(env: Record<string, string>) {
  return () => parseEnv({ ...base, ...env });
}

describe('AUTH_SECRET in production', () => {
  it('rejects the placeholder that ships in .env.example', () => {
    expect(parse({
      NODE_ENV: 'production',
      AUTH_SECRET: 'change-me-to-a-long-random-string',
    })).toThrow(ConfigError);
  });

  it('explains the consequence rather than just naming the field', () => {
    // A message that only says "invalid AUTH_SECRET" gets the value swapped for
    // another guessable one. The reason it matters has to be in the error.
    try {
      parse({ NODE_ENV: 'production', AUTH_SECRET: 'change-me-to-a-long-random-string' })();
      expect.unreachable('should have thrown');
    } catch (err) {
      const message = (err as ConfigError).message;
      expect(message).toContain('forge a session');
      expect(message).toContain('openssl rand -base64 32');
    }
  });

  it('is not fooled by casing or a trailing newline', () => {
    // A stray newline from a copy-paste or a CI secret store must not be what
    // stands between a deployment and forged sessions.
    expect(parse({
      NODE_ENV: 'production',
      AUTH_SECRET: '  Change-Me-To-A-Long-Random-String\n',
    })).toThrow(ConfigError);
  });

  it('accepts a genuine secret', () => {
    const real = 'K7xQ2mN9pR4tY8vB3wZ6cF1jL5hG0dS2aE7uI9oP4kM=';
    expect(parse({ NODE_ENV: 'production', AUTH_SECRET: real })().AUTH_SECRET).toBe(real);
  });

  it('still enforces the length rule', () => {
    expect(parse({ NODE_ENV: 'production', AUTH_SECRET: 'short' })).toThrow(ConfigError);
  });
});

describe('AUTH_SECRET outside production', () => {
  it('allows the placeholder in development', () => {
    // Local dev is where the placeholder is harmless. Failing here would push
    // people toward deleting the check rather than fixing the deployment.
    expect(parse({
      NODE_ENV: 'development',
      AUTH_SECRET: 'change-me-to-a-long-random-string',
    })().AUTH_SECRET).toBe('change-me-to-a-long-random-string');
  });

  it('allows it in test', () => {
    expect(parse({
      NODE_ENV: 'test',
      AUTH_SECRET: 'change-me-to-a-long-random-string',
    })().AUTH_SECRET).toBeTruthy();
  });
});
