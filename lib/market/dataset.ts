/**
 * The prototype market dataset — registry and lookups.
 *
 * One source of truth, read by two very different callers:
 *
 *  - The **seeder** walks the pages and hands each month's body to the
 *    production collection pipeline, which derives the evidence, metrics and
 *    change events the dashboard renders. Nothing about a finding is stored
 *    here.
 *  - The **API** reads the narrative parts — share, moves, regulations, the
 *    read-out — that describe the market rather than any one page.
 *
 * See `types.ts` for what these figures are and are not.
 */

import { apparel } from './domains/apparel';
import { telecom } from './domains/telecom';
import { banking } from './domains/banking';
import { mobility } from './domains/mobility';
import { tea } from './domains/tea';
import { MONTHS } from './types';
import type { CompanyDef, DomainDef, Month, PageDef } from './types';

export const DOMAINS: DomainDef[] = [mobility, telecom, tea, apparel, banking];

export { MONTHS };
export type { CompanyDef, DomainDef, Month, PageDef };

export function findDomain(id: string): DomainDef | undefined {
  return DOMAINS.find((domain) => domain.id === id);
}

/** Every page in a domain, including the regulator's, with its owner attached. */
export function domainPages(
  domain: DomainDef,
): Array<{ page: PageDef; entityLabel: string }> {
  const pages = domain.companies.flatMap((company) =>
    company.pages.map((page) => ({ page, entityLabel: company.label })),
  );
  if (domain.regulationsPage) {
    pages.push({
      page: domain.regulationsPage,
      entityLabel: domain.regulations[0]?.authority ?? 'Regulator',
    });
  }
  return pages;
}

/** Page body for a given month index, for the seeder's injected `fetchPage`. */
export function pageContent(url: string, monthIndex: number): string | null {
  for (const domain of DOMAINS) {
    for (const { page } of domainPages(domain)) {
      if (page.url === url) return page.monthly[monthIndex] ?? null;
    }
  }
  return null;
}

/**
 * Find a company by any name a person might type.
 *
 * Case, spacing and punctuation are normalised, and every alias counts, so
 * "SLT", "slt-mobitel" and "Sri Lanka Telecom" all reach the same company. An
 * exact-label-only match is how a demo dies the first time someone types the
 * short name everybody actually uses.
 */
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findCompany(
  name: string,
): { company: CompanyDef; domain: DomainDef } | undefined {
  const key = normalise(name);
  if (!key) return undefined;
  for (const domain of DOMAINS) {
    const company = domain.companies.find(
      (candidate) =>
        normalise(candidate.label) === key ||
        (candidate.aka ?? []).some((alias) => normalise(alias) === key),
    );
    if (company) return { company, domain };
  }
  return undefined;
}

/**
 * Which companies a sentence is about.
 *
 * Scans free text for every known name and alias rather than asking the user to
 * pick from a list — someone typing "compare dialog and SLT" should get the
 * comparison, not a form. Longer names are matched first so "Sri Lanka Telecom"
 * does not get claimed by a shorter alias sitting inside it, and matches are
 * anchored on word boundaries so "Hutch" does not fire inside another word.
 */
export function detectCompanies(text: string): CompanyDef[] {
  const haystack = ` ${normalise(text)} `;
  const candidates = DOMAINS.flatMap((domain) =>
    domain.companies.flatMap((company) =>
      [company.label, ...(company.aka ?? [])].map((name) => ({
        company,
        needle: ` ${normalise(name)} `,
      })),
    ),
  ).sort((a, b) => b.needle.length - a.needle.length);

  const hits: CompanyDef[] = [];
  for (const { company, needle } of candidates) {
    if (hits.includes(company)) continue;
    if (haystack.includes(needle)) hits.push(company);
  }
  return hits;
}

/**
 * Which market a sentence is about, when it names no company.
 *
 * "Where is the telecom market heading?" is a perfectly ordinary question that
 * matched nothing, because detection only ever looked for company names — so
 * the one prompt the "See a whole market" card generates fell through to a bare
 * web sweep. Markets are matched on the words people use for them, not on our
 * internal label, which nobody would type.
 */
const DOMAIN_ALIASES: Record<string, string[]> = {
  mobility: ['ride hailing', 'ridehailing', 'ride share', 'rideshare', 'taxi', 'tuk'],
  telecom: ['telecom', 'telecommunications', 'telco', 'mobile network', 'broadband', 'fibre', 'fiber'],
  tea: ['tea', 'ceylon tea', 'tea export'],
  apparel: ['apparel', 'garment', 'clothing', 'textile'],
  banking: ['banking', 'bank', 'fintech', 'payments'],
};

export function detectDomains(text: string): DomainDef[] {
  const haystack = ` ${normalise(text)} `;
  return DOMAINS.filter((domain) => {
    if (haystack.includes(` ${normalise(domain.label)} `)) return true;
    return (DOMAIN_ALIASES[domain.id] ?? []).some((alias) =>
      haystack.includes(` ${normalise(alias)} `),
    );
  });
}

/** The market a set of companies belongs to, when they all share one. */
export function domainOf(company: CompanyDef): DomainDef | undefined {
  return DOMAINS.find((domain) => domain.companies.includes(company));
}

/** Every company across every domain, for pickers and chips. */
export function allCompanies(): Array<{ company: CompanyDef; domain: DomainDef }> {
  return DOMAINS.flatMap((domain) =>
    domain.companies.map((company) => ({ company, domain })),
  );
}

// ── Derived views ───────────────────────────────────────────────────────────

export interface SharePoint {
  month: Month;
  /** Company label → share of the category that month. */
  byCompany: Record<string, number>;
  other: number;
}

export function shareSeries(domain: DomainDef): SharePoint[] {
  return MONTHS.map((month, i) => ({
    month,
    byCompany: Object.fromEntries(
      domain.companies.map((company) => [company.label, company.share[i]]),
    ),
    other: domain.otherShare[i],
  }));
}

/**
 * Where share is heading, projected from the trend so far.
 *
 * Deliberately the simplest thing that can work: the average monthly move over
 * the observed window, carried forward. A heavier model would not be more
 * truthful on eight points, and this one can be explained in a sentence — which
 * matters more, because the UI has to state its method next to the line.
 */
export function projectShare(
  values: number[],
  monthsAhead: number,
): { points: number[]; method: string } {
  if (values.length < 3) return { points: [], method: 'not enough history to project' };
  const step = (values[values.length - 1] - values[0]) / (values.length - 1);
  const last = values[values.length - 1];
  const points = Array.from({ length: monthsAhead }, (_, i) =>
    Math.max(0, Math.round((last + step * (i + 1)) * 10) / 10),
  );
  return {
    points,
    method: `carries forward the average monthly move of the last ${values.length} months`,
  };
}

/** Month labels beyond the observed window, for the projection's x-axis. */
export function futureMonths(count: number): string[] {
  const last = MONTHS[MONTHS.length - 1];
  const [year, month] = last.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 + i + 1, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Every dated move in a domain, newest first — the decision timeline. */
export function domainTimeline(domain: DomainDef) {
  return domain.companies
    .flatMap((company) =>
      company.moves.map((move) => ({ ...move, company: company.label })),
    )
    .concat(
      domain.regulations.map((rule) => ({
        month: rule.month,
        kind: 'regulatory' as const,
        headline: rule.headline,
        soWhat: rule.soWhat,
        sourceUrl: rule.sourceUrl,
        company: rule.authority,
      })),
    )
    .sort((a, b) => b.month.localeCompare(a.month));
}
