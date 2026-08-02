/**
 * The MiroFish worker now rejects every API route without a shared secret.
 *
 * That hardening is only as good as the callers: a client that forgets the
 * header turns the whole synthetic-panel feature into a silent 401. This suite
 * asserts the header is built centrally and that both clients use it, so a new
 * call site cannot quietly reintroduce a bare `Content-Type` fetch.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CLIENTS = ['lib/tools/mirofish.ts', 'lib/tools/mirofish-live.ts'] as const;

/** Comments quote the old pattern to explain it, so checks run against code. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe.each(CLIENTS)('%s', (path) => {
  const code = codeOf(path);

  it('defines the shared header builder', () => {
    expect(code).toContain('function mirofishHeaders()');
  });

  it('sends the shared secret when one is configured', () => {
    expect(code).toContain("headers['X-MiroFish-Token'] = token");
    expect(code).toContain('MIROFISH_SERVICE_TOKEN');
  });

  it('routes every request through the builder', () => {
    // A bare Content-Type header means a call site that bypasses the token and
    // will 401 at runtime — exactly the silent outage this guards against.
    expect(code).not.toMatch(/headers:\s*\{\s*'Content-Type'/);

    const fetchCalls = code.match(/await fetch\(/g) ?? [];
    const headerUses = code.match(/headers: mirofishHeaders\(\)/g) ?? [];
    expect(headerUses.length).toBeGreaterThan(0);
    expect(headerUses.length).toBe(fetchCalls.length);
  });

  it('omits the header rather than sending an empty one when unconfigured', () => {
    // An empty token would fail hmac.compare_digest anyway, but sending it
    // makes the failure look like a wrong secret rather than a missing one.
    expect(code).toContain('if (token)');
  });
});

describe('environment contract', () => {
  it('declares the token in the config schema', () => {
    expect(readFileSync('lib/config.ts', 'utf8')).toContain('MIROFISH_SERVICE_TOKEN');
  });

  it('documents the token, origin, and host in .env.example', () => {
    const env = readFileSync('.env.example', 'utf8');
    for (const key of [
      'MIROFISH_SERVICE_TOKEN',
      'MIROFISH_ALLOWED_ORIGIN',
      'MIROFISH_HOST',
    ]) {
      expect(env, key).toContain(key);
    }
  });

  it('keeps the documented host on loopback', () => {
    expect(readFileSync('.env.example', 'utf8')).toContain('MIROFISH_HOST=127.0.0.1');
  });
});
