/**
 * A forced route theme must not become the user's saved theme.
 *
 * The sign-in screen renders dark whatever the user prefers, because it is
 * art-directed against a dark backdrop. The failure that matters is subtle: if
 * forcing also persisted, then signing in would silently switch a light-mode
 * user's whole workspace to dark, and they would have no idea what changed it.
 *
 * There is no jsdom or Testing Library in this project, and adding both to
 * assert one hook is not worth it — so this checks the source, in the same
 * style as the other guard tests here. It catches the regression that actually
 * threatens this: someone making the forced path "consistent" by persisting it.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Source with comments removed — a doc comment must not satisfy a grep. */
function code(file: string): string {
  return fs
    .readFileSync(path.resolve(file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('forced theme', () => {
  const provider = () => code('lib/theme-provider.tsx');

  it('never writes the forced value to storage', () => {
    // Only the two deliberate user actions may persist.
    const writes = provider().match(/localStorage\.setItem\([^)]*\)/g) ?? [];
    expect(writes).toHaveLength(2);

    const setForced = provider().match(/const setForcedTheme = [\s\S]*?\n/)?.[0] ?? '';
    expect(setForced).not.toContain('localStorage');
  });

  it('releases the lock when the route unmounts', () => {
    // Without the cleanup, the workspace stays dark after sign-in and looks
    // like the preference changed itself.
    const hook = provider().match(/export function useForcedTheme[\s\S]*?\n}/)?.[0] ?? '';
    expect(hook, 'useForcedTheme not found').not.toBe('');
    expect(hook).toMatch(/return\s*\(\)\s*=>\s*setForcedTheme\(null\)/);
  });

  it('lets the forced value win over the saved one while mounted', () => {
    expect(provider()).toMatch(/const effective = forced \?\? theme/);
    expect(provider()).toMatch(/applyCssVars\(effective\)/);
  });

  it('keeps the sign-in page pinned to dark', () => {
    const auth = code('app/auth/page.tsx');
    expect(auth).toContain("useForcedTheme('dark')");
    // The toggle was removed with the force: a control that cannot change the
    // page it sits on is worse than no control.
    expect(auth).not.toContain('auth-theme-toggle');
  });

  it('has dark styling for the sign-in page to fall back on', () => {
    // `.auth-page` is hardcoded light hex, not tokens, so the root class alone
    // does nothing without these rules.
    expect(fs.readFileSync(path.resolve('app/globals.css'), 'utf8')).toContain('.dark .auth-page {');
  });
});
