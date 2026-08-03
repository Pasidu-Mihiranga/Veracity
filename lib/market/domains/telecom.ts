/**
 * Telecommunications in Sri Lanka — Dialog Axiata, SLT-Mobitel, Hutch.
 *
 * The story: data pricing collapsed toward unlimited bundles, fibre is where the
 * revenue actually is, and the regulator stepped into pricing transparency
 * mid-year. Dialog leads on mobile, SLT-Mobitel owns the fibre line into the
 * home, and Hutch is buying share with price. See the note in `../types.ts` on
 * what these figures are.
 */

import type { DomainDef } from '../types';
import {
  careersPage, carry, changelogPage, leadershipPage, newsroomPage,
  pricingPage, regulatorPage,
} from '../render';

const dialogPricing = pricingPage(
  'https://dialog.lk/tariffs',
  'Dialog prepaid and postpaid tariffs',
  carry([
    {
      lines: [
        { item: 'Prepaid data, monthly', price: 'LKR 1,490 for 25 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 2,290 per month', secondary: '40 GB data, 500 any-network minutes' },
        { item: 'Home broadband, fibre', price: 'LKR 4,990 per month', secondary: '100 Mbps unlimited' },
        { item: 'Voice, any network', price: 'LKR 2.50 per minute' },
      ],
      note: 'Coverage across all 25 districts. 5G available in Colombo, Gampaha and Kandy.',
    },
    null,
    {
      lines: [
        { item: 'Prepaid data, monthly', price: 'LKR 1,490 for 40 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 2,290 per month', secondary: '60 GB data, 500 any-network minutes' },
        { item: 'Home broadband, fibre', price: 'LKR 4,990 per month', secondary: '100 Mbps unlimited' },
        { item: 'Voice, any network', price: 'LKR 2.50 per minute' },
      ],
      note: 'Coverage across all 25 districts. 5G available in Colombo, Gampaha and Kandy.',
    },
    null, null,
    {
      lines: [
        { item: 'Prepaid data, monthly', price: 'LKR 1,690 for 60 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 2,490 per month', secondary: 'Unlimited data, 500 any-network minutes' },
        { item: 'Home broadband, fibre', price: 'LKR 5,490 per month', secondary: '200 Mbps unlimited' },
        { item: 'Voice, any network', price: 'LKR 2.50 per minute' },
      ],
      note: 'Coverage across all 25 districts. 5G available in Colombo, Gampaha, Kandy, Galle and Kurunegala.',
    },
    null, null,
  ]),
);

const dialogChangelog = changelogPage(
  'https://dialog.lk/whats-new',
  'What is new at Dialog',
  [
    { month: '2026-01', items: ['eSIM activation from the MyDialog app.'] },
    null,
    { month: '2026-03', items: ['Data bundles rebuilt: same price, more data across prepaid and postpaid.'] },
    null,
    { month: '2026-05', items: ['Genie wallet now settles merchant payments the same day.'] },
    { month: '2026-06', items: ['Unlimited postpaid data introduced on the standard plan.', '5G switched on in Galle and Kurunegala.'] },
    null,
    { month: '2026-08', items: ['Fixed wireless home broadband for districts without fibre.'] },
  ],
);

const dialogNewsroom = newsroomPage(
  'https://dialog.lk/media',
  'Dialog media releases',
  [
    null,
    {
      month: '2026-02',
      headline: 'Dialog passes 17.8 million mobile connections',
      body: 'Data revenue grew 14 percent year on year while voice revenue fell 6 percent, continuing a four-year pattern.',
    },
    null, null,
    {
      month: '2026-05',
      headline: 'Dialog invests USD 45 million in 5G and fibre expansion',
      body: 'The programme covers 5G in five cities and fibre passing an additional 120,000 homes.',
    },
    null,
    {
      month: '2026-07',
      headline: 'Dialog reports fibre home connections up 38 percent',
      body: 'Home broadband is now the fastest-growing line of the business, though the company remains second to SLT-Mobitel on fixed connections.',
    },
    null,
  ],
);

const dialogLeadership = leadershipPage(
  'https://dialog.lk/about/leadership',
  'Dialog Axiata leadership',
  carry([
    {
      officers: [
        { role: 'Group Chief Executive', name: 'Supun Weerasinghe', since: 'January 2018' },
        { role: 'Chief Financial Officer', name: 'Chandana Samarasinghe', since: 'June 2021' },
        { role: 'Chief Technology Officer', name: 'Pradeep de Almeida', since: 'March 2019' },
      ],
    },
    null, null, null,
    {
      officers: [
        { role: 'Group Chief Executive', name: 'Supun Weerasinghe', since: 'January 2018' },
        { role: 'Chief Financial Officer', name: 'Chandana Samarasinghe', since: 'June 2021' },
        { role: 'Chief Technology Officer', name: 'Pradeep de Almeida', since: 'March 2019' },
        { role: 'Chief Officer, Home Broadband', name: 'Niroshan Fernando', since: 'May 2026' },
      ],
      note: 'A dedicated home broadband seat was created as fixed connections became the growth line.',
    },
    null, null, null,
  ]),
);

const sltPricing = pricingPage(
  'https://slt.lk/packages',
  'SLT-Mobitel broadband and mobile packages',
  carry([
    {
      lines: [
        { item: 'Home broadband, fibre', price: 'LKR 4,590 per month', secondary: '100 Mbps unlimited' },
        { item: 'Home broadband, fibre premium', price: 'LKR 7,990 per month', secondary: '300 Mbps unlimited' },
        { item: 'Prepaid data, monthly', price: 'LKR 1,590 for 25 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 2,190 per month', secondary: '40 GB data, 400 any-network minutes' },
      ],
      note: 'Fibre available in all provinces. Copper ADSL being retired through 2026.',
    },
    null, null,
    {
      lines: [
        { item: 'Home broadband, fibre', price: 'LKR 4,590 per month', secondary: '150 Mbps unlimited' },
        { item: 'Home broadband, fibre premium', price: 'LKR 7,490 per month', secondary: '500 Mbps unlimited' },
        { item: 'Prepaid data, monthly', price: 'LKR 1,590 for 40 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 2,190 per month', secondary: '60 GB data, 400 any-network minutes' },
      ],
      note: 'Fibre available in all provinces. Copper ADSL being retired through 2026.',
    },
    null, null, null, null,
  ]),
);

const sltNewsroom = newsroomPage(
  'https://slt.lk/news',
  'SLT-Mobitel news',
  [
    null, null,
    {
      month: '2026-03',
      headline: 'SLT-Mobitel passes 1.1 million fibre connections',
      body: 'The company holds the majority of fixed broadband lines in the country and said fibre now reaches every province.',
    },
    {
      month: '2026-04',
      headline: 'Fibre speeds raised at no extra cost',
      body: 'Entry fibre moves from 100 to 150 Mbps and premium from 300 to 500 Mbps, with prices held or reduced.',
    },
    null, null, null,
    {
      month: '2026-08',
      headline: 'SLT-Mobitel completes copper retirement in the Western Province',
      body: 'Remaining ADSL customers were migrated to fibre, freeing maintenance spend for the fibre build.',
    },
  ],
);

const sltCareers = careersPage(
  'https://slt.lk/careers',
  'Careers at SLT-Mobitel',
  carry([
    { counts: [{ team: 'Network engineering', open: 18 }, { team: 'Field operations', open: 24 }] },
    null, null,
    { counts: [{ team: 'Network engineering', open: 27 }, { team: 'Field operations', open: 41 }, { team: 'Enterprise sales', open: 9 }], note: 'Field hiring follows the fibre build and the copper retirement programme.' },
    null, null, null, null,
  ]),
);

const hutchPricing = pricingPage(
  'https://hutch.lk/plans',
  'Hutch plans',
  carry([
    {
      lines: [
        { item: 'Prepaid data, monthly', price: 'LKR 999 for 25 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 1,490 per month', secondary: '40 GB data, 300 any-network minutes' },
        { item: 'Voice, any network', price: 'LKR 1.90 per minute' },
      ],
      note: 'Coverage in 22 districts. No fixed broadband product.',
    },
    null,
    {
      lines: [
        { item: 'Prepaid data, monthly', price: 'LKR 999 for 50 GB', secondary: 'Anytime data, valid 30 days' },
        { item: 'Postpaid, standard', price: 'LKR 1,490 per month', secondary: 'Unlimited data, 300 any-network minutes' },
        { item: 'Voice, any network', price: 'LKR 1.90 per minute' },
      ],
      note: 'Coverage in 22 districts. No fixed broadband product.',
    },
    null, null, null, null, null,
  ]),
);

const hutchNewsroom = newsroomPage(
  'https://hutch.lk/news',
  'Hutch news',
  [
    null, null,
    {
      month: '2026-03',
      headline: 'Hutch doubles prepaid data at the same price and adds unlimited postpaid',
      body: 'The company said it would compete on price per gigabyte rather than coverage, three months before larger rivals moved.',
    },
    null, null,
    {
      month: '2026-06',
      headline: 'Hutch passes 5 million connections',
      body: 'Growth is concentrated in price-sensitive prepaid users outside the Western Province.',
    },
    null, null,
  ],
);

const trcslNotices = regulatorPage(
  'https://trc.gov.lk/notices',
  'Telecommunications Regulatory Commission notices',
  [
    null, null, null,
    {
      month: '2026-04',
      reference: 'TRCSL/2026/09',
      headline: 'Consultation on advertised versus delivered broadband speeds',
      body: 'The Commission sought views on requiring operators to publish minimum delivered speeds alongside advertised maximums.',
    },
    null, null,
    {
      month: '2026-07',
      reference: 'TRCSL/2026/16',
      headline: 'Direction issued on broadband speed and unlimited-plan disclosure',
      body: 'From November 2026, operators must publish minimum delivered speed and any fair-use threshold applying to plans advertised as unlimited.',
    },
    null,
  ],
);

export const telecom: DomainDef = {
  id: 'telecom',
  label: 'Telecommunications in Sri Lanka',
  home: 'Dialog Axiata',
  geography: 'Sri Lanka',
  decisionContext:
    'Whether to defend mobile share on price or put the money into fibre and home broadband.',
  companies: [
    {
      label: 'Dialog Axiata',
      aka: ['Dialog', 'Axiata'],
      what: 'Largest mobile operator, expanding into fibre and home broadband',
      homeUrl: 'https://dialog.lk',
      pages: [dialogPricing, dialogChangelog, dialogNewsroom, dialogLeadership],
      share: [44, 44, 45, 45, 45, 46, 46, 46],
      scale: { label: 'Mobile connections', value: '17.8 million' },
      strengths: [
        'Widest 5G footprint, now five cities',
        'Only operator with mobile, fibre, fixed wireless and a payment wallet in one place',
        'Home broadband connections up 38 percent, the fastest-growing part of the business',
      ],
      watchOuts: [
        'Second to SLT-Mobitel on fixed lines and buying its way in',
        'Raised prepaid price in June while Hutch has not moved since March',
      ],
      moves: [
        { month: '2026-02', kind: 'product', headline: 'Passed 17.8 million connections; data revenue up 14 percent', soWhat: 'Voice keeps shrinking, data keeps growing. Every decision below follows from that.', sourceUrl: 'https://dialog.lk/media' },
        { month: '2026-03', kind: 'pricing', headline: 'More data at the same price across prepaid and postpaid', soWhat: 'A direct answer to Hutch, in the same month Hutch moved.', sourceUrl: 'https://dialog.lk/tariffs' },
        { month: '2026-05', kind: 'expansion', headline: 'USD 45 million into 5G and fibre', soWhat: 'The money is going to fixed lines, which is SLT-Mobitel’s territory, not mobile.', sourceUrl: 'https://dialog.lk/media' },
        { month: '2026-05', kind: 'leadership', headline: 'Created a Chief Officer for Home Broadband', soWhat: 'A named owner for fixed broadband confirms where growth is expected to come from.', sourceUrl: 'https://dialog.lk/about/leadership' },
        { month: '2026-06', kind: 'pricing', headline: 'Unlimited postpaid data, and prepaid price raised to LKR 1,690', soWhat: 'Unlimited at the top, a price rise at the bottom — the bottom is where Hutch is winning.', sourceUrl: 'https://dialog.lk/tariffs' },
        { month: '2026-08', kind: 'product', headline: 'Fixed wireless home broadband for districts without fibre', soWhat: 'Reaches homes SLT-Mobitel’s fibre has not, without laying cable.', sourceUrl: 'https://dialog.lk/whats-new' },
      ],
    },
    {
      label: 'SLT-Mobitel',
      aka: ['SLT', 'Mobitel', 'Sri Lanka Telecom'],
      what: 'State-linked operator, majority of the country’s fixed broadband lines',
      homeUrl: 'https://slt.lk',
      pages: [sltPricing, sltNewsroom, sltCareers],
      share: [37, 37, 36, 36, 36, 35, 35, 35],
      scale: { label: 'Fibre connections', value: '1.1 million' },
      strengths: [
        'Majority of fixed broadband lines, in every province',
        'Raised fibre speeds and cut the premium price at the same time',
        'Retiring copper frees maintenance money for the fibre build',
      ],
      watchOuts: [
        'Losing mobile share every month since March',
        'No 5G announcement all year while Dialog reached five cities',
      ],
      moves: [
        { month: '2026-03', kind: 'product', headline: 'Passed 1.1 million fibre connections', soWhat: 'The asset Dialog is spending USD 45 million to compete with.', sourceUrl: 'https://slt.lk/news' },
        { month: '2026-04', kind: 'pricing', headline: 'Fibre speeds raised, premium price cut to LKR 7,490', soWhat: 'More speed for less money — the clearest defensive move anyone made this year.', sourceUrl: 'https://slt.lk/packages' },
        { month: '2026-04', kind: 'expansion', headline: 'Field operations hiring up from 24 to 41 roles', soWhat: 'The build is real: hiring moved before the announcements did.', sourceUrl: 'https://slt.lk/careers' },
        { month: '2026-08', kind: 'product', headline: 'Copper retired across the Western Province', soWhat: 'Ends a legacy cost and locks those homes onto fibre before fixed wireless arrives.', sourceUrl: 'https://slt.lk/news' },
      ],
    },
    {
      label: 'Hutch',
      aka: ['Hutchison'],
      what: 'Low-cost mobile operator, no fixed broadband',
      homeUrl: 'https://hutch.lk',
      pages: [hutchPricing, hutchNewsroom],
      share: [13, 13, 13, 14, 14, 14, 15, 15],
      scale: { label: 'Connections', value: '5 million' },
      strengths: [
        'Cheapest data of the three and has not raised price since March',
        'Moved to unlimited postpaid three months before Dialog did',
        'Growing every month in price-sensitive districts',
      ],
      watchOuts: [
        'No fixed broadband at all, so it misses the growing part of the market',
        'Coverage in 22 districts against Dialog’s 25',
      ],
      moves: [
        { month: '2026-03', kind: 'pricing', headline: 'Doubled prepaid data and introduced unlimited postpaid', soWhat: 'Set the price floor the whole market has been reacting to since.', sourceUrl: 'https://hutch.lk/news' },
        { month: '2026-06', kind: 'product', headline: 'Passed 5 million connections', soWhat: 'Two points of share gained without a single price rise.', sourceUrl: 'https://hutch.lk/news' },
      ],
    },
  ],
  otherShare: [6, 6, 6, 5, 5, 5, 4, 4],
  regulations: [
    {
      month: '2026-04',
      authority: 'Telecommunications Regulatory Commission',
      headline: 'Consultation on advertised versus delivered broadband speeds',
      soWhat: 'The first move toward operators having to prove the speeds they advertise.',
      sourceUrl: 'https://trc.gov.lk/notices',
    },
    {
      month: '2026-07',
      authority: 'Telecommunications Regulatory Commission',
      headline: 'Speed and unlimited-plan disclosure required from November 2026',
      soWhat: 'Anyone advertising "unlimited" must publish the fair-use threshold. Dialog and Hutch both launched unlimited plans this year.',
      sourceUrl: 'https://trc.gov.lk/notices',
    },
  ],
  regulationsPage: trcslNotices,
  readOut:
    'Hutch set the price floor in March by doubling prepaid data and launching unlimited postpaid, and both larger operators have been reacting ever since — Dialog matched on data within the month and went unlimited in June. Hutch has gained two points of share without raising a price once. The more important fight is fixed broadband, where SLT-Mobitel holds the majority of lines and answered Dialog’s USD 45 million fibre investment by raising speeds and cutting the premium price. Dialog’s response in August was fixed wireless, which reaches homes fibre has not without laying cable. From November, anyone advertising an unlimited plan has to publish its fair-use threshold — which affects the two operators that just launched them.',
  outlook: {
    call: 'Dialog holds mobile and closes the gap on home broadband; Hutch keeps taking the price-sensitive end.',
    because: 'Dialog is the only operator investing in both, and Hutch has grown every month it held price.',
    breaksIf: 'The November disclosure rule forces Dialog’s unlimited plan to advertise a low fair-use cap, or SLT-Mobitel answers fixed wireless with its own.',
  },
};
