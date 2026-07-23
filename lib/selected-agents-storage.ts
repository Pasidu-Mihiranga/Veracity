import type { Domain } from '@/lib/domain-meta';
import { ALL_DOMAINS } from '@/lib/domain-meta';

const KEY_PREFIX = 'veracity:selectedAgents:';
const FORCE_FULL_PREFIX = 'veracity:forceFullSweep:';

export function defaultSelectedAgents(): Record<Domain, boolean> {
  return Object.fromEntries(
    ALL_DOMAINS.map((d) => [d, d !== 'mirofish-live']),
  ) as Record<Domain, boolean>;
}

export function loadSelectedAgents(sessionId: string | null): Record<Domain, boolean> {
  const base = defaultSelectedAgents();
  if (!sessionId || typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${sessionId}`);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<Domain, boolean>>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

export function saveSelectedAgents(
  sessionId: string | null,
  selected: Record<Domain, boolean>,
): void {
  if (!sessionId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${sessionId}`, JSON.stringify(selected));
  } catch {
    // ignore quota / private mode
  }
}

export function loadForceFullSweep(sessionId: string | null): boolean {
  if (!sessionId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${FORCE_FULL_PREFIX}${sessionId}`) === '1';
  } catch {
    return false;
  }
}

export function saveForceFullSweep(sessionId: string | null, value: boolean): void {
  if (!sessionId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${FORCE_FULL_PREFIX}${sessionId}`, value ? '1' : '0');
  } catch {
    // ignore
  }
}
