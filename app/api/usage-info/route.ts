import { createClient } from '@/lib/supabase-server';
import { getConfig } from '@/lib/config';

/**
 * Public, non-secret usage/config snapshot for the API Usage tab.
 * Do not return API key values; only which integrations are configured.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  const cfg = getConfig();
  const textModel = cfg.GEMINI_MODEL || 'gemini-2.5-flash';
  const embedModel = cfg.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

  const providers = [
    { id: 'gemini', label: 'Google Gemini (LLM + JSON + classify)', kind: 'model' as const, configured: Boolean(cfg.GEMINI_API_KEY), usageNote: 'In-app: estimated $ from orchestrator RunMetrics; exact usage: Google AI Studio / Cloud billing.' },
    { id: 'embed', label: 'Gemini embeddings (recall)', kind: 'model' as const, configured: Boolean(cfg.GEMINI_API_KEY), usageNote: 'Tied to same key as text model.' },
    { id: 'serpapi', label: 'SerpAPI (web, news, trends)', kind: 'tool' as const, configured: Boolean(cfg.SERPAPI_KEY), usageNote: 'Dashboard: serpapi.com → Usage.' },
    { id: 'firecrawl', label: 'Firecrawl (scrape pages)', kind: 'tool' as const, configured: Boolean(cfg.FIRECRAWL_API_KEY), usageNote: 'Dashboard: firecrawl.dev account.' },
    { id: 'apify', label: 'Apify (Twitter/X via Tweet Scraper)', kind: 'tool' as const, configured: Boolean(cfg.APIFY_API_TOKEN), usageNote: 'Apify console → Usage / per-actor runs.' },
    { id: 'reddit', label: 'Reddit (public JSON)', kind: 'tool' as const, configured: true, usageNote: 'No token required; optional OAuth for higher rate limits.' },
    { id: 'postgres', label: 'Local PostgreSQL (DB + auth)', kind: 'platform' as const, configured: Boolean(cfg.DATABASE_URL), usageNote: 'Local Postgres via DATABASE_URL.' },
  ];

  return new Response(
    JSON.stringify({
      models: { text: textModel, embedding: embedModel, embeddingDimensions: cfg.GEMINI_EMBEDDING_DIMENSIONS },
      providers,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
