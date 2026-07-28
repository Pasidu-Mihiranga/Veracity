import { buildToolResult } from '../tools/fallback';
import type { ScrapedPage, ToolResult } from '../tools/types';
import type { AgentContext } from './types';

/** Sentinel: homepage/pricing scrape skipped because competitor/product URL is unknown. */
export const SKIPPED_INFERRED_URL = 'skip-inferred-url';

export function skippedScrapePromise(): Promise<ToolResult<ScrapedPage>> {
  return Promise.resolve(
    buildToolResult<ScrapedPage>({
      data: { url: '', title: '', markdown: '', excerpt: '' },
      status: 'failed',
      source: SKIPPED_INFERRED_URL,
    }),
  );
}

export function isUsableScrapePage(
  result: PromiseSettledResult<ToolResult<ScrapedPage>>,
): result is PromiseFulfilledResult<ToolResult<ScrapedPage>> {
  if (result.status !== 'fulfilled') return false;
  const v = result.value;
  if (v.source === SKIPPED_INFERRED_URL) return false;
  const md = v.data.markdown?.trim().length ?? 0;
  return !!v.data.url && md > 40;
}

/** Classifier / fallback strings that must never become guessed .com URLs. */
const PLACEHOLDER_COMPETITOR = new Set([
  'main competitor',
  'competitor',
  'unknown',
  'n/a',
  'na',
  'none',
  'your competitor',
  'the competitor',
]);

const PLACEHOLDER_PRODUCT = new Set([
  'the product',
  'the current product',
  'our product',
  'your product',
  'product',
  'unknown',
  'n/a',
  'na',
]);

export function isPlaceholderCompetitor(name: string | undefined | null): boolean {
  if (!name?.trim()) return true;
  return PLACEHOLDER_COMPETITOR.has(name.toLowerCase().trim());
}

export function isPlaceholderProduct(name: string | undefined | null): boolean {
  if (!name?.trim()) return true;
  return PLACEHOLDER_PRODUCT.has(name.toLowerCase().trim());
}

/**
 * Only guess https://brand.com when we have a real competitor name from classification.
 * Otherwise return null — agents should rely on SerpAPI / Reddit / HN only.
 */
export function competitorSiteUrl(ctx: Pick<AgentContext, 'competitor' | 'competitorUrl'>): string | null {
  const explicit = ctx.competitorUrl?.trim();
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;
  if (isPlaceholderCompetitor(ctx.competitor)) return null;
  const name = ctx.competitor!.trim();
  const slug = name.toLowerCase().replace(/\s+/g, '');
  if (slug.length < 2 || slug.length > 40) return null;
  if (!/^[a-z0-9]+$/.test(slug)) return null;
  return `https://${slug}.com`;
}

/**
 * Guess product homepage only for short, brand-like names (not full sentences).
 */
export function productSiteUrl(ctx: Pick<AgentContext, 'product' | 'productUrl'>): string | null {
  const explicit = ctx.productUrl?.trim();
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;
  if (isPlaceholderProduct(ctx.product)) return null;
  const name = ctx.product!.trim();
  const words = name.split(/\s+/).length;
  if (name.length > 35 || words > 4) return null;
  const slug = name.toLowerCase().replace(/\s+/g, '');
  if (slug.length < 2 || slug.length > 40) return null;
  if (!/^[a-z0-9]+$/.test(slug)) return null;
  return `https://${slug}.com`;
}

// ── Tracking query parameters ───────────────────────────────────────────────
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
  'referrer',
  'redirect_url',
  'mc_eid',
  '_ga',
]);

/**
 * Strips tracking parameters, affiliate tokens, and fragment hashes from URLs.
 */
export function cleanCanonicalUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    const cleanedParams = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      if (!TRACKING_PARAMS.has(key.toLowerCase()) && !key.toLowerCase().startsWith('utm_')) {
        cleanedParams.append(key, val);
      }
    });

    parsed.search = cleanedParams.toString();
    parsed.hash = '';

    let finalUrl = parsed.toString();
    if (parsed.pathname === '/' && !parsed.search) {
      finalUrl = finalUrl.replace(/\/$/, '');
    }
    return finalUrl;
  } catch {
    return trimmed;
  }
}

/**
 * Performs a fast HTTP HEAD request to check if a source URL is live (returns 2xx/3xx status).
 */
export async function pingSourceUrl(url: string, timeoutMs: number = 1000): Promise<boolean> {
  const cleaned = cleanCanonicalUrl(url);
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(cleaned, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'VeracityBot/1.0 (Growth Intelligence Platform; +https://veracity.ai)',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok || (res.status >= 300 && res.status < 400)) {
      return true;
    }

    if (res.status === 405) {
      const getController = new AbortController();
      const getTimer = setTimeout(() => getController.abort(), timeoutMs);
      const getRes = await fetch(cleaned, {
        method: 'GET',
        headers: {
          'User-Agent': 'VeracityBot/1.0 (Growth Intelligence Platform; +https://veracity.ai)',
        },
        signal: getController.signal,
      }).finally(() => clearTimeout(getTimer));

      return getRes.ok || (getRes.status >= 300 && getRes.status < 400);
    }

    return false;
  } catch {
    return false;
  }
}
