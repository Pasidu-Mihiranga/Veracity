import { NextRequest, NextResponse } from 'next/server';
import { generateHuggingFaceJson } from '@/lib/agents/gemini';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import type { UserMemory, MemoryFact } from '@/lib/memory';

export const runtime = 'nodejs';

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))];
}

const EMPTY_MEMORY: UserMemory = {
  role: null,
  company: null,
  products: [],
  competitors: [],
  interests: [],
  facts: [],
  raw_summary: null,
  updated_at: new Date().toISOString(),
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ memory: EMPTY_MEMORY }, { status: 401 });

  const { rows } = await query(
    `SELECT role, company, products, competitors, interests, facts, raw_summary, updated_at
     FROM user_memory WHERE user_id = $1 LIMIT 1`,
    [user.id],
  );
  const data = rows[0];
  if (!data) return NextResponse.json({ memory: EMPTY_MEMORY });

  return NextResponse.json({
    memory: {
      role: data.role ?? null,
      company: data.company ?? null,
      products: data.products ?? [],
      competitors: data.competitors ?? [],
      interests: data.interests ?? [],
      facts: (data.facts as MemoryFact[]) ?? [],
      raw_summary: data.raw_summary ?? null,
      updated_at: data.updated_at,
    } satisfies UserMemory,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userQuery, assistantAnswer, existingMemory } = await req.json() as {
      sessionId: string;
      userQuery: string;
      assistantAnswer: string;
      existingMemory: UserMemory;
    };

    if (!userQuery?.trim()) {
      return NextResponse.json({ ok: true });
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

    const existingSummary = existingMemory.raw_summary
      ? `Existing memory about this user:\n${existingMemory.raw_summary}\nKnown products: ${existingMemory.products.join(', ') || 'none'}\nKnown competitors: ${existingMemory.competitors.join(', ') || 'none'}`
      : 'No prior memory about this user.';

    const systemPrompt = `You are a memory extraction system for a growth intelligence assistant.
Your job is to extract durable facts about the USER from their explicit query text ONLY — NEVER from external research subjects.

Extract ONLY facts where the user explicitly states something about THEMSELVES:
- Their role or job title (e.g. "I am VP of Product")
- Their own company or product (e.g. "I work at Vector Agents", "My company is...")
- Competitors they explicitly state they track (e.g. "We compete with Clay")

CRITICAL STRICT RULE:
Do NOT extract third-party companies or research subjects (such as Lilian, Notion, Linear, Clay) as the user's company UNLESS the user explicitly wrote "I work at..." or "my company is...". If the user asks a question about a company (e.g. "Is Lilian competitive?" or "What is Clay's pricing?"), return null for company and do NOT extract it!`;

    const userPrompt = `${existingSummary}

Latest user prompt:
"${userQuery}"

Return JSON with this exact shape:
{
  "role": string | null,
  "company": string | null,
  "new_products": string[],
  "new_competitors": string[],
  "new_interests": string[],
  "new_facts": string[],
  "summary_update": string
}`;

    const parsed = await generateHuggingFaceJson<Record<string, unknown>>(systemPrompt, userPrompt, {
      maxNewTokens: 512,
      temperature: 0.1,
    }).catch(() => ({} as Record<string, unknown>));

    const mergedProducts = dedupe([...existingMemory.products, ...((parsed.new_products as string[]) ?? [])]);
    const mergedCompetitors = dedupe([...existingMemory.competitors, ...((parsed.new_competitors as string[]) ?? [])]);
    const mergedInterests = dedupe([...existingMemory.interests, ...((parsed.new_interests as string[]) ?? [])]);

    const newFacts: MemoryFact[] = ((parsed.new_facts as string[]) ?? [])
      .filter(Boolean)
      .map(fact => ({ fact, source_session: sessionId, created_at: new Date().toISOString() }));

    const mergedFacts = [...existingMemory.facts, ...newFacts].slice(-30);

    await query(
      `INSERT INTO user_memory (user_id, role, company, products, competitors, interests, facts, raw_summary, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now())
       ON CONFLICT (user_id) DO UPDATE SET
         role = COALESCE(EXCLUDED.role, user_memory.role),
         company = COALESCE(EXCLUDED.company, user_memory.company),
         products = EXCLUDED.products,
         competitors = EXCLUDED.competitors,
         interests = EXCLUDED.interests,
         facts = EXCLUDED.facts,
         raw_summary = COALESCE(EXCLUDED.raw_summary, user_memory.raw_summary),
         updated_at = now()`,
      [
        user.id,
        parsed.role ?? existingMemory.role,
        parsed.company ?? existingMemory.company,
        mergedProducts,
        mergedCompetitors,
        mergedInterests,
        JSON.stringify(mergedFacts),
        (parsed.summary_update as string | undefined) ?? existingMemory.raw_summary,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (
      msg.includes('429') ||
      lower.includes('resource_exhausted') ||
      lower.includes('rate') ||
      lower.includes('gemini') ||
      lower.includes('hugging face')
    ) {
      return NextResponse.json({ ok: true, skipped: 'rate_limited' });
    }
    console.error('memory route error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
