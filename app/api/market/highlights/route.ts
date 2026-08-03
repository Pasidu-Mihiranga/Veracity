import { getCurrentUser } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api-response';
import { DOMAINS, MONTHS, domainTimeline } from '@/lib/market/dataset';

export const runtime = 'nodejs';

/**
 * What the opening screen needs to feel awake.
 *
 * The starter panel was a static menu: three cards and a flat list of names. It
 * told a first-time visitor nothing about whether anything was actually being
 * watched. This gives it the two things that do — a mini fact per company, and
 * the moves we most recently recorded — from already-collected data, with no
 * model call, so the app still opens for free.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');

  const markets = DOMAINS.map((domain) => ({
    id: domain.id,
    label: domain.label,
    geography: domain.geography,
    companies: domain.companies.map((company) => {
      const share = company.share;
      const latest = company.moves[company.moves.length - 1];
      return {
        label: company.label,
        what: company.what,
        shareNow: share[share.length - 1],
        // Points gained or lost across the window — the one number that says
        // whether this company is worth asking about today.
        shareMove: Math.round((share[share.length - 1] - share[0]) * 10) / 10,
        lastMove: latest ? latest.headline : null,
      };
    }),
  }));

  // Newest first, across every market, so the strip reads as one feed rather
  // than five. Capped: this is a taster, not the timeline.
  const recent = DOMAINS.flatMap((domain) =>
    domainTimeline(domain)
      .filter((item) => item.kind !== 'regulatory')
      .slice(0, 4)
      .map((item) => ({ ...item, market: domain.label, marketId: domain.id })),
  )
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 8);

  return apiSuccess({
    markets,
    recent,
    stats: {
      markets: DOMAINS.length,
      companies: DOMAINS.reduce((sum, d) => sum + d.companies.length, 0),
      months: MONTHS.length,
    },
  });
}
