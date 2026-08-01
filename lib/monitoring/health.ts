export type HealthStatus = 'healthy' | 'degraded' | 'stale' | 'paused';
export type WatchlistCadence = 'daily' | 'twice_weekly' | 'weekly' | 'monthly';

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function nextScheduledSweepUtc(
  cadence: WatchlistCadence,
  from: Date = new Date(),
): Date {
  if (cadence === 'weekly') return nextMondaySweepUtc(from);
  const next = new Date(from);
  next.setUTCHours(9, 0, 0, 0);
  if (cadence === 'daily') {
    if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (cadence === 'twice_weekly') {
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = new Date(next);
      candidate.setUTCDate(candidate.getUTCDate() + offset);
      if (
        (candidate.getUTCDay() === 1 || candidate.getUTCDay() === 4)
        && candidate.getTime() > from.getTime()
      ) {
        return candidate;
      }
    }
  }
  next.setUTCMonth(next.getUTCMonth() + 1, 1);
  return next;
}

export function computeHealthStatus(input: {
  enabled: boolean;
  lastSweepAt: string | null;
  lastSucceeded?: boolean;
  now?: Date;
  cadence?: WatchlistCadence;
}): HealthStatus {
  if (!input.enabled) return 'paused';
  const now = input.now ?? new Date();
  if (!input.lastSweepAt) return 'stale';
  if (input.lastSucceeded === false) return 'degraded';
  const last = new Date(input.lastSweepAt).getTime();
  const staleAfter = {
    daily: 2 * DAY_MS,
    twice_weekly: 5 * DAY_MS,
    weekly: 8 * DAY_MS,
    monthly: 35 * DAY_MS,
  }[input.cadence ?? 'weekly'];
  if (Number.isNaN(last) || now.getTime() - last > staleAfter) return 'stale';
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
