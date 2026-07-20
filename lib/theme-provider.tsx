'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
}

/** Brand: ice / cyan / navy / black / white only */
const DARK: Omit<ThemeContextValue, 'theme' | 'isDark' | 'toggle'> = {
  bg: '#070D16',
  surface: '#070D16',
  surface2: '#070D16',
  border: 'transparent',
  borderStrong: 'transparent',
  text: '#E8F4FC',
  textMuted: '#A8C0D8',
  textSubtle: '#6B849C',
};

const LIGHT: Omit<ThemeContextValue, 'theme' | 'isDark' | 'toggle'> = {
  bg: '#D6E4F0',
  surface: '#D6E4F0',
  surface2: '#D6E4F0',
  border: 'transparent',
  borderStrong: 'transparent',
  text: '#061424',
  textMuted: '#1A3554',
  textSubtle: '#2E4F72',
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  toggle: () => {},
  ...LIGHT,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('veracity-theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
  }, [theme, mounted]);

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('veracity-theme', next);
      return next;
    });
  };

  const isDark = theme === 'dark';
  const tokens = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggle, ...tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
