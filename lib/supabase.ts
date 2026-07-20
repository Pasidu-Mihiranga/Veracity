import { query } from '@/lib/db';

const CACHE_TTL: Record<string, number> = {
  serpapi_search: 30,
  serpapi_news: 15,
  serpapi_trends: 60,
  reddit: 20,
  hn: 30,
  firecrawl: 120,
};

export async function getCached(tool: string, cacheKey: string): Promise<unknown | null> {
  try {
    const ttlMinutes = CACHE_TTL[tool] ?? 30;
    const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();
    const { rows } = await query<{ result: unknown }>(
      `SELECT result FROM signal_cache
       WHERE cache_key = $1 AND tool = $2 AND created_at >= $3::timestamptz
       ORDER BY created_at DESC
       LIMIT 1`,
      [cacheKey, tool, cutoff],
    );
    return rows[0]?.result ?? null;
  } catch {
    return null;
  }
}

export async function setCache(tool: string, cacheKey: string, result: unknown): Promise<void> {
  try {
    await query(
      `INSERT INTO signal_cache (cache_key, tool, result, created_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (cache_key, tool)
       DO UPDATE SET result = EXCLUDED.result, created_at = now()`,
      [cacheKey, tool, JSON.stringify(result)],
    );
  } catch {
    // Cache write failure is non-fatal
  }
}

export async function saveConversation(
  sessionId: string,
  messages: { role: string; content: string }[],
): Promise<void> {
  try {
    await query(
      `INSERT INTO conversations (session_id, messages, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (session_id)
       DO UPDATE SET messages = EXCLUDED.messages, updated_at = now()`,
      [sessionId, JSON.stringify(messages)],
    );
  } catch {
    // Non-fatal
  }
}

export async function getConversation(
  sessionId: string,
): Promise<{ role: string; content: string }[] | null> {
  try {
    const { rows } = await query<{ messages: { role: string; content: string }[] }>(
      `SELECT messages FROM conversations WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    return rows[0]?.messages ?? null;
  } catch {
    return null;
  }
}
