'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

function buildContext(theme: ThemeMode, toggle: () => void): ThemeContextValue {
  const tokens = getThemeTokens(theme);
  return {
    theme,
    isDark: theme === 'dark',
    toggle,
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
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('veracity-theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyCssVars(theme);
  }, [theme, mounted]);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('veracity-theme', next);
      return next;
    });
  };

  const value = useMemo(() => buildContext(theme, toggle), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // SSR / missing provider fallback
    return buildContext('light', () => {});
  }
  return ctx;
}
