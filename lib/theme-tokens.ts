/**
 * Single source of truth for Veracity theme (colors + type).
 * Applied as CSS variables by ThemeProvider — prefer var(--*) in UI, not hardcoded hex.
 */

export type ThemeMode = 'dark' | 'light';

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceRaised: string;
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  accent: string;
  accentSecondary: string;
  accentFg: string;
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  danger: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chartTrack: string;
};

/**
 * Light theme — neutral chrome, colour reserved for meaning.
 *
 * The previous palette had a `#C9D9E8` pale-blue page plane, which tinted every
 * surface and made the whole app read as washed out. Structure is greyscale now;
 * the only colour is interactive accent and the evidence states below.
 *
 * `foregroundSubtle` was `#3D5A78`, then briefly `#94A3B8` — that second value
 * measures **2.56:1** on white, under the 4.5:1 floor for body text, and is the
 * literal reason hint text was hard to read. `#64748B` clears it at 4.76:1.
 */
export const THEME_LIGHT: ThemeTokens = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F5F9',
  foreground: '#0F172A',        // 17.85:1 on white
  foregroundMuted: '#475569',   //  7.58:1
  foregroundSubtle: '#64748B',  //  4.76:1 — the readability fix
  accent: '#2A78D6',
  accentSecondary: '#3987E5',
  accentFg: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  success: '#047857',
  warning: '#B45309',
  danger: '#B91C1C',
  // Categorical slots in validated order — blue, orange, aqua, yellow, magenta.
  // Every slot used to be a shade of blue, which is why multi-series charts came
  // out looking like one colour. Assign in order; never cycle. Past slot 3 the
  // all-pairs colourblind floors cannot be cleared, so cap series at three for
  // scatter/bubble forms and fold the rest into "Other".
  chart1: '#2A78D6',
  chart2: '#EB6834',
  chart3: '#1BAF7A',
  chart4: '#EDA100',
  chart5: '#E87BA4',
  chartTrack: '#EFF3F8',
};

/**
 * Dark theme — the same roles stepped for a dark surface, not an inverted flip.
 */
export const THEME_DARK: ThemeTokens = {
  background: '#0B1120',
  surface: '#111827',
  surfaceRaised: '#1B2536',
  foreground: '#F8FAFC',        // 16.96:1 on the dark card
  foregroundMuted: '#94A3B8',   //  6.92:1
  foregroundSubtle: '#94A3B8',  //  #64748B measures 3.73:1 here — too low
  accent: '#3987E5',
  accentSecondary: '#60A5FA',
  accentFg: '#0B1120',
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  chart1: '#3987E5',
  chart2: '#D95926',
  chart3: '#199E70',
  chart4: '#C98500',
  chart5: '#D55181',
  chartTrack: '#1E293B',
};

/**
 * Evidence state — the product's whole premise, so it gets the colour budget.
 *
 * Separate ink and fill steps on purpose. Ink is for text and badges and clears
 * WCAG 4.5:1 on both surfaces; fill is for chart marks, where the gate is
 * colourblind separation rather than text contrast.
 *
 * **A status colour never carries meaning alone.** Every one of these ships with
 * an icon and a word. A bare red chip — which is what the comparison grid used to
 * render, fifteen at a time — is the anti-pattern this exists to stop.
 */
export const EVIDENCE_STATE = {
  light: {
    measuredInk: '#047857',
    derivedInk: '#B45309',
    unsupportedInk: '#B91C1C',
    measuredFill: '#0CA30C',
    derivedFill: '#FAB219',
    unsupportedFill: '#D03B3B',
  },
  dark: {
    measuredInk: '#34D399',    // 9.23:1
    derivedInk: '#FBBF24',     // 10.63:1
    unsupportedInk: '#F87171', // 6.41:1
    measuredFill: '#0CA30C',
    derivedFill: '#FAB219',
    unsupportedFill: '#D03B3B',
  },
} as const;

/** Map tokens → CSS custom properties on :root / .dark */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--background': tokens.background,
    '--surface': tokens.surface,
    '--surface-raised': tokens.surfaceRaised,
    '--foreground': tokens.foreground,
    '--foreground-muted': tokens.foregroundMuted,
    '--foreground-subtle': tokens.foregroundSubtle,
    '--muted': tokens.surface,
    '--muted-foreground': tokens.foregroundMuted,
    '--accent': tokens.accent,
    '--accent-secondary': tokens.accentSecondary,
    '--accent-fg': tokens.accentFg,
    '--accent-cyan': tokens.accent,
    '--border': tokens.border,
    '--border-strong': tokens.borderStrong,
    '--card': tokens.surface,
    '--card-hover': tokens.surfaceRaised,
    '--status-ok': tokens.success,
    '--status-warn': tokens.warning,
    '--status-fail': tokens.danger,
    '--chart-1': tokens.chart1,
    '--chart-2': tokens.chart2,
    '--chart-3': tokens.chart3,
    '--chart-4': tokens.chart4,
    '--chart-5': tokens.chart5,
    '--chart-track': tokens.chartTrack,
    '--placeholder': tokens.foregroundSubtle,
    ...evidenceStateVars(tokens === THEME_DARK ? 'dark' : 'light'),
  };
}

/** Evidence-state colours as CSS variables, so components never hardcode them. */
function evidenceStateVars(mode: ThemeMode): Record<string, string> {
  const s = EVIDENCE_STATE[mode];
  return {
    '--evidence-measured': s.measuredInk,
    '--evidence-derived': s.derivedInk,
    '--evidence-unsupported': s.unsupportedInk,
    '--evidence-measured-fill': s.measuredFill,
    '--evidence-derived-fill': s.derivedFill,
    '--evidence-unsupported-fill': s.unsupportedFill,
  };
}

export function getThemeTokens(mode: ThemeMode): ThemeTokens {
  return mode === 'dark' ? THEME_DARK : THEME_LIGHT;
}

export const CHART_CSS = {
  1: 'var(--chart-1)',
  2: 'var(--chart-2)',
  3: 'var(--chart-3)',
  4: 'var(--chart-4)',
  5: 'var(--chart-5)',
  track: 'var(--chart-track)',
} as const;
