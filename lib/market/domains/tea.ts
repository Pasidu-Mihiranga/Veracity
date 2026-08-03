/**
 * Ceylon tea export — Dilmah, Akbar Brothers, Mlesna.
 *
 * The story: bulk prices rose across the board on a short crop, but the three
 * companies responded in opposite directions. Dilmah pushed further into
 * packed direct-to-consumer export, Akbar defended volume in bulk, Mlesna did
 * not move at all. An EU packaging rule lands in the middle of it. See the note
 * in `../types.ts` on what these figures are.
 */

import type { DomainDef } from '../types';
import {
  careersPage, carry, changelogPage, leadershipPage, newsroomPage,
  pricingPage, regulatorPage,
} from '../render';

const dilmahTrade = pricingPage(
  'https://dilmahtea.com/trade',
  'Dilmah trade and wholesale',
  carry([
    {
      lines: [
        { item: 'Bulk Ceylon black tea', price: 'USD 4.20 per kilogram FOB Colombo', secondary: 'Minimum order 500 kilograms' },
        { item: 'Retail-ready cartons', price: 'USD 7.80 per kilogram FOB Colombo', secondary: 'Minimum order 200 kilograms' },
      ],
      note: 'Lead time 21 days from confirmed order. Certifications: Ozone Friendly, Ethical Tea Partnership.',
    },
    null,
    {
      lines: [
        { item: 'Bulk Ceylon black tea', price: 'USD 4.85 per kilogram FOB Colombo', secondary: 'Minimum order 500 kilograms' },
        { item: 'Retail-ready cartons', price: 'USD 8.40 per kilogram FOB Colombo', secondary: 'Minimum order 200 kilograms' },
      ],
      note: 'Lead time 21 days from confirmed order. Certifications: Ozone Friendly, Ethical Tea Partnership, EU Organic.',
    },
    null,
    {
      lines: [
        { item: 'Bulk Ceylon black tea', price: 'USD 5.10 per kilogram FOB Colombo', secondary: 'Minimum order 250 kilograms' },
        { item: 'Retail-ready cartons', price: 'USD 8.90 per kilogram FOB Colombo', secondary: 'Minimum order 100 kilograms' },
        { item: 'Direct-to-consumer fulfilment', price: 'USD 12.40 per kilogram delivered', secondary: 'EU and UK addresses, shipped from Colombo' },
      ],
      note: 'Lead time 14 days from confirmed order. Certifications: Ozone Friendly, Ethical Tea Partnership, EU Organic, Rainforest Alliance.',
    },
    null, null, null,
  ]),
);

const dilmahNewsroom = newsroomPage(
  'https://dilmahtea.com/news',
  'Dilmah news',
  [
    null,
    {
      month: '2026-02',
      headline: 'Dilmah opens a UK fulfilment partnership for direct orders',
      body: 'Orders from UK households now ship within four days rather than three weeks, without going through a distributor.',
    },
    null, null,
    {
      month: '2026-05',
      headline: 'Direct-to-consumer channel opens for EU and UK',
      body: 'The company said packed direct sales carry roughly three times the margin per kilogram of bulk, and that it intends to move a fifth of export volume into the channel within two years.',
    },
    null,
    {
      month: '2026-07',
      headline: 'Dilmah completes EU deforestation-regulation traceability audit',
      body: 'Every estate supplying export lots is now geolocated to plot level, ahead of the December compliance date.',
    },
    null,
  ],
);

const dilmahLeadership = leadershipPage(
  'https://dilmahtea.com/leadership',
  'Dilmah leadership',
  carry([
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Dilhan Fernando', since: 'January 2018' },
        { role: 'Director, Global Markets', name: 'Malik Fernando', since: 'January 2018' },
        { role: 'Head of Sustainability', name: 'Anura Silva', since: 'June 2022' },
      ],
    },
    null, null, null, null, null,
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Dilhan Fernando', since: 'January 2018' },
        { role: 'Director, Global Markets', name: 'Malik Fernando', since: 'January 2018' },
        { role: 'Head of Sustainability', name: 'Anura Silva', since: 'June 2022' },
        { role: 'Director, Direct Channels', name: 'Shehani Gunawardena', since: 'July 2026' },
      ],
      note: 'The direct channels role covers the e-commerce and subscription business.',
    },
    null,
  ]),
);

const akbarProducts = pricingPage(
  'https://akbar.lk/products',
  'Akbar Brothers product range',
  carry([
    {
      lines: [
        { item: 'Bulk Ceylon black tea', price: 'USD 3.90 per kilogram FOB Colombo', secondary: 'Minimum order 1,000 kilograms' },
        { item: 'Private label packing', price: 'USD 6.20 per kilogram FOB Colombo', secondary: 'Minimum order 5,000 kilograms' },
      ],
      note: 'Green tea and flavoured ranges available for export markets.',
    },
    null,
    {
      lines: [
        { item: 'Bulk Ceylon black tea', price: 'USD 4.40 per kilogram FOB Colombo', secondary: 'Minimum order 1,000 kilograms' },
        { item: 'Private label packing', price: 'USD 6.60 per kilogram FOB Colombo', secondary: 'Minimum order 5,000 kilograms' },
      ],
      note: 'Green tea and flavoured ranges available for export markets.',
    },
    null, null,
    {
      lines: [
        { item: 'Bulk Ceylon black tea', price: 'USD 4.60 per kilogram FOB Colombo', secondary: 'Minimum order 750 kilograms' },
        { item: 'Private label packing', price: 'USD 6.60 per kilogram FOB Colombo', secondary: 'Minimum order 3,000 kilograms' },
      ],
      note: 'Green tea and flavoured ranges available for export markets. Minimum order sizes reduced across the range.',
    },
    null, null,
  ]),
);

const akbarNewsroom = newsroomPage(
  'https://akbar.lk/news',
  'Akbar Brothers news',
  [
    null, null, null,
    {
      month: '2026-04',
      headline: 'Akbar Brothers commissions a second packing line in Peliyagoda',
      body: 'The line adds capacity for private-label retail packs, the fastest-growing part of the order book.',
    },
    null,
    {
      month: '2026-06',
      headline: 'Akbar Brothers lowers minimum order sizes across the range',
      body: 'The company said smaller minimums open the door to mid-sized European buyers who previously could not meet a one-tonne floor.',
    },
    null, null,
  ],
);

const akbarCareers = careersPage(
  'https://akbar.lk/careers',
  'Careers at Akbar Brothers',
  carry([
    { counts: [{ team: 'Production', open: 6 }, { team: 'Export documentation', open: 2 }] },
    null, null,
    { counts: [{ team: 'Production', open: 18 }, { team: 'Export documentation', open: 5 }, { team: 'Quality assurance', open: 4 }], note: 'Production hiring follows the second packing line in Peliyagoda.' },
    null, null, null, null,
  ]),
);

const mlesnaWholesale = pricingPage(
  'https://mlesna.com/wholesale',
  'Mlesna wholesale',
  carry([
    {
      lines: [
        { item: 'Gift and retail packaging', price: 'USD 6.40 per kilogram FOB Colombo', secondary: 'Minimum order 200 kilograms' },
      ],
      note: 'Boutique and duty-free channels supported. Lead time 28 days.',
    },
    null, null, null, null, null, null, null,
  ]),
);

const mlesnaNewsroom = newsroomPage(
  'https://mlesna.com/news',
  'Mlesna news',
  [
    null, null, null, null,
    {
      month: '2026-05',
      headline: 'Mlesna opens two further tea boutiques',
      body: 'The company continues to expand its own retail footprint rather than compete on wholesale price.',
    },
    null, null, null,
  ],
);

const euTradeNotices = regulatorPage(
  'https://trade.ec.europa.eu/notices',
  'EU import notices for tea and agricultural products',
  [
    null, null,
    {
      month: '2026-03',
      reference: 'EUDR/2026/TEA-04',
      headline: 'Deforestation regulation guidance published for tea consignments',
      body: 'Importers must hold plot-level geolocation for every consignment placed on the EU market from December 2026. Consignments without it will be refused entry.',
    },
    null, null, null,
    {
      month: '2026-07',
      reference: 'PPWR/2026/11',
      headline: 'Packaging and packaging-waste rules confirmed for retail-ready imports',
      body: 'Retail-ready packaging entering the EU must be recyclable to the new standard from January 2027, with recycled-content minimums by weight.',
    },
    null,
  ],
);

export const tea: DomainDef = {
  id: 'tea',
  label: 'Ceylon tea export',
  home: 'Dilmah',
  geography: 'Sri Lanka · export to EU and UK',
  decisionContext:
    'Whether to keep pushing packed direct-to-consumer export or defend volume in bulk while prices are high.',
  companies: [
    {
      label: 'Dilmah',
      what: 'Branded Ceylon tea, packed at origin, sold worldwide',
      homeUrl: 'https://dilmahtea.com',
      pages: [dilmahTrade, dilmahNewsroom, dilmahLeadership],
      share: [31, 31, 32, 32, 33, 34, 35, 36],
      scale: { label: 'Price per kilogram, packed', value: 'USD 8.90' },
      strengths: [
        'Only one of the three selling direct to households in the EU and UK',
        'Traceability audit already done, so the December EU rule is not a problem',
        'Packed tea earns roughly three times what bulk earns per kilogram',
      ],
      watchOuts: [
        'Highest bulk price of the three, so it loses price-led bulk tenders',
        'Direct channel is new and unproven at volume',
      ],
      moves: [
        { month: '2026-02', kind: 'partnership', headline: 'UK fulfilment partnership for direct orders', soWhat: 'Cut delivery from three weeks to four days without a distributor in the middle.', sourceUrl: 'https://dilmahtea.com/news' },
        { month: '2026-05', kind: 'product', headline: 'Opened direct-to-consumer export for EU and UK', soWhat: 'The margin case is three times bulk. This is the strategy, not an experiment.', sourceUrl: 'https://dilmahtea.com/news' },
        { month: '2026-05', kind: 'pricing', headline: 'Cut minimum order from 500 kg to 250 kg', soWhat: 'Opens smaller European buyers — the same move Akbar made a month later.', sourceUrl: 'https://dilmahtea.com/trade' },
        { month: '2026-07', kind: 'regulatory', headline: 'Completed EU deforestation traceability audit', soWhat: 'Five months before the deadline, while competitors have not said anything about it.', sourceUrl: 'https://dilmahtea.com/news' },
        { month: '2026-07', kind: 'leadership', headline: 'Appointed a Director of Direct Channels', soWhat: 'A named owner for e-commerce means the channel is being resourced, not trialled.', sourceUrl: 'https://dilmahtea.com/leadership' },
      ],
    },
    {
      label: 'Akbar Brothers',
      what: 'Largest bulk tea exporter, private-label packer',
      homeUrl: 'https://akbar.lk',
      pages: [akbarProducts, akbarNewsroom, akbarCareers],
      share: [38, 38, 38, 38, 37, 37, 36, 36],
      scale: { label: 'Price per kilogram, bulk', value: 'USD 4.60' },
      strengths: [
        'Cheapest bulk price, which wins volume tenders',
        'New packing line adds private-label capacity',
        'Dropped minimums, so it now competes for mid-sized buyers too',
      ],
      watchOuts: [
        'Nothing published on EU traceability with the deadline in December',
        'No direct-to-consumer channel, so it stays a supplier rather than a brand',
      ],
      moves: [
        { month: '2026-04', kind: 'expansion', headline: 'Second packing line in Peliyagoda', soWhat: 'Capacity is going into private label, which is where the order book is growing.', sourceUrl: 'https://akbar.lk/news' },
        { month: '2026-04', kind: 'product', headline: 'Production hiring tripled', soWhat: 'Eighteen open production roles confirmed the line was real before it was announced.', sourceUrl: 'https://akbar.lk/careers' },
        { month: '2026-06', kind: 'pricing', headline: 'Lowered minimum order sizes across the range', soWhat: 'Follows Dilmah into mid-sized buyers, one month later.', sourceUrl: 'https://akbar.lk/products' },
      ],
    },
    {
      label: 'Mlesna',
      what: 'Boutique and duty-free Ceylon tea, own retail stores',
      homeUrl: 'https://mlesna.com',
      pages: [mlesnaWholesale, mlesnaNewsroom],
      share: [12, 12, 12, 12, 12, 11, 11, 11],
      scale: { label: 'Price per kilogram, packed', value: 'USD 6.40' },
      strengths: [
        'Own retail and duty-free stores, so it is not exposed to wholesale price at all',
        'Held its price through a period when both rivals raised',
      ],
      watchOuts: [
        'Has not changed its trade terms once in eight months',
        'No EU compliance activity visible with the December deadline approaching',
      ],
      moves: [
        { month: '2026-05', kind: 'expansion', headline: 'Opened two further tea boutiques', soWhat: 'Doubling down on own retail rather than defending the wholesale channel.', sourceUrl: 'https://mlesna.com/news' },
      ],
    },
  ],
  otherShare: [19, 19, 18, 18, 18, 18, 18, 17],
  regulations: [
    {
      month: '2026-03',
      authority: 'European Commission',
      headline: 'Deforestation regulation: plot-level traceability from December 2026',
      soWhat: 'Consignments without geolocation get refused at the EU border. Dilmah is ready; the other two have said nothing.',
      sourceUrl: 'https://trade.ec.europa.eu/notices',
    },
    {
      month: '2026-07',
      authority: 'European Commission',
      headline: 'Packaging rules confirmed for retail-ready imports from January 2027',
      soWhat: 'Hits packed exports specifically — which is the channel Dilmah just moved into.',
      sourceUrl: 'https://trade.ec.europa.eu/notices',
    },
  ],
  regulationsPage: euTradeNotices,
  readOut:
    'Bulk prices rose about 18 percent across all three exporters between January and May, on a short crop rather than anything any of them decided. What separates them is what they did next. Dilmah moved into selling packed tea straight to households in the EU and UK, where a kilogram earns roughly three times what bulk earns, and finished its EU traceability audit five months before the deadline. Akbar defended volume: cheaper bulk, a new packing line, and lower minimums a month after Dilmah cut its own. Mlesna has not changed a single term since January. The December EU traceability rule is the thing to watch — Dilmah is compliant, and neither competitor has published anything about it.',
  outlook: {
    call: 'Dilmah keeps gaining share through 2027, mostly at Mlesna’s expense rather than Akbar’s.',
    because: 'It is the only one of the three with a direct channel and the only one visibly ready for the December rule.',
    breaksIf: 'The direct channel does not hold its margin at volume, or Akbar announces traceability compliance before December.',
  },
};
