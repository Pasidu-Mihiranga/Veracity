/**
 * Deciding when a question is about a market we already hold.
 *
 * Kept separate from the chat route so the rule is one readable function:
 * if the query names companies we have collected history on, the answer carries
 * that history. Nothing here calls a model or touches the network.
 */

import type { MarketBriefingPayload } from '@/lib/agents/types';
import { buildBriefing } from './briefing';
import { detectCompanies, detectDomains, domainOf } from './dataset';
import type { CompanyDef, DomainDef } from './types';

/**
 * Build a briefing for the companies a query names, or null.
 *
 * Two deliberate choices:
 *
 *  - **Named companies only.** Asking about Dialog and SLT-Mobitel should not
 *    silently pull Hutch into the comparison table. The share donut still shows
 *    the whole market, because a share chart missing a third of the market is a
 *    lie, but the side-by-side covers exactly who was asked about.
 *  - **One market at a time.** If a query spans markets, the largest group wins
 *    rather than merging two incompatible share bases into one chart.
 */
export function attachMarketBriefing(query: string): MarketBriefingPayload | null {
  const hits = detectCompanies(query);

  // No company named, but a market was — "where is telecom heading?". Brief the
  // whole market rather than nothing, which is what the question asked for.
  if (hits.length === 0) {
    const domains = detectDomains(query);
    if (domains.length === 0) return null;
    const full = buildBriefing(domains[0]);
    return {
      domainId: full.domainId,
      label: full.label,
      geography: full.geography,
      readOut: full.readOut,
      months: full.months,
      companies: full.companies,
      shareNow: full.shareNow,
      projection: full.projection,
      timeline: full.timeline,
      regulations: full.regulations,
      outlook: full.outlook,
    };
  }

  const byDomain = new Map<DomainDef, CompanyDef[]>();
  for (const company of hits) {
    const domain = domainOf(company);
    if (!domain) continue;
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), company]);
  }
  if (byDomain.size === 0) return null;

  const [domain, named] = [...byDomain.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];

  const full = buildBriefing(domain);
  const namedLabels = new Set(named.map((company) => company.label));

  return {
    domainId: full.domainId,
    label: full.label,
    geography: full.geography,
    readOut: full.readOut,
    months: full.months,
    companies: full.companies.filter((company) => namedLabels.has(company.label)),
    shareNow: full.shareNow,
    projection: full.projection,
    timeline: full.timeline.filter(
      (item) => namedLabels.has(item.company) || item.kind === 'regulatory',
    ),
    regulations: full.regulations,
    outlook: full.outlook,
  };
}
