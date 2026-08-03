/**
 * Evidence state must never be carried by colour alone.
 *
 * Colour is invisible to roughly one man in twelve, disappears in print and in
 * forced-colours mode, and means nothing to anyone who has not yet learned this
 * product's palette. The data-viz rule is explicit: a status colour ships with
 * an icon and a label, never on its own.
 *
 * Two components hand-rolled `bg-red-50 text-red-600 border-red-200` around the
 * bare word "UNSUPPORTED", and the comparison grid rendered fifteen at once —
 * which is how correct, honest output came to read as a broken screen.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function code(file: string): string {
  return fs
    .readFileSync(path.resolve(file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Everywhere an evidence state is shown to a user. */
const BADGE_CONSUMERS = [
  'components/ui/ResearchWorkflowPack.tsx',
  'components/ui/EvidenceTrail.tsx',
];

describe('the shared badge', () => {
  const badge = () => code('components/ui/EvidenceBadge.tsx');

  it('pairs every state with an icon', () => {
    for (const icon of ['CheckCircle2', 'CircleSlash', 'AlertTriangle']) {
      expect(badge()).toContain(icon);
    }
    expect(badge()).toMatch(/<Icon\s/);
  });

  it('pairs every state with words, not a code', () => {
    expect(badge()).toContain('Backed by a source');
    expect(badge()).toContain('Partly backed');
    expect(badge()).toContain('No source found');
  });

  it('says what "no source found" does not mean', () => {
    // "Unsupported" reads as "we checked and it is false". It means the opposite:
    // we could not find it. Getting this wrong turns a gap into an accusation.
    expect(badge()).toContain('not a claim that it is false');
  });

  it('takes its colours from the theme', () => {
    expect(badge()).toContain('var(--evidence-measured)');
    expect(badge()).toContain('var(--evidence-derived)');
    expect(badge()).toContain('var(--evidence-unsupported)');
  });

  it('shows a word even when compact', () => {
    // A compact badge may shorten the label. It may never drop it.
    expect(badge()).toMatch(/compact \? state\.label/);
  });
});

describe('no component rolls its own', () => {
  it.each(BADGE_CONSUMERS)('%s uses the shared badge', (file) => {
    expect(code(file)).toContain('<EvidenceBadge');
  });

  it.each(BADGE_CONSUMERS)('%s has no bare colour-only chip left', (file) => {
    const source = code(file);
    // Narrowly the evidence maps. An unrelated red chip elsewhere in the file
    // (open/closed status, say) is not this test's business — flagging it would
    // make the guard noisy and it would get deleted.
    expect(source).not.toMatch(/supportClasses\[/);
    expect(source).not.toMatch(/SUPPORT_CLASS\[/);
    expect(source).not.toMatch(/\bconst supportClasses\b/);
  });
});
