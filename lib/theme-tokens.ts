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

export const THEME_LIGHT: ThemeTokens = {
  background: '#D6E4F0',
  surface: '#E8F4FC',
  surfaceRaised: '#F4F9FD',
  foreground: '#061424',
  foregroundMuted: '#1A3554',
  foregroundSubtle: '#2E4F72',
  accent: '#0052A3',
  accentSecondary: '#1A5A9A',
  accentFg: '#FFFFFF',
  border: 'rgba(6, 20, 36, 0.10)',
  borderStrong: 'rgba(6, 20, 36, 0.18)',
  success: '#0F766E',
  warning: '#B45309',
  danger: '#B91C1C',
  chart1: '#0052A3',
  chart2: '#0E7490',
  chart3: '#1D4ED8',
  chart4: '#0369A1',
  chart5: '#64748B',
  chartTrack: 'rgba(6, 20, 36, 0.08)',
};

export const THEME_DARK: ThemeTokens = {
  background: '#070D16',
  surface: '#0B1420',
  surfaceRaised: '#0F1A28',
  foreground: '#F2F7FC',
  foregroundMuted: '#C5D6E8',
  foregroundSubtle: '#9BB0C6',
  accent: '#00C4FF',
  accentSecondary: '#3D9EFF',
  accentFg: '#061424',
  border: 'rgba(168, 192, 216, 0.14)',
  borderStrong: 'rgba(168, 192, 216, 0.28)',
  success: '#2DD4BF',
  warning: '#FBBF24',
  danger: '#FCA5A5',
  chart1: '#00C4FF',
  chart2: '#38BDF8',
  chart3: '#60A5FA',
  chart4: '#22D3EE',
  chart5: '#8AA0B5',
  chartTrack: 'rgba(168, 192, 216, 0.12)',
};

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
