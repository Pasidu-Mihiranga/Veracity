'use client';

import { useTheme } from '@/lib/theme-provider';

export function ConfidenceBadge({ level }: { level?: string }) {
  const { isDark } = useTheme();
  if (!level) return null;
  const styles: Record<string, { color: string; bg: string; border: string }> = isDark
    ? {
        high: { color: '#00C4FF', bg: 'rgba(0,196,255,0.12)', border: 'rgba(0,196,255,0.3)' },
        medium: { color: '#3D9EFF', bg: 'rgba(61,158,255,0.12)', border: 'rgba(61,158,255,0.3)' },
        low: { color: '#6B849C', bg: 'rgba(107,132,156,0.12)', border: 'rgba(107,132,156,0.25)' },
      }
    : {
        high: { color: '#0052A3', bg: 'rgba(0,82,163,0.1)', border: 'rgba(0,82,163,0.28)' },
        medium: { color: '#1A5A9A', bg: 'rgba(26,90,154,0.1)', border: 'rgba(26,90,154,0.28)' },
        low: { color: '#2E4F72', bg: 'rgba(46,79,114,0.1)', border: 'rgba(46,79,114,0.25)' },
      };
  const s = styles[level] ?? styles.low;
  return (
    <span
      className="neu-pill text-[10px] font-mono font-medium uppercase tracking-wide px-2.5 py-0.5"
      style={{ color: s.color, background: s.bg }}
    >
      {level}
    </span>
  );
}
