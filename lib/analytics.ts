let posthogLoaded = false;

async function ensurePostHog() {
  if (typeof window === 'undefined' || posthogLoaded) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  const posthog = (await import('posthog-js')).default;
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    autocapture: false,
    persistence: 'localStorage',
  });
  posthogLoaded = true;
}

export function trackEvent(event: string, props: Record<string, unknown> = {}): void {
  const payload = { event, ...props, ts: Date.now() };
  try {
    console.info(JSON.stringify({ type: 'analytics', ...payload }));
  } catch {
    // ignore
  }
  if (typeof window === 'undefined') return;
  void ensurePostHog().then(async () => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const posthog = (await import('posthog-js')).default;
    posthog.capture(event, props);
  }).catch(() => {});
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
