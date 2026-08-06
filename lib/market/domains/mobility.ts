/**
 * Ride-hailing in Sri Lanka — PickMe, Uber, Yego.
 *
 * The story the eight months tell: PickMe leads on volume but is defending a
 * fare rise it took in June; Uber held price for six weeks and then matched,
 * which is the pattern it has followed every time; Yego is taking the
 * price-sensitive tuk segment in the outstations rather than fighting for
 * Colombo. See the note in `../types.ts` on what these figures are.
 */

import type { DomainDef } from '../types';
import {
  careersPage, carry, changelogPage, leadershipPage, newsroomPage,
  pricingPage, regulatorPage,
} from '../render';

const pickmePricing = pricingPage(
  'https://pickme.lk/pricing',
  'PickMe fares and pricing',
  carry([
    {
      lines: [
        { item: 'Tuk', price: 'Base fare LKR 300', secondary: 'LKR 45 per kilometre after the first two kilometres' },
        { item: 'Car (Mini)', price: 'Base fare LKR 550', secondary: 'LKR 78 per kilometre' },
        { item: 'Flex', price: 'Base fare LKR 420', secondary: 'LKR 60 per kilometre' },
      ],
      note: 'Booking fee of LKR 40 applies to all rides. Payment by cash, card or PickMe Wallet.',
    },
    null,
    {
      lines: [
        { item: 'Tuk', price: 'Base fare LKR 330', secondary: 'LKR 48 per kilometre after the first two kilometres' },
        { item: 'Car (Mini)', price: 'Base fare LKR 550', secondary: 'LKR 78 per kilometre' },
        { item: 'Flex', price: 'Base fare LKR 420', secondary: 'LKR 60 per kilometre' },
      ],
      note: 'Booking fee of LKR 40 applies to all rides. Payment by cash, card or PickMe Wallet.',
    },
    null,
    null,
    {
      lines: [
        { item: 'Tuk', price: 'Base fare LKR 380', secondary: 'LKR 55 per kilometre after the first two kilometres' },
        { item: 'Car (Mini)', price: 'Base fare LKR 620', secondary: 'LKR 88 per kilometre' },
        { item: 'Flex', price: 'Base fare LKR 480', secondary: 'LKR 68 per kilometre' },
      ],
      note: 'Booking fee of LKR 60 applies to all rides. Payment by cash, card, PickMe Wallet or PickMe Pay Later.',
    },
    null,
    null,
  ]),
);

const pickmeChangelog = changelogPage(
  'https://pickme.lk/changelog',
  'PickMe product updates',
  [
    { month: '2026-01', items: ['Wallet top-up now supports all local banks.', 'Scheduled rides added for airport transfers.'] },
    null,
    { month: '2026-03', items: ['Driver ratings now show a 90-day rolling average rather than a lifetime score.', 'Pickup accuracy improved in Colombo 03 and Colombo 07.'] },
    { month: '2026-04', items: ['Launched PickMe Pay Later for corporate accounts, settling on 30-day terms.', 'Added a business dashboard for companies managing more than 20 staff accounts.'] },
    null,
    { month: '2026-06', items: ['Fare estimate now shown before booking on every vehicle class.', 'Added a Kandy and Galle outstation tier.'] },
    { month: '2026-07', items: ['PickMe Food merchant settlement moved to next-day payout.'] },
    { month: '2026-08', items: ['Corporate ride policies: per-employee monthly caps and approval routing.'] },
  ],
);

const pickmeNewsroom = newsroomPage(
  'https://pickme.lk/newsroom',
  'PickMe news',
  [
    null,
    {
      month: '2026-02',
      headline: 'PickMe crosses 2.4 million monthly completed trips',
      body: 'Completed trips grew 18 percent against the same month last year, with the strongest growth outside Colombo.',
    },
    null,
    {
      month: '2026-04',
      headline: 'PickMe raises USD 12 million to expand outstation coverage',
      body: 'The round is led by existing investors and will fund driver acquisition in Kandy, Galle, Jaffna and Kurunegala over the next eighteen months.',
    },
    null,
    {
      month: '2026-06',
      headline: 'Fare revision takes effect across all vehicle classes',
      body: 'PickMe attributed the revision to fuel and maintenance costs carried by drivers, and said driver earnings per trip rise by an average of 14 percent.',
    },
    null,
    {
      month: '2026-08',
      headline: 'PickMe partners with Sampath Bank on driver working-capital loans',
      body: 'Drivers with six months of trip history can borrow against future earnings, repaid from weekly settlement.',
    },
  ],
);

const pickmeLeadership = leadershipPage(
  'https://pickme.lk/leadership',
  'PickMe leadership',
  carry([
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Zulfer Jiffry', since: 'March 2015' },
        { role: 'Chief Technology Officer', name: 'Dinuka Perera', since: 'August 2019' },
        { role: 'Chief Financial Officer', name: 'Rukshan Dias', since: 'January 2021' },
      ],
    },
    null,
    null,
    null,
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Zulfer Jiffry', since: 'March 2015' },
        { role: 'Chief Technology Officer', name: 'Dinuka Perera', since: 'August 2019' },
        { role: 'Chief Financial Officer', name: 'Rukshan Dias', since: 'January 2021' },
        { role: 'Chief Commercial Officer', name: 'Anushka Wijesinha', since: 'May 2026' },
      ],
      note: 'The commercial role is newly created and covers corporate accounts and the payments business.',
    },
    null,
    null,
    null,
  ]),
);

const pickmeCareers = careersPage(
  'https://pickme.lk/careers',
  'Working at PickMe',
  carry([
    { counts: [{ team: 'Engineering', open: 11 }, { team: 'Operations', open: 8 }, { team: 'Driver acquisition', open: 4 }, { team: 'Finance', open: 2 }] },
    null,
    null,
    { counts: [{ team: 'Engineering', open: 14 }, { team: 'Operations', open: 12 }, { team: 'Driver acquisition', open: 19 }, { team: 'Finance', open: 3 }], note: 'Driver acquisition hiring is concentrated in Kandy, Galle and Jaffna.' },
    null,
    null,
    { counts: [{ team: 'Engineering', open: 9 }, { team: 'Operations', open: 10 }, { team: 'Driver acquisition', open: 21 }, { team: 'Finance', open: 3 }, { team: 'Payments', open: 6 }], note: 'A payments team is being staffed for the first time.' },
    null,
  ]),
);

const uberPricing = pricingPage(
  'https://uber.com/lk/en/ride/how-it-works',
  'Uber in Sri Lanka',
  carry([
    {
      lines: [
        { item: 'UberGo', price: 'Base fare LKR 520', secondary: 'LKR 74 per kilometre' },
        { item: 'Uber Tuk', price: 'Base fare LKR 290', secondary: 'LKR 44 per kilometre' },
        { item: 'UberXL', price: 'Base fare LKR 780', secondary: 'LKR 110 per kilometre' },
      ],
      note: 'Upfront pricing is shown before you confirm. Available in Colombo, Kandy and Galle. Pay with cash or card.',
    },
    null, null, null, null, null,
    {
      lines: [
        { item: 'UberGo', price: 'Base fare LKR 590', secondary: 'LKR 84 per kilometre' },
        { item: 'Uber Tuk', price: 'Base fare LKR 340', secondary: 'LKR 52 per kilometre' },
        { item: 'UberXL', price: 'Base fare LKR 860', secondary: 'LKR 124 per kilometre' },
      ],
      note: 'Upfront pricing is shown before you confirm. Available in Colombo, Kandy, Galle and Negombo. Pay with cash or card.',
    },
    null,
  ]),
);

const uberNewsroom = newsroomPage(
  'https://uber.com/lk/en/newsroom',
  'Uber Sri Lanka news',
  [
    null, null,
    {
      month: '2026-03',
      headline: 'Uber adds airport pickup lanes at Bandaranaike International',
      body: 'Dedicated pickup bays cut average wait at arrivals from eleven minutes to four.',
    },
    null, null, null,
    {
      month: '2026-07',
      headline: 'Uber revises Sri Lanka fares and opens Negombo',
      body: 'Fares rise across all classes and service opens in Negombo, six weeks after a comparable revision by the market leader.',
    },
    null,
  ],
);

const uberCareers = careersPage(
  'https://uber.com/lk/en/careers',
  'Uber careers in Sri Lanka',
  carry([
    { counts: [{ team: 'Operations', open: 3 }, { team: 'Driver support', open: 5 }] },
    null, null, null,
    { counts: [{ team: 'Operations', open: 6 }, { team: 'Driver support', open: 9 }, { team: 'City expansion', open: 4 }], note: 'City expansion roles are posted for Negombo and Matara.' },
    null, null, null,
  ]),
);

const yegoPricing = pricingPage(
  'https://yego.lk/fares',
  'Yego fares',
  carry([
    {
      lines: [
        { item: 'Yego Tuk', price: 'Base fare LKR 260', secondary: 'LKR 40 per kilometre' },
        { item: 'Yego Bike', price: 'Base fare LKR 150', secondary: 'LKR 28 per kilometre' },
      ],
      note: 'No booking fee. Cash and wallet accepted. Operating in Colombo, Negombo, Kurunegala and Matara.',
    },
    null, null,
    {
      lines: [
        { item: 'Yego Tuk', price: 'Base fare LKR 280', secondary: 'LKR 42 per kilometre' },
        { item: 'Yego Bike', price: 'Base fare LKR 160', secondary: 'LKR 30 per kilometre' },
        { item: 'Yego Mini', price: 'Base fare LKR 480', secondary: 'LKR 70 per kilometre' },
      ],
      note: 'No booking fee. Cash and wallet accepted. Operating in Colombo, Negombo, Kurunegala, Matara and Anuradhapura.',
    },
    null, null, null, null,
  ]),
);

const yegoNewsroom = newsroomPage(
  'https://yego.lk/news',
  'Yego news',
  [
    null, null, null,
    {
      month: '2026-04',
      headline: 'Yego adds a car class and two outstation cities',
      body: 'Yego Mini launches alongside coverage in Anuradhapura, positioning the service as the low-cost option outside Colombo.',
    },
    null,
    {
      month: '2026-06',
      headline: 'Yego holds fares as competitors revise upward',
      body: 'The company said it would not follow the market on price this quarter and would compete on cost to the rider.',
    },
    null, null,
  ],
);

const nationalTransport = regulatorPage(
  'https://ntc.gov.lk/notices',
  'National Transport Commission notices',
  [
    null, null,
    {
      month: '2026-03',
      reference: 'NTC/2026/07',
      headline: 'Consultation opened on metered fare bands for app-based hire',
      body: 'The Commission invited submissions on whether app-based tuk fares should sit within published bands, as metered three-wheelers already do.',
    },
    null, null, null,
    {
      month: '2026-07',
      reference: 'NTC/2026/19',
      headline: 'Fare band guidance issued for app-based three-wheeler hire',
      body: 'Operators must publish base fare and per-kilometre rates in-app before confirmation, and give 14 days notice of any increase. Guidance takes effect from October 2026.',
    },
    null,
  ],
);

export const mobility: DomainDef = {
  id: 'mobility',
  label: 'Ride-hailing in Sri Lanka',
  home: 'PickMe',
  geography: 'Sri Lanka',
  decisionContext:
    'Whether to hold the June fare rise or roll part of it back before the fare-band rules take effect.',
  companies: [
    {
      label: 'PickMe',
      what: 'Local ride-hailing and delivery app, strongest in Colombo',
      homeUrl: 'https://pickme.lk',
      pages: [pickmePricing, pickmeChangelog, pickmeNewsroom, pickmeLeadership, pickmeCareers],
      share: [54, 54, 53, 53, 52, 51, 49, 48],
      scale: { label: 'Monthly completed trips', value: '2.4 million' },
      strengths: [
        'Widest driver network outside Colombo',
        'Corporate accounts and Pay Later give it a business-customer base nobody else has',
        'Food and rides on one wallet',
      ],
      watchOuts: [
        'Raised fares twice in six months, and riders notice the second one',
        'Most exposed to the new fare-band notice period',
      ],
      moves: [
        { month: '2026-02', kind: 'product', headline: 'Passed 2.4 million monthly trips', soWhat: 'Growth is coming from outside Colombo, which is where the next fight is.', sourceUrl: 'https://pickme.lk/newsroom' },
        { month: '2026-03', kind: 'pricing', headline: 'Tuk base fare raised from LKR 300 to LKR 330', soWhat: 'The first of two rises. Nobody followed it.', sourceUrl: 'https://pickme.lk/pricing' },
        { month: '2026-04', kind: 'funding', headline: 'Raised USD 12 million for outstation expansion', soWhat: 'Funds driver acquisition in four cities — the hiring page shows it started immediately.', sourceUrl: 'https://pickme.lk/newsroom' },
        { month: '2026-05', kind: 'leadership', headline: 'Created a Chief Commercial Officer role', soWhat: 'A new seat covering corporate accounts and payments says where the revenue focus is going.', sourceUrl: 'https://pickme.lk/leadership' },
        { month: '2026-06', kind: 'pricing', headline: 'Second fare rise: tuk base fare to LKR 380', soWhat: 'A 27 percent rise since January. This is the one that moved share.', sourceUrl: 'https://pickme.lk/pricing' },
        { month: '2026-08', kind: 'partnership', headline: 'Driver working-capital loans with Sampath Bank', soWhat: 'Locks drivers in through credit rather than pay — cheaper than raising rates.', sourceUrl: 'https://pickme.lk/newsroom' },
      ],
    },
    {
      label: 'Uber',
      what: 'Global ride-hailing operator, Colombo and the larger cities',
      homeUrl: 'https://uber.com/lk',
      pages: [uberPricing, uberNewsroom, uberCareers],
      share: [26, 26, 27, 27, 28, 29, 30, 31],
      scale: { label: 'Cities served', value: '4' },
      strengths: [
        'Airport pickup lanes give it the arrivals corridor',
        'Held price for six weeks while the leader raised, and took share doing it',
        'Global app that inbound travellers already have installed',
      ],
      watchOuts: [
        'Thin driver supply outside Colombo',
        'Followed the fare rise in July, so the price advantage has closed',
      ],
      moves: [
        { month: '2026-03', kind: 'product', headline: 'Airport pickup lanes at Bandaranaike', soWhat: 'Cut arrivals wait from eleven minutes to four, in the segment with the highest fare per trip.', sourceUrl: 'https://uber.com/lk/en/newsroom' },
        { month: '2026-05', kind: 'expansion', headline: 'Posted city-expansion roles for Negombo and Matara', soWhat: 'The hiring page announced the expansion two months before the newsroom did.', sourceUrl: 'https://uber.com/lk/en/careers' },
        { month: '2026-07', kind: 'pricing', headline: 'Matched the fare rise and opened Negombo', soWhat: 'Same pattern as every previous cycle: hold six weeks, then match.', sourceUrl: 'https://uber.com/lk/en/newsroom' },
      ],
    },
    {
      label: 'Yego',
      what: 'Low-cost tuk and bike hailing, strongest in the outstations',
      homeUrl: 'https://yego.lk',
      pages: [yegoPricing, yegoNewsroom],
      share: [9, 9, 10, 11, 12, 13, 14, 15],
      scale: { label: 'Cities served', value: '5' },
      strengths: [
        'Cheapest base fare in every class it runs',
        'Held price through the whole period while both larger rivals raised',
        'Bike class has no direct competitor',
      ],
      watchOuts: [
        'No corporate product, so no protection from a price war',
        'Thin coverage in Colombo, where the fare per trip is highest',
      ],
      moves: [
        { month: '2026-04', kind: 'product', headline: 'Added a car class and Anuradhapura', soWhat: 'Moving up from tuks and bikes into the segment PickMe earns most from.', sourceUrl: 'https://yego.lk/news' },
        { month: '2026-06', kind: 'pricing', headline: 'Publicly declined to follow the fare rise', soWhat: 'Turned a price gap into a marketing position at the exact moment riders were looking.', sourceUrl: 'https://yego.lk/news' },
      ],
    },
  ],
  otherShare: [11, 11, 10, 9, 8, 7, 7, 6],
  regulations: [
    {
      month: '2026-03',
      authority: 'National Transport Commission',
      headline: 'Consultation on published fare bands for app hire',
      soWhat: 'The first sign that app fares would stop being purely commercial.',
      sourceUrl: 'https://ntc.gov.lk/notices',
    },
    {
      month: '2026-07',
      authority: 'National Transport Commission',
      headline: 'Fare-band guidance issued, effective October 2026',
      soWhat: 'Fourteen days notice before any increase. A same-week response to a rival is no longer possible for anyone.',
      sourceUrl: 'https://ntc.gov.lk/notices',
    },
  ],
  readOut:
    'PickMe still takes about half of all app rides, but it has given up six points of share since January and every point of it went to the two companies that did not raise prices. The June fare rise is the cause: Uber held for six weeks, took share, then matched in July, which is the same pattern it followed the last two times. Yego did not follow at all and has grown every month. From October, the transport regulator requires fourteen days notice before any fare increase, so the fast-follow move Uber has used three times stops working for everybody.',
  outlook: {
    call: 'PickMe holds the lead through the year but keeps bleeding share to Yego in the outstations.',
    because: 'Share has moved in a straight line since the March rise, and the outstation hiring is Yego-shaped, not Uber-shaped.',
    breaksIf: 'PickMe rolls back part of the tuk fare before October, or Yego runs out of money for driver incentives.',
  },
  regulationsPage: nationalTransport,
};
