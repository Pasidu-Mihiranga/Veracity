'use client';

/**
 * How well evidence backs a claim — the one badge for it, everywhere.
 *
 * The rule this exists to enforce: **a status colour never carries meaning
 * alone.** Colour is invisible to roughly one man in twelve, disappears in
 * print and in forced-colours mode, and means nothing to someone who has not
 * yet learned this product's palette.
 *
 * So every state ships an icon *and* a word. Two components previously
 * hand-rolled `bg-red-50 text-red-600 border-red-200` with only the word
 * "UNSUPPORTED" inside — and the comparison grid rendered fifteen of them at
 * once, which is how correct, honest output came to read as a broken screen.
 *
 * Colours come from `--evidence-*`, so light and dark stay in step and a palette
 * change reaches every badge at once.
 */

import { CheckCircle2, CircleSlash, AlertTriangle } from 'lucide-react';

export type SupportLevel = 'supported' | 'weakly-supported' | 'unsupported';

const STATES: Record<
  SupportLevel,
  { label: string; title: string; icon: typeof CheckCircle2; color: string }
> = {
  supported: {
    label: 'Backed by a source',
    title: 'We found this stated in a source, and stored the exact sentence.',
    icon: CheckCircle2,
    color: 'var(--evidence-measured)',
  },
  'weakly-supported': {
    label: 'Partly backed',
    title: 'A source points this way, but not clearly enough to rely on alone.',
    icon: AlertTriangle,
    color: 'var(--evidence-derived)',
  },
  unsupported: {
    label: 'No source found',
    title:
      'Nothing we read establishes this. It is not a claim that it is false — we simply could not find it.',
    icon: CircleSlash,
    color: 'var(--evidence-unsupported)',
  },
};

export function EvidenceBadge({
  level,
  compact = false,
}: {
  level: SupportLevel;
  /** Icon plus a shortened word, for dense tables. Never icon alone. */
  compact?: boolean;
}) {
  const state = STATES[level];
  const Icon = state.icon;

  return (
    <span
      title={state.title}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{
        color: state.color,
        borderColor: 'color-mix(in srgb, currentColor 30%, transparent)',
        background: 'color-mix(in srgb, currentColor 8%, transparent)',
      }}
    >
      <Icon size={12} className="shrink-0" aria-hidden />
      {compact ? state.label.split(' ')[0] : state.label}
    </span>
  );
}
