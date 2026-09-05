import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { HOME_STORIES, type Story, type StorySegment, type StoryKind } from '@/lib/mock/home-stories';

export const runtime = 'nodejs';

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface EventRow {
  id: string;
  event_type: string;
  before_value: string | null;
  after_value: string | null;
  materiality: number;
  materiality_reason: string;
  observed_at: Date;
  source_url: string | null;
  project_name: string;
  product: string;
  entity_name: string;
  entity_type: string;
}

interface UserMemoryRow {
  company: string | null;
  role: string | null;
  products: string[] | null;
  competitors: string[] | null;
  interests: string[] | null;
  raw_summary: string | null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  try {
    // 1. Fetch User Preferences & Memory (Company, Role, Competitors, Interests)
    const { rows: memoryRows } = await query<UserMemoryRow>(
      `SELECT company, role, products, competitors, interests, raw_summary 
       FROM user_memory 
       WHERE user_id = $1 
       LIMIT 1`,
      [user.id],
    );

    const userPref = memoryRows[0] || null;
    const preferredCompany = userPref?.company || userPref?.products?.[0] || null;
    const preferredCompetitors = new Set((userPref?.competitors || []).map((c) => c.toLowerCase().trim()));
    const preferredInterests = (userPref?.interests || []).map((i) => i.toLowerCase().trim());

    // 2. Fetch User's Change Events
    const { rows } = await query<EventRow>(
      `SELECT 
        ce.id,
        ce.event_type,
        ce.before_value,
        ce.after_value,
        ce.materiality,
        ce.materiality_reason,
        ce.observed_at,
        s.source_url,
        p.name as project_name,
        p.product,
        COALESCE(e.display_name, p.product) as entity_name,
        COALESCE(e.entity_type, 'competitor') as entity_type
      FROM change_events ce
      JOIN market_projects p ON ce.project_id = p.id
      LEFT JOIN canonical_entities e ON ce.entity_id = e.id
      LEFT JOIN source_snapshots s ON ce.to_snapshot_id = s.id
      WHERE ce.user_id = $1
      ORDER BY ce.materiality DESC, ce.observed_at DESC
      LIMIT 30`,
      [user.id],
    );

    if (rows.length === 0) {
      return apiSuccess({ stories: [], isEmpty: true, source: 'database' });
    }

    // 3. Score & Sort events according to User Preferences
    // Higher score for events matching user's primary company, competitor list, or interests
    const scoredRows = rows.map((r) => {
      let score = Number(r.materiality) * 10;
      const entityLower = r.entity_name.toLowerCase();
      const productLower = r.product.toLowerCase();

      if (preferredCompany && (entityLower.includes(preferredCompany.toLowerCase()) || productLower.includes(preferredCompany.toLowerCase()))) {
        score += 20; // Direct focus match
      }
      if (preferredCompetitors.has(entityLower)) {
        score += 15; // Tracked competitor match
      }
      if (preferredInterests.some((int) => r.project_name.toLowerCase().includes(int) || r.event_type.toLowerCase().includes(int))) {
        score += 10; // Topic interest match
      }
      return { ...r, score };
    });

    scoredRows.sort((a, b) => b.score - a.score);

    // 4. Personalized AI Briefing Story
    const focusLabel = preferredCompany ? `${preferredCompany}` : 'Your Market';
    const topMoves = scoredRows.slice(0, 3);
    const topCategories = Array.from(new Set(scoredRows.map((r) => r.project_name))).slice(0, 3);

    const briefingHeadline = preferredCompany
      ? `Intelligence Briefing for ${preferredCompany}`
      : `${scoredRows.length} material moves recorded across your tracked markets`;

    const briefingBody = preferredCompany
      ? `Recent competitor movements affecting ${preferredCompany}. Key activity across ${topCategories.join(', ')}: ${topMoves.map((m) => `${m.entity_name} shifted ${m.event_type.replace(/_/g, ' ')}${m.before_value && m.after_value ? ` from ${m.before_value} to ${m.after_value}` : ''}`).join('. ')}.`
      : `Recent competitor activity shows major moves across ${topCategories.join(', ')}. ${topMoves.map((m) => `${m.entity_name} changed ${m.event_type.replace(/_/g, ' ')}${m.before_value && m.after_value ? ` from ${m.before_value} to ${m.after_value}` : ''}`).join('. ')}.`;

    const briefingSegments: StorySegment[] = [
      {
        id: 'briefing-live-1',
        kind: 'ai-briefing',
        eyebrow: `Veracity AI · ${focusLabel} Briefing`,
        headline: briefingHeadline,
        body: briefingBody,
        image: '/stories/briefing-1.png',
        metric: { label: 'Tracked changes', value: `${scoredRows.length}`, delta: scoredRows.length },
        spark: [2, 4, 3, 7, 5, 8, scoredRows.length],
        timeAgo: formatRelative(scoredRows[0].observed_at),
        cta: {
          label: preferredCompany ? `Brief me on threats to ${preferredCompany}` : 'Synthesize my market briefing',
          query: preferredCompany
            ? `What recent competitor moves pose the biggest threat to ${preferredCompany}, and how should we position?`
            : `Summarize the recent competitive moves across my tracked markets and highlight what requires a response.`,
        },
      },
    ];

    const stories: Story[] = [
      {
        id: 'briefing',
        title: preferredCompany ? `${preferredCompany} briefing` : 'Your briefing',
        kind: 'ai-briefing',
        seen: false,
        gradient: ['#2A78D6', '#334E9E'],
        segments: briefingSegments,
      },
    ];

    // 5. Group by Entities for Company Updates & Competitor Moves
    const byEntity = new Map<string, typeof scoredRows>();
    for (const r of scoredRows) {
      const list = byEntity.get(r.entity_name) ?? [];
      list.push(r);
      byEntity.set(r.entity_name, list);
    }

    const gradients: [string, string][] = [
      ['#3B6FB0', '#2A78D6'],
      ['#1E5AA0', '#4A90E2'],
      ['#2D6DA3', '#1C4976'],
      ['#357ABD', '#225287'],
      ['#2C6BA8', '#1A436D'],
    ];

    let colorIdx = 0;
    for (const [entityName, entityEvents] of byEntity.entries()) {
      if (stories.length >= 5) break;

      const isProduct =
        entityEvents[0].entity_type === 'product' ||
        (preferredCompany && entityName.toLowerCase() === preferredCompany.toLowerCase());

      const kind: StoryKind = isProduct ? 'company-update' : 'competitor-move';
      const mainEvent = entityEvents[0];
      const eventLabel = mainEvent.event_type.replace(/_/g, ' ');

      const segments: StorySegment[] = entityEvents.slice(0, 2).map((ev, sIdx) => ({
        id: `${ev.id}-${sIdx}`,
        kind,
        eyebrow: `${entityName} · ${eventLabel}`,
        headline:
          ev.before_value && ev.after_value
            ? `${eventLabel}: ${ev.before_value} → ${ev.after_value}`
            : `${entityName} updated ${eventLabel}`,
        body:
          ev.materiality_reason ||
          `Recorded material change in ${ev.project_name} for ${entityName}.`,
        metric:
          ev.before_value && ev.after_value
            ? { label: eventLabel, value: ev.after_value }
            : { label: 'Materiality', value: `${Math.round(ev.materiality * 100)}%` },
        timeAgo: formatRelative(ev.observed_at),
        cta: {
          label: preferredCompany
            ? `How should ${preferredCompany} respond to ${entityName}?`
            : `Analyze ${entityName}'s move`,
          query: preferredCompany
            ? `${entityName} made a ${eventLabel} move in ${ev.project_name}. How should ${preferredCompany} respond?`
            : `What was the strategic rationale behind ${entityName}'s ${eventLabel} in ${ev.project_name}?`,
        },
      }));

      stories.push({
        id: `entity-${entityName.toLowerCase().replace(/\s+/g, '-')}`,
        title: entityName,
        kind,
        seen: false,
        gradient: gradients[colorIdx % gradients.length],
        segments,
      });
      colorIdx++;
    }

    // 6. Strategic Opportunity Story tailored to User's Product
    if (topMoves.length > 0) {
      const oppEvent = topMoves[0];
      const targetCompany = preferredCompany || oppEvent.product;
      stories.push({
        id: 'opportunity',
        title: 'Opportunity',
        kind: 'opportunity',
        seen: false,
        gradient: ['#3A5D8A', '#244570'],
        segments: [
          {
            id: 'opp-1',
            kind: 'opportunity',
            eyebrow: `${targetCompany} · Strategic Gap`,
            headline: `Opportunity in ${oppEvent.project_name}`,
            body: `With ${oppEvent.entity_name} shifting ${oppEvent.event_type.replace(/_/g, ' ')}, a window has opened for ${targetCompany} to win market share in ${oppEvent.project_name}.`,
            image: '/stories/opp-1.png',
            timeAgo: formatRelative(oppEvent.observed_at),
            cta: {
              label: `Formulate ${targetCompany}'s counter-strategy`,
              query: `How can ${targetCompany} capitalize on ${oppEvent.entity_name}'s recent ${oppEvent.event_type.replace(/_/g, ' ')} in ${oppEvent.project_name}?`,
            },
          },
        ],
      });
    }

    return apiSuccess({ stories: stories.slice(0, 6), source: 'database_personalized' });
  } catch (err) {
    console.error('Failed to generate personalized stories:', err);
    return apiSuccess({ stories: [], isEmpty: true, source: 'error' });
  }
}
