/**
 * Canned page content for the prototype demo.
 *
 * The prototype rules allow hard-coded source data but require the agent logic
 * to be real. So this file is the *only* thing that is canned: two versions of
 * each page, a month apart. Everything downstream — content hashing, the
 * no-change short circuit, evidence extraction, metric observations, change
 * detection and materiality scoring — runs the production code path unchanged.
 *
 * These are real Sri Lankan companies. The text is written to be representative
 * of what their public pages state, not copied from them: the demo needs a
 * believable diff, not a reproduction of anyone's copy.
 *
 * The diffs are deliberate, and each exercises a different part of the pipeline:
 *
 *  - **PickMe pricing** — a number moves (base fare 300 → 350). Produces a
 *    `metric_observation` on both runs, so the change is *measured* and the
 *    chart that follows is classed `measured` rather than `derived`.
 *  - **PickMe changelog** — a feature ships. Text-only, so it is a real change
 *    with no metric behind it, which is the common case.
 *  - **Uber pricing** — identical in both runs. This is the important one: it
 *    proves the no-change short circuit fires and that "we looked and nothing
 *    moved" is a real finding rather than an absence of data.
 */

export interface DemoProject {
  /** Project name shown in the sidebar. */
  name: string;
  /** The company whose position the user holds. */
  product: string;
  productUrl: string;
  competitors: string[];
  geography: string;
  decisionContext: string;
  /** Which canned pages belong to this project. */
  urls: string[];
}

export interface CannedPage {
  url: string;
  entityLabel: string;
  /** What the page said on the first visit. */
  before: string;
  /** What it says now. Identical to `before` when nothing changed. */
  after: string;
}

/**
 * Three projects across three industries.
 *
 * The point of the spread is that this is not a SaaS tool. Competitive pressure
 * is the same shape for a tea exporter, a garment manufacturer and a ride-hailing
 * app: someone moved a price, shipped a capability, or changed who they sell to,
 * and you found out late. The pipeline does not know or care which industry it
 * is reading.
 */
export const DEMO_PROJECTS: DemoProject[] = [
  {
    name: 'PickMe vs Uber',
    product: 'PickMe',
    productUrl: 'https://pickme.lk',
    competitors: ['Uber'],
    geography: 'Sri Lanka',
    decisionContext:
      'Whether to match a competitor fare increase or hold price and compete on availability.',
    urls: [
      'https://pickme.lk/pricing',
      'https://pickme.lk/changelog',
      'https://uber.com/lk/en/ride/how-it-works',
    ],
  },
  {
    name: 'Ceylon tea exporters',
    product: 'Dilmah',
    productUrl: 'https://dilmahtea.com',
    competitors: ['Akbar Brothers', 'Mlesna'],
    geography: 'Sri Lanka · export',
    decisionContext:
      'Whether to move into direct-to-consumer export or hold the bulk wholesale channel.',
    urls: [
      'https://dilmahtea.com/trade',
      'https://akbar.lk/products',
      'https://mlesna.com/wholesale',
    ],
  },
  {
    name: 'Apparel manufacturing',
    product: 'MAS Holdings',
    productUrl: 'https://masholdings.com',
    competitors: ['Brandix'],
    geography: 'Sri Lanka · apparel',
    decisionContext:
      'Whether to invest in sustainable-materials capacity ahead of EU regulatory deadlines.',
    urls: [
      'https://masholdings.com/capabilities',
      'https://brandix.com/sustainability',
    ],
  },
];

export const CANNED_PAGES: CannedPage[] = [
  {
    url: 'https://pickme.lk/pricing',
    entityLabel: 'PickMe',
    before: `PickMe Fares and Pricing

Tuk
Base fare LKR 300. Charged at LKR 45 per kilometre after the first two kilometres.
Waiting charge LKR 3 per minute.

Car (Mini)
Base fare LKR 550. Charged at LKR 78 per kilometre.
Waiting charge LKR 4 per minute.

Flex
Base fare LKR 420. Charged at LKR 60 per kilometre.

Booking fee of LKR 40 applies to all rides.
Cancellation fee of LKR 100 applies after the driver has been assigned for 3 minutes.
Payment by cash, card, or PickMe Wallet.`,
    after: `PickMe Fares and Pricing

Tuk
Base fare LKR 350. Charged at LKR 52 per kilometre after the first two kilometres.
Waiting charge LKR 3 per minute.

Car (Mini)
Base fare LKR 550. Charged at LKR 78 per kilometre.
Waiting charge LKR 4 per minute.

Flex
Base fare LKR 480. Charged at LKR 68 per kilometre.

Booking fee of LKR 60 applies to all rides.
Cancellation fee of LKR 100 applies after the driver has been assigned for 3 minutes.
Payment by cash, card, PickMe Wallet, or PickMe Pay Later.`,
  },
  {
    url: 'https://pickme.lk/changelog',
    entityLabel: 'PickMe',
    before: `Product updates

March
Driver ratings now show a 90-day rolling average rather than a lifetime score.
Improved pickup accuracy in Colombo 03 and Colombo 07.

February
Added scheduled rides for airport transfers.
Wallet top-up now supports all local banks.`,
    after: `Product updates

April
Launched PickMe Pay Later for corporate accounts, with settlement on 30-day terms.
Added a business dashboard for companies managing more than 20 staff accounts.
Bulk ride booking for corporate administrators.

March
Driver ratings now show a 90-day rolling average rather than a lifetime score.
Improved pickup accuracy in Colombo 03 and Colombo 07.

February
Added scheduled rides for airport transfers.
Wallet top-up now supports all local banks.`,
  },
  {
    url: 'https://uber.com/lk/en/ride/how-it-works',
    entityLabel: 'Uber',
    // Identical on purpose — see the note above. A demo where everything has
    // changed is a demo that never shows the short circuit working.
    before: `Uber in Sri Lanka

Request a ride from the app and get matched with a nearby driver.
UberGo and UberXL are available in Colombo, Kandy and Galle.
Fares are calculated from time and distance, plus a base fare and booking fee.
Pay with cash or card. Upfront pricing is shown before you confirm.`,
    after: `Uber in Sri Lanka

Request a ride from the app and get matched with a nearby driver.
UberGo and UberXL are available in Colombo, Kandy and Galle.
Fares are calculated from time and distance, plus a base fare and booking fee.
Pay with cash or card. Upfront pricing is shown before you confirm.`,
  },
  {
    url: 'https://dilmahtea.com/trade',
    entityLabel: 'Dilmah',
    before: `Trade and Wholesale

Bulk Ceylon black tea, minimum order 500 kg.
Indicative price USD 4.20 per kg FOB Colombo.
Lead time 21 days from confirmed order.
Certifications: Ozone Friendly, Ethical Tea Partnership.
Packing: 50 kg multiwall paper sacks.`,
    after: `Trade and Wholesale

Bulk Ceylon black tea, minimum order 250 kg.
Indicative price USD 5.10 per kg FOB Colombo.
Lead time 14 days from confirmed order.
Certifications: Ozone Friendly, Ethical Tea Partnership, EU Organic, Rainforest Alliance.
Packing: 50 kg multiwall paper sacks, or retail-ready cartons for direct export.

New: direct-to-consumer fulfilment for EU and UK orders, shipped from Colombo.`,
  },
  {
    url: 'https://akbar.lk/products',
    entityLabel: 'Akbar Brothers',
    before: `Product Range

Ceylon black tea in bulk and value-added packs.
Minimum order 1000 kg for bulk grades.
Indicative price USD 3.90 per kg FOB Colombo.
Private label available for orders above 5000 kg.`,
    after: `Product Range

Ceylon black tea in bulk and value-added packs.
Minimum order 1000 kg for bulk grades.
Indicative price USD 4.60 per kg FOB Colombo.
Private label available for orders above 3000 kg.
Green tea and flavoured ranges added for export markets.`,
  },
  {
    url: 'https://mlesna.com/wholesale',
    entityLabel: 'Mlesna',
    // Unchanged on purpose, so the short circuit is visible in a second project.
    before: `Wholesale

Ceylon tea in gift and retail packaging.
Minimum order 200 kg.
Indicative price USD 6.40 per kg FOB Colombo.
Boutique and duty-free channels supported.`,
    after: `Wholesale

Ceylon tea in gift and retail packaging.
Minimum order 200 kg.
Indicative price USD 6.40 per kg FOB Colombo.
Boutique and duty-free channels supported.`,
  },
  {
    url: 'https://masholdings.com/capabilities',
    entityLabel: 'MAS Holdings',
    before: `Capabilities

Apparel manufacturing across intimates, sportswear and performance wear.
52 manufacturing facilities across 17 countries.
Lead time 45 days for standard programmes.
Recycled polyester content across 22 percent of output.`,
    after: `Capabilities

Apparel manufacturing across intimates, sportswear and performance wear.
54 manufacturing facilities across 17 countries.
Lead time 38 days for standard programmes.
Recycled polyester content across 41 percent of output.

New: digital product passport support ahead of EU ESPR requirements.
Closed-loop water treatment at 12 facilities.`,
  },
  {
    url: 'https://brandix.com/sustainability',
    entityLabel: 'Brandix',
    before: `Sustainability

Water usage reduced 34 percent against a 2019 baseline.
Recycled material content across 18 percent of output.
Six facilities certified LEED Platinum.`,
    after: `Sustainability

Water usage reduced 41 percent against a 2019 baseline.
Recycled material content across 29 percent of output.
Nine facilities certified LEED Platinum.
Committed to EU digital product passport readiness by 2027.`,
  },
];

/** Look a page up by URL, for the seed's injected `fetchPage`. */
export function cannedPage(url: string, phase: 'before' | 'after'): string | null {
  const page = CANNED_PAGES.find((candidate) => candidate.url === url);
  return page ? page[phase] : null;
}
