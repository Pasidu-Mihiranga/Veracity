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

export interface CannedPage {
  url: string;
  entityLabel: string;
  /** What the page said on the first visit. */
  before: string;
  /** What it says now. Identical to `before` when nothing changed. */
  after: string;
}

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
];

/** Look a page up by URL, for the seed's injected `fetchPage`. */
export function cannedPage(url: string, phase: 'before' | 'after'): string | null {
  const page = CANNED_PAGES.find((candidate) => candidate.url === url);
  return page ? page[phase] : null;
}
