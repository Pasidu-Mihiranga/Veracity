'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Digest } from '@/lib/intelligence/digest';
import type { EvidenceSpanView } from '@/components/artifacts/EvidenceDrawer';

/**
 * Loads the returning-user dashboard and, on demand, the evidence behind any
 * item on it.
 *
 * The last-visit marker lives in `localStorage` rather than on the server, and
 * is only advanced once the user has actually *seen* the dashboard. Advancing
 * it on load would mean a user who opens the project and immediately navigates
 * away loses that week's changes — a monitoring product that can silently drop
 * the thing it exists to report is worse than one that repeats itself.
 */

export interface DashboardData {
  projectName: string;
  digest: Digest;
  staleSources: Array<{ url: string; detail?: string }>;
  sourcesChecked: number;
  unchangedCount: number;
}

const LAST_VISIT_PREFIX = 'veracity:last-visit:';

function readLastVisit(projectId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(`${LAST_VISIT_PREFIX}${projectId}`);
  } catch {
    // Private browsing and blocked storage are normal, not exceptional. Falling
    // back to the server default is better than failing the dashboard.
    return null;
  }
}

function writeLastVisit(projectId: string, iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LAST_VISIT_PREFIX}${projectId}`, iso);
  } catch {
    /* ignore — the dashboard still works, it just repeats itself next time */
  }
}

export function useProjectDashboard(projectId: string | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [evidence, setEvidence] = useState<EvidenceSpanView[] | null>(null);
  const [evidenceClaim, setEvidenceClaim] = useState('');
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const since = readLastVisit(projectId);
      const url = new URL(`/api/projects/${projectId}/dashboard`, window.location.origin);
      if (since) url.searchParams.set('since', since);

      const response = await fetch(url.toString());
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error ?? 'Could not load the dashboard');
        return;
      }

      setData(payload.data as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Mark the dashboard as read.
   *
   * Called by the view when the user has had a chance to look, not on fetch —
   * see the note above about silently dropping a week of changes.
   */
  const markSeen = useCallback(() => {
    if (!projectId || !data) return;
    writeLastVisit(projectId, data.digest.periodEnd);
  }, [projectId, data]);

  const openEvidence = useCallback(async (spanIds: string[], claim: string) => {
    if (spanIds.length === 0) return;

    setEvidenceClaim(claim);
    setEvidenceLoading(true);
    setEvidence(null);

    try {
      const response = await fetch(`/api/evidence?ids=${encodeURIComponent(spanIds.join(','))}`);
      const payload = await response.json();

      if (!response.ok) {
        // An empty drawer with an explicit message beats a spinner that never
        // resolves — the user asked to see proof and deserves an answer either way.
        setEvidence([]);
        return;
      }

      setEvidence(payload.data.spans as EvidenceSpanView[]);
    } catch {
      setEvidence([]);
    } finally {
      setEvidenceLoading(false);
    }
  }, []);

  const closeEvidence = useCallback(() => {
    setEvidence(null);
    setEvidenceClaim('');
  }, []);

  return {
    data,
    loading,
    error,
    reload: load,
    markSeen,
    evidence,
    evidenceClaim,
    evidenceLoading,
    evidenceOpen: evidence !== null || evidenceLoading,
    openEvidence,
    closeEvidence,
  };
}
