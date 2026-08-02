'use client';

import React from 'react';

/**
 * Rendered in place of an analyst judgment (category outlook, buyer sentiment,
 * willingness to pay, overall risk) when synthesis did not complete.
 *
 * These fields used to fall back to a default — 'emerging', 'mixed',
 * 'mid-market', 'medium' — which put a confident-looking badge on the artifact
 * describing an assessment the system never actually made. An absent judgment
 * has to look absent.
 */
export function UnassessedBadge({ label }: { label: string }) {
  return (
    <span
      className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border"
      title="Synthesis did not complete for this domain, so this judgment was not assessed."
    >
      {label} unavailable
    </span>
  );
}
