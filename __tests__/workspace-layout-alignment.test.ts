/**
 * Tab views must not re-center inside the workspace shell.
 *
 * `DashboardWorkspace` already owns the page width and gutters: a
 * `max-w-[1400px] mx-auto` column inside `clamp(16px, 3vw, 32px)` padding. Four
 * views then applied `max-w-5xl mx-auto` and their own `p-4 sm:p-6 md:p-8` on
 * top of it.
 *
 * On a 1920px screen that centred a 1024px column inside a 1400px one, leaving
 * 188px of empty background down each side — while the Intelligence tab, which
 * has no such wrapper, used the full width. The tabs visibly disagreed about
 * where the page edge was, and the empty bands read as two extra sidebars.
 *
 * Width and gutters belong to the shell. A view that sets its own re-introduces
 * the mismatch, and it is not obvious from reading that one file alone — which
 * is why this is a test and not a comment.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Roots rendered directly by DashboardWorkspace for a top-level tab. */
const TAB_VIEWS: Array<[file: string, component: string]> = [
  ['components/watchlists/WatchlistsView.tsx', 'WatchlistsView'],
  ['components/profile/ProfileSettingsView.tsx', 'ProfileSettingsView'],
  ['components/ApiUsagePanel.tsx', 'ApiUsagePanel'],
  ['components/StealStrategyPanel.tsx', 'StealStrategyPanel'],
];

/**
 * The className on the exported component's outermost element.
 *
 * Found by anchoring on the `export function` and then the first `return (` at
 * the function body's own indentation. Taking the first `return (` in the file
 * instead picks up whichever private helper happens to be declared above the
 * export, which is a different element with entirely legitimate padding.
 */
function rootClassName(source: string, componentName: string): string {
  // Strip comments first: a doc comment naming the anti-pattern would otherwise
  // match it. This repo has shipped that bug before.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const exportAt = code.search(new RegExp(`^export (?:default )?function ${componentName}\\b`, 'm'));
  if (exportAt === -1) return '';

  const body = code.slice(exportAt);
  const returnAt = body.search(/^ {2}return \(/m);
  if (returnAt === -1) return '';

  return body.slice(returnAt).match(/<div\s+className="([^"]+)"/)?.[1] ?? '';
}

describe('tab views defer to the workspace shell', () => {
  it.each(TAB_VIEWS)('%s does not re-center its own column', (file, component) => {
    const root = rootClassName(fs.readFileSync(path.resolve(file), 'utf8'), component);

    expect(root, `${file}: could not find a root element to check`).not.toBe('');
    expect(root, `${file} sets its own max-width — the shell already did`).not.toMatch(
      /\bmax-w-/,
    );
    expect(root, `${file} re-centers — nesting mx-auto inside mx-auto leaves dead columns`).not.toMatch(
      /\bmx-auto\b/,
    );
  });

  it.each(TAB_VIEWS)('%s does not add a second set of page gutters', (file, component) => {
    const root = rootClassName(fs.readFileSync(path.resolve(file), 'utf8'), component);
    // `p-4 sm:p-6 md:p-8` on top of the shell's clamp padding doubles the inset.
    // Vertical-only padding (pt-, pb-) is the view's own business.
    expect(root, `${file} adds horizontal padding the shell already applies`).not.toMatch(
      /(^|\s)(sm:|md:|lg:)?p[xl]?-\d/,
    );
  });

  it('the shell still owns the width, so removing it from views is safe', () => {
    const shell = fs.readFileSync(
      path.resolve('components/dashboard/DashboardWorkspace.tsx'),
      'utf8',
    );
    expect(shell).toMatch(/max-w-\[1400px\][^"]*mx-auto/);
    expect(shell).toContain('clamp(16px, 3vw, 32px)');
  });
});
