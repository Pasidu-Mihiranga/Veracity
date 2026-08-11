'use client';

import { useTheme } from '@/lib/theme-provider';

type Props = {
  className?: string;
  /** Match previous img height (~24px sidebar / ~32px header) */
  size?: 'sm' | 'md';
};

/**
 * Light: original logo-text PNG/AVIF.
 * Dark: dedicated PNG with navy glyphs remapped to soft ice (no CSS invert/brightness).
 */
export function BrandWordmark({ className = '', size = 'sm' }: Props) {
  const { isDark } = useTheme();
  const src = isDark ? '/logo-text-dark.png' : '/logo-text.png';
  const h = size === 'md' ? 'h-6.5' : 'h-5.5';

  return (
    <img
      src={src}
      alt="Veracity"
      width={size === 'md' ? 140 : 120}
      height={size === 'md' ? 36 : 32}
      className={`brand-logo object-left object-contain ${h} w-auto max-w-[140px] ${className}`}
      draggable={false}
    />
  );
}
