'use client';

/** Lightweight placeholder while heavy panels / charts lazy-load. */
export function PanelSkeleton({
  label = 'Loading…',
  rows = 3,
  height = 120,
}: {
  label?: string;
  rows?: number;
  height?: number;
}) {
  return (
    <div
      className="veracity-card p-5 animate-pulse"
      style={{ minHeight: height }}
      aria-busy="true"
      aria-label={label}
    >
      <div
        className="h-3 w-32 rounded mb-4"
        style={{ background: 'var(--muted, #e4e4e7)' }}
      />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 rounded mb-2.5"
          style={{
            width: `${88 - i * 12}%`,
            background: 'var(--muted, #e4e4e7)',
            opacity: 0.7 - i * 0.12,
          }}
        />
      ))}
    </div>
  );
}
