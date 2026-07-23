'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';

export function AppErrorBoundary({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <div className="results-panel p-5 sm:p-6 flex items-start gap-4" style={{ background: 'var(--surface)' }}>
          <div className="neu-pill-negative w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="ui-section-label mb-1" style={{ color: 'var(--status-fail)' }}>
              {label} failed to render
            </p>
            <p className="ui-body-sm" style={{ color: 'var(--foreground-muted)' }}>
              The rest of the workspace is still available. Reload just this panel.
            </p>
          </div>
          <button
            type="button"
            onClick={resetErrorBoundary}
            className="neu-extruded-sm rounded-xl px-3 py-2 ui-mono inline-flex items-center gap-2 shrink-0"
            style={{ color: 'var(--accent)', fontSize: 11 }}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
