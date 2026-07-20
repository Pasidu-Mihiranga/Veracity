'use client';

export interface ThemeValues {
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  background: string;
}

export function useThemeColors(): ThemeValues {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return LIGHT_DEFAULTS;
  }

  const style = getComputedStyle(document.documentElement);

  function cssVar(name: string, fallback: string): string {
    const val = style.getPropertyValue(name).trim();
    return val || fallback;
  }

  return {
    surface:    cssVar('--card', '#D6E4F0'),
    surface2:   cssVar('--muted', '#D6E4F0'),
    text:       cssVar('--foreground', '#061424'),
    textMuted:  cssVar('--muted-foreground', '#1A3554'),
    textSubtle: cssVar('--foreground-subtle', '#2E4F72'),
    border:     'transparent',
    background: cssVar('--background', '#D6E4F0'),
  };
}

const LIGHT_DEFAULTS: ThemeValues = {
  surface:    '#D6E4F0',
  surface2:   '#D6E4F0',
  text:       '#061424',
  textMuted:  '#1A3554',
  textSubtle: '#2E4F72',
  border:     'transparent',
  background: '#D6E4F0',
};
