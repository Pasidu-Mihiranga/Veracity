import React from 'react';
import { FolderOpen, LucideIcon } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  const { isDark, textMuted, surface2, border, accent } = useTheme();

  return (
    <div
      role="region"
      aria-label={title}
      className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl border transition-all ${className}`}
      style={{
        backgroundColor: surface2,
        borderColor: border,
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
        style={{
          backgroundColor: isDark ? 'rgba(0, 163, 224, 0.12)' : 'rgba(0, 163, 224, 0.08)',
          color: accent,
        }}
      >
        <Icon className="w-7 h-7" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold mb-1" style={{ color: isDark ? '#FFFFFF' : '#061424' }}>
        {title}
      </h3>

      <p className="text-sm max-w-sm mb-6 leading-relaxed" style={{ color: textMuted }}>
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
          style={{
            backgroundColor: accent,
            color: '#FFFFFF',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
