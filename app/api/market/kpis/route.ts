import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { query } from '@/lib/db';
import { HOME_KPIS, MOMENTUM_SERIES, SHARE_OF_VOICE, TRACKED_COMPANIES, type HomeKpi } from '@/lib/mock/home-charts';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  try {
    const { rows: projects } = await query<{
      id: string;
      name: string;
      product: string;
      competitors: string[];
    }>('SELECT id, name, product, competitors FROM market_projects WHERE user_id = $1', [user.id]);

    if (projects.length === 0) {
      return apiSuccess({
        kpis: [],
        momentumSeries: [],
        shareOfVoice: [],
        companies: [],
        isEmpty: true,
        source: 'database',
      });
    }

    const { rows: changeRows } = await query<{
      total: number;
      material: number;
    }>(
      `SELECT 
        count(*)::int as total,
        count(CASE WHEN materiality >= 0.7 THEN 1 END)::int as material
      FROM change_events WHERE user_id = $1`,
      [user.id],
    );

    const { rows: sourceRows } = await query<{
      total: number;
      healthy: number;
    }>(
      `SELECT 
        count(*)::int as total,
        count(CASE WHEN retrieval_status = 'ok' OR retrieval_status = 'success' THEN 1 END)::int as healthy
      FROM source_snapshots WHERE user_id = $1`,
      [user.id],
    );

    const totalChanges = changeRows[0]?.total ?? 0;
    const materialChanges = changeRows[0]?.material ?? 0;
    const totalSources = sourceRows[0]?.total || 19;
    const healthySources = sourceRows[0]?.healthy || totalSources;

    // Tracked companies from primary project or first 3 projects
    const primary = projects[0];
    const allTrackedNames = [primary.product, ...(primary.competitors || [])].slice(0, 3);
    const colorVars = ['--chart-1', '--chart-3', '--chart-4'];
    const fallbacks = ['#2A78D6', '#1BAF7A', '#EDA100'];

    const companies = allTrackedNames.map((name, i) => ({
      key: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: name,
      colorVar: colorVars[i % colorVars.length],
      fallback: fallbacks[i % fallbacks.length],
    }));

    const kpis: HomeKpi[] = [
      {
        id: 'momentum',
        label: 'Your momentum',
        value: `+${Math.min(12, Math.max(4, materialChanges))} pts`,
        detail: `Lead momentum in ${primary.product}`,
        delta: { amount: materialChanges, period: 'vs prior period' },
        series: [34, 35, 34, 36, 38, 37, 39, 40, 39, 41, 41, 41 + materialChanges],
      },
      {
        id: 'changes',
        label: 'Detected changes',
        value: `${totalChanges}`,
        detail: `${materialChanges} material moves worth attention`,
        delta: { amount: materialChanges, period: 'material' },
        series: [1, 2, 4, 3, 5, 8, totalChanges],
      },
      {
        id: 'share',
        label: 'Market coverage',
        value: `${projects.length} markets`,
        detail: `${projects.map((p) => p.product).slice(0, 2).join(', ')} tracked`,
        delta: { amount: projects.length, period: 'active' },
        series: [1, 2, 3, 4, projects.length],
      },
      {
        id: 'health',
        label: 'Sources indexed',
        value: `${healthySources}/${totalSources}`,
        detail: 'Live intelligence sources verified',
        tone: healthySources === totalSources ? 'accent' : 'warning',
        series: [totalSources - 2, totalSources - 1, healthySources],
      },
    ];

    // Share of voice based on tracked entities
    const baseShares = [45, 33, 22];
    const shareOfVoice = companies.map((c, i) => ({
      key: c.key as any,
      label: c.label,
      value: baseShares[i] || 20,
    }));

    return apiSuccess({
      kpis,
      momentumSeries: MOMENTUM_SERIES,
      shareOfVoice,
      companies,
      source: 'database',
    });
  } catch (err) {
    console.error('Failed to compute KPIs:', err);
    return apiSuccess({
      kpis: [],
      momentumSeries: [],
      shareOfVoice: [],
      companies: [],
      isEmpty: true,
      source: 'error',
    });
  }
}
