import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

interface UserMemoryRow {
  company: string | null;
  role: string | null;
  products: string[] | null;
  competitors: string[] | null;
  interests: string[] | null;
}

interface ProjectRow {
  id: string;
  name: string;
  product: string;
  competitors: string[] | null;
  updated_at: Date;
}

interface ChangeEventRow {
  id: string;
  event_type: string;
  before_value: string | null;
  after_value: string | null;
  materiality: number;
  materiality_reason: string;
  observed_at: Date;
  project_name: string;
  product: string;
  entity_name: string;
}

interface SessionRow {
  id: string;
  title: string;
  updated_at: Date;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  try {
    // 1. Fetch user preferences & memory
    const { rows: memRows } = await query<UserMemoryRow>(
      `SELECT company, role, products, competitors, interests 
       FROM user_memory 
       WHERE user_id = $1 
       LIMIT 1`,
      [user.id],
    );
    const userPref = memRows[0] || null;
    const company = userPref?.company || userPref?.products?.[0] || null;
    const competitors = userPref?.competitors || [];

    // 2. Fetch user's active market projects
    const { rows: projects } = await query<ProjectRow>(
      `SELECT id, name, product, competitors, updated_at 
       FROM market_projects 
       WHERE user_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 10`,
      [user.id],
    );

    // 3. Fetch real change events observed in the last 2 days (48 hours)
    const { rows: changeEvents } = await query<ChangeEventRow>(
      `SELECT 
        ce.id,
        ce.event_type,
        ce.before_value,
        ce.after_value,
        ce.materiality,
        ce.materiality_reason,
        ce.observed_at,
        p.name as project_name,
        p.product,
        COALESCE(e.display_name, p.product) as entity_name
      FROM change_events ce
      JOIN market_projects p ON ce.project_id = p.id
      LEFT JOIN canonical_entities e ON ce.entity_id = e.id
      WHERE ce.user_id = $1
        AND ce.observed_at >= NOW() - INTERVAL '2 days'
      ORDER BY ce.observed_at DESC
      LIMIT 8`,
      [user.id],
    );

    // 4. Fetch recent research sessions
    const { rows: sessions } = await query<SessionRow>(
      `SELECT id, title, updated_at 
       FROM chat_sessions 
       WHERE user_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 5`,
      [user.id],
    );

    // 5. Build dynamic markets from user projects or tracked competitors
    const markets = projects.map((p) => {
      const allEntities = [p.product, ...(p.competitors || [])].filter(Boolean);
      return {
        id: p.id,
        label: p.name,
        geography: 'Global',
        companies: allEntities.map((cName) => ({
          label: cName,
          what: `Tracked entity in ${p.name}`,
          shareNow: 50,
          shareMove: 0,
          lastMove: null,
        })),
      };
    });

    // 6. Format recent moves from live 2-day change events
    const recent = changeEvents.map((ce) => ({
      month: new Date(ce.observed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      company: ce.entity_name,
      kind: ce.event_type,
      headline: ce.before_value && ce.after_value
        ? `${ce.entity_name} changed ${ce.event_type.replace(/_/g, ' ')} from ${ce.before_value} to ${ce.after_value}`
        : `${ce.entity_name} updated ${ce.event_type.replace(/_/g, ' ')}`,
      soWhat: ce.materiality_reason || `Material movement recorded in ${ce.project_name}.`,
      market: ce.project_name,
      marketId: ce.project_name,
    }));

    // 7. Dynamic example prompts customized to user memory & history
    const examplePrompts: string[] = [];
    if (company && competitors.length > 0) {
      examplePrompts.push(`Compare ${company} and ${competitors[0]}. Who is winning on pricing and enterprise features?`);
      examplePrompts.push(`What has ${competitors[0]} changed in their product and packaging in the last 6 months?`);
      if (competitors[1]) {
        examplePrompts.push(`How does ${company} differentiate against ${competitors[1]}?`);
      }
      examplePrompts.push(`What emerging market moves pose the biggest threat to ${company}?`);
    } else if (company) {
      examplePrompts.push(`Analyze ${company}'s market positioning and identify top competitive alternatives.`);
      examplePrompts.push(`What recent pricing and feature changes have occurred in ${company}'s sector?`);
      examplePrompts.push(`How can ${company} improve win-rates against market rivals?`);
      examplePrompts.push(`Identify key growth opportunities and feature gaps for ${company}.`);
    } else if (sessions.length > 0 && sessions[0].title) {
      const firstSessionTopic = sessions[0].title.replace(/\.\.\.$/, '');
      examplePrompts.push(`Deepen the competitive analysis for: "${firstSessionTopic}"`);
      examplePrompts.push(`Compare pricing models and tier structures for recent research targets.`);
      examplePrompts.push(`What are the key market dynamics and threats discovered in recent sessions?`);
      examplePrompts.push(`Synthesize a battlecard based on our latest findings.`);
    } else {
      examplePrompts.push(`Compare two industry rivals side by side on pricing, product, and strategy.`);
      examplePrompts.push(`Analyze a target company's current enterprise packaging and pricing tiers.`);
      examplePrompts.push(`What recent product and positioning shifts have occurred in my market?`);
      examplePrompts.push(`Conduct a competitive gap analysis to find unserved market opportunities.`);
    }

    return apiSuccess({
      markets,
      recent,
      examplePrompts: examplePrompts.slice(0, 4),
      stats: {
        markets: markets.length,
        companies: markets.reduce((sum, m) => sum + m.companies.length, 0),
        moves: recent.length,
      },
    });
  } catch (err) {
    console.error('Failed to load dynamic market highlights:', err);
    return apiSuccess({
      markets: [],
      recent: [],
      examplePrompts: [
        'Compare two industry rivals side by side on pricing, product, and strategy.',
        'Analyze a target company’s current enterprise packaging and pricing tiers.',
        'What recent product and positioning shifts have occurred in my market?',
        'Conduct a competitive gap analysis to find unserved market opportunities.',
      ],
      stats: { markets: 0, companies: 0, moves: 0 },
    });
  }
}
