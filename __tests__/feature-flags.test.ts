import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { featureFlags, __testResolveFlag } from '@/lib/feature-flags';

const FLAGS_SOURCE = readFileSync(
  join(process.cwd(), 'lib/feature-flags.ts'),
  'utf8',
);

/**
 * Comments in that file deliberately quote the `process.env[name]` anti-pattern
 * to explain why it is banned, so the static checks below run against code only.
 */
const FLAGS_CODE = FLAGS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('flag value parsing', () => {
  it('treats the documented falsey spellings as off', () => {
    for (const raw of ['0', 'false', 'off', 'no', 'FALSE', ' Off ']) {
      expect(__testResolveFlag(raw, true)).toBe(false);
    }
  });

  it('treats the documented truthy spellings as on', () => {
    for (const raw of ['1', 'true', 'on', 'yes', 'TRUE', ' On ']) {
      expect(__testResolveFlag(raw, false)).toBe(true);
    }
  });

  it('falls back to the default when unset, empty, or unrecognised', () => {
    expect(__testResolveFlag(undefined, true)).toBe(true);
    expect(__testResolveFlag(undefined, false)).toBe(false);
    expect(__testResolveFlag('', true)).toBe(true);
    expect(__testResolveFlag('maybe', false)).toBe(false);
  });
});

describe('client/server agreement', () => {
  it('reads every flag through a static process.env property', () => {
    // Next.js only inlines statically referenced NEXT_PUBLIC_* vars into the
    // browser bundle. A dynamic `process.env[name]` lookup is left untouched,
    // so the client silently fell back to hardcoded defaults while the server
    // read the deployed value — the two disagreed at runtime.
    expect(FLAGS_CODE).not.toMatch(/process\.env\[/);

    const staticReads = FLAGS_CODE.match(/process\.env\.NEXT_PUBLIC_FF_[A-Z_]+/g) ?? [];
    expect(staticReads.length).toBe(Object.keys(featureFlags).length);
  });

  it('gives every flag a distinct env var', () => {
    const staticReads = FLAGS_CODE.match(/process\.env\.NEXT_PUBLIC_FF_[A-Z_]+/g) ?? [];
    expect(new Set(staticReads).size).toBe(staticReads.length);
  });
});

describe('deferred surfaces stay off', () => {
  // Enterprise identity/tenancy and the knowledge-graph surfaces are sequenced
  // after the functional product (plans/GAP_CLOSURE_AND_FEATURE_PLAN.md §5.6).
  // They must default off on both client and server until that phase starts.
  const mustDefaultOff = [
    'samlSso',
    'rbac',
    'workspaces',
    'orgIntelligence',
    'evidenceGraph',
    'competitorProfiles',
    'kgExplorer',
    'crossAgentMemory',
    'kgMaintenance',
    'kgAnalytics',
    'langgraphExecutor',
  ] as const;

  for (const key of mustDefaultOff) {
    it(`${key} is off unless explicitly enabled`, () => {
      const envVar = FLAGS_CODE.match(
        new RegExp(`${key}: parseFlag\\(process\\.env\\.(NEXT_PUBLIC_FF_[A-Z_]+), (true|false)\\)`),
      );
      expect(envVar, `${key} must be a static parseFlag call`).not.toBeNull();
      expect(envVar![2], `${key} must default to false`).toBe('false');
    });
  }

  it('SAML in particular cannot be on by default', () => {
    // The current SAML implementation does not verify assertion signatures.
    // It stays unreachable until the deferred enterprise phase replaces it.
    if (process.env.NEXT_PUBLIC_FF_SAML_SSO === undefined) {
      expect(featureFlags.samlSso).toBe(false);
    }
  });
});
