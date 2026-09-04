/**
 * The prototype market dataset — shapes.
 *
 * This is demo scaffolding, not a live feed. The figures are written to be
 * plausible for the companies and categories involved and to give the pipeline
 * something real to chew on; they are not pulled from those companies' filings
 * and should never be treated as reported financials. Anything that leaves this
 * folder for a customer-facing surface has to come from the live collectors
 * instead.
 *
 * What is *not* faked is the machinery. The seeder hands these pages to the
 * production collection pipeline, which hashes them, extracts evidence spans,
 * records metric observations, diffs them against the previous month and scores
 * materiality on its own. Every finding the UI shows was computed from this text
 * the same way it would be computed from a page fetched off the web.
 */

/** Months the dataset covers, oldest first. Eight points is enough for a curve. */
export const MONTHS = [
  '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08',
] as const;

export type Month = (typeof MONTHS)[number];

export type SourceKind =
  | 'pricing'
  | 'changelog'
  | 'newsroom'
  | 'leadership'
  | 'careers'
  | 'regulator';

export interface PageDef {
  url: string;
  kind: SourceKind;
  /** One rendered body per entry in MONTHS. Identical consecutive entries are
   *  the point, not an oversight — they prove the no-change path fires. */
  monthly: string[];
}

/** A dated thing a company did. Drives the decision timeline. */
export interface CompanyMove {
  month: Month;
  kind: 'pricing' | 'product' | 'funding' | 'leadership' | 'expansion' | 'partnership' | 'regulatory';
  headline: string;
  /** Why a business reader should care, in one sentence, no jargon. */
  soWhat: string;
  /** The seeded page that states it. */
  sourceUrl: string;
}

export interface CompanyDef {
  label: string;
  /** Other names people actually type — "SLT", "Dialog", "Mobitel". Matching on
   *  the formal label alone means a demo dies on the first natural phrasing. */
  aka?: string[];
  /** Short line under the name — what they actually do. */
  what: string;
  homeUrl: string;
  pages: PageDef[];
  moves: CompanyMove[];
  /** Share of the category, per month, as a percentage. Sums to ~100 per month
   *  across a domain once "everyone else" is added. */
  share: number[];
  /** Headline size figure and its unit, for the comparison table. */
  scale: { label: string; value: string };
  /** Plain-language strengths and weaknesses, for the comparison table. */
  strengths: string[];
  watchOuts: string[];
}

export interface RegulationDef {
  month: Month;
  authority: string;
  headline: string;
  soWhat: string;
  sourceUrl: string;
}

export interface DomainDef {
  id: string;
  /** What a person would call this market. */
  label: string;
  /** The company whose seat the user sits in. */
  home: string;
  geography: string;
  decisionContext: string;
  companies: CompanyDef[];
  /** Everything not held by the named companies. Keeps the donut honest. */
  otherShare: number[];
  regulations: RegulationDef[];
  /** The regulator's own page, collected like any other source. */
  regulationsPage?: PageDef;
  /** One paragraph a non-analyst can read and act on. */
  readOut: string;
  /** Where the category itself is heading, and what would break that call. */
  outlook: { call: string; because: string; breaksIf: string };
}
