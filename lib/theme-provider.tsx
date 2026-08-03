'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getThemeTokens,
  tokensToCssVars,
  type ThemeMode,
  type ThemeTokens,
} from '@/lib/theme-tokens';

type ThemeContextValue = ThemeTokens & {
  theme: ThemeMode;
  isDark: boolean;
  toggle: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  /**
   * Pin the theme for one route without changing what the user chose.
   * Pass null to release. See `useForcedTheme`.
   */
  setForcedTheme: (mode: ThemeMode | null) => void;
  /** Compat aliases used across existing UI */
  bg: string;
  surface2: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  borderStrong: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyCssVars(mode: ThemeMode) {
  const root = document.documentElement;
  const tokens = getThemeTokens(mode);
  const vars = tokensToCssVars(tokens);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.classList.toggle('light', mode === 'light');
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

function buildContext(
  theme: ThemeMode,
  toggle: () => void,
  setThemeMode: (mode: ThemeMode) => void,
  setForcedTheme: (mode: ThemeMode | null) => void,
): ThemeContextValue {
  const tokens = getThemeTokens(theme);
  return {
    theme,
    isDark: theme === 'dark',
    toggle,
    setThemeMode,
    setForcedTheme,
    ...tokens,
    bg: tokens.background,
    surface2: tokens.surfaceRaised,
    text: tokens.foreground,
    textMuted: tokens.foregroundMuted,
    textSubtle: tokens.foregroundSubtle,
    borderStrong: tokens.borderStrong,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  /** What the user chose. Persisted, and never altered by a forced route. */
  const [theme, setTheme] = useState<ThemeMode>('light');
  /** What the current route demands, if anything. Never persisted. */
  const [forced, setForced] = useState<ThemeMode | null>(null);
  const [mounted, setMounted] = useState(false);

  const effective = forced ?? theme;

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('veracity-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyCssVars(effective);
  }, [effective, mounted]);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('veracity-theme', next);
      return next;
    });
  };

  const setThemeMode = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem('veracity-theme', mode);
  };

  // Identity must be stable: `useForcedTheme` depends on it, and a new function
  // each render would release and re-apply the lock in a loop.
  const setForcedTheme = useCallback((mode: ThemeMode | null) => setForced(mode), []);

  const value = useMemo(
    () => buildContext(effective, toggle, setThemeMode, setForcedTheme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effective, setForcedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // SSR / missing provider fallback
    return buildContext('light', () => {}, () => {}, () => {});
  }
  return ctx;
}

/**
 * Pin the theme for as long as a component is mounted.
 *
 * The sign-in screen is art-directed against a dark backdrop, so it renders
 * dark regardless of preference. That must not silently rewrite what the user
 * chose for the app itself — someone who works in light mode should sign in on
 * a dark page and land in a light workspace.
 *
 * So this changes only the effective theme, never `localStorage`, and releases
 * on unmount.
 */
export function useForcedTheme(mode: ThemeMode): void {
  const { setForcedTheme } = useTheme();

  useEffect(() => {
    setForcedTheme(mode);
    return () => setForcedTheme(null);
  }, [mode, setForcedTheme]);
}
