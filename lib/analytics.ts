/**
 * Lightweight client analytics until PostHog (or similar) is wired.
 * Events are logged + kept in localStorage for later flush.
 */
export function trackEvent(event: string, props: Record<string, unknown> = {}): void {
  const payload = { event, ...props, ts: Date.now() };
  try {
    console.info(JSON.stringify({ type: 'analytics', ...payload }));
  } catch {
    // ignore
  }
  if (typeof window === 'undefined') return;
  try {
    const key = 'veracity_analytics';
    const raw = window.localStorage.getItem(key);
    const prev: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
    const next = Array.isArray(prev) ? [...prev, payload].slice(-100) : [payload];
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // private mode / quota — non-fatal
  }
}
