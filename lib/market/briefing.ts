/**
 * Assembling a briefing: the shape the UI actually renders.
 *
 * Kept out of the route so the same assembly serves a whole-market briefing and
 * a two-or-three company comparison. The route decides *which* companies; this
 * decides what is said about them.
 */

import {
  DOMAINS, MONTHS, domainTimeline, findCompany, futureMonths,
  projectShare, shareSeries,
} from './dataset';
import type { CompanyDef, DomainDef } from './types';

export interface BriefingCompany {
  label: string;
  what: string;
  homeUrl: string;
  share: number[];
  shareNow: number;
  /** Points gained or lost across the observed window. */
  shareMove: number;
  scale: { label: string; value: string };
  strengths: string[];
  watchOuts: string[];
  moveCount: number;
}

export interface Briefing {
  domainId: string;
  label: string;
  geography: string;
  home: string;
  /** The paragraph a non-analyst reads first. */
  readOut: string;
  months: string[];
  companies: BriefingCompany[];
  otherShare: number[];
  /** Share of the category right now, including everyone unnamed. */
  shareNow: Array<{ label: string; value: number }>;
  projection: {
    months: string[];
    byCompany: Record<string, number[]>;
    method: string;
  };
  timeline: Array<{
    month: string;
    company: string;
    kind: string;
    headline: string;
    soWhat: string;
    sourceUrl: string;
  }>;
  regulations: DomainDef['regulations'];
  outlook: DomainDef['outlook'];
  /** Things worth asking next, in the user's words rather than ours. */
  followUps: string[];
}

function toBriefingCompany(company: CompanyDef): BriefingCompany {
  const share = company.share;
  return {
    label: company.label,
    what: company.what,
    homeUrl: company.homeUrl,
    share,
    shareNow: share[share.length - 1],
    shareMove: Math.round((share[share.length - 1] - share[0]) * 10) / 10,
    scale: company.scale,
    strengths: company.strengths,
    watchOuts: company.watchOuts,
    moveCount: company.moves.length,
  };
}

/** Everything about one market. */
export function buildBriefing(domain: DomainDef): Briefing {
  const series = shareSeries(domain);
  const latest = series[series.length - 1];
  const projectionMonths = futureMonths(3);

  const byCompany: Record<string, number[]> = {};
  let method = '';
  for (const company of domain.companies) {
    const projected = projectShare(company.share, 3);
    byCompany[company.label] = projected.points;
    method = projected.method;
  }

  return {
    domainId: domain.id,
    label: domain.label,
    geography: domain.geography,
    home: domain.home,
    readOut: domain.readOut,
    months: [...MONTHS],
    companies: domain.companies.map(toBriefingCompany),
    otherShare: domain.otherShare,
    shareNow: [
      ...domain.companies.map((company) => ({
        label: company.label,
        value: latest.byCompany[company.label],
      })),
      { label: 'Everyone else', value: latest.other },
    ],
    projection: { months: projectionMonths, byCompany, method },
    timeline: domainTimeline(domain),
    regulations: domain.regulations,
    outlook: domain.outlook,
    followUps: [
      `What should ${domain.home} do about it?`,
      'Where are the gaps nobody is filling?',
      'What rules are changing here?',
      `Go deeper on ${domain.companies.find((c) => c.label !== domain.home)?.label ?? 'a competitor'}`,
      'How does this compare with the region?',
    ],
  };
}

/**
 * A comparison of named companies.
 *
 * Companies from different markets can be named together — someone comparing a
 * bank with a ride-hailing app is asking a real question about where their money
 * goes. When that happens the share chart is dropped, because share of *what*
 * has no answer, and the comparison falls back to what can honestly be said side
 * by side.
 */
export function buildComparison(names: string[]): {
  briefing: Briefing | null;
  companies: BriefingCompany[];
  sameMarket: boolean;
  unknown: string[];
  timeline: Briefing['timeline'];
  followUps: string[];
} {
  const found = names
    .map((name) => ({ name, hit: findCompany(name) }))
    .filter((entry) => entry.hit);
  const unknown = names.filter((name) => !findCompany(name));

  const domains = new Set(found.map((entry) => entry.hit!.domain.id));
  const sameMarket = domains.size === 1 && found.length > 0;
  const domain = sameMarket ? found[0].hit!.domain : null;

  const companies = found.map((entry) => toBriefingCompany(entry.hit!.company));
  const labels = new Set(companies.map((company) => company.label));

  const timeline = found
    .flatMap((entry) =>
      entry.hit!.company.moves.map((move) => ({
        ...move,
        company: entry.hit!.company.label,
      })),
    )
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    briefing: domain ? buildBriefing(domain) : null,
    companies,
    sameMarket,
    unknown,
    timeline,
    followUps: [
      ...(unknown.length > 0 ? [`Start tracking ${unknown[0]}`] : []),
      'Add another company to this',
      `Go deeper on ${companies[0]?.label ?? 'the leader'}`,
      'Who is likely to lead in a year?',
      ...(sameMarket ? ['What rules are changing here?'] : []),
    ].filter((chip, i, all) => all.indexOf(chip) === i && labels.size > 0),
  };
}

/** Cheap index for pickers: every company we can brief on. */
export function companyIndex() {
  return DOMAINS.flatMap((domain) =>
    domain.companies.map((company) => ({
      label: company.label,
      what: company.what,
      domainId: domain.id,
      domainLabel: domain.label,
    })),
  );
}
