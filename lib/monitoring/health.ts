export type HealthStatus = 'healthy' | 'degraded' | 'stale' | 'paused';

const STALE_MS = 8 * 24 * 60 * 60 * 1000;

/** Next Monday 09:00 UTC after `from`. */
export function nextMondaySweepUtc(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(9, 0, 0, 0);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const daysUntilMon = day === 1 && from.getUTCHours() < 9
    ? 0
    : (8 - day) % 7 || 7;
  if (day === 1 && from.getUTCHours() >= 9) {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (day !== 1) {
    d.setUTCDate(d.getUTCDate() + daysUntilMon);
  }
  return d;
}

export function computeHealthStatus(input: {
  enabled: boolean;
  lastSweepAt: string | null;
  lastSucceeded?: boolean;
  now?: Date;
}): HealthStatus {
  if (!input.enabled) return 'paused';
  const now = input.now ?? new Date();
  if (!input.lastSweepAt) return 'stale';
  if (input.lastSucceeded === false) return 'degraded';
  const last = new Date(input.lastSweepAt).getTime();
  if (Number.isNaN(last) || now.getTime() - last > STALE_MS) return 'stale';
  return 'healthy';
}

export function formatRelativeSweep(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'Scheduled';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
