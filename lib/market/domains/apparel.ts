/**
 * Apparel manufacturing — MAS Holdings, Brandix, Hirdaramani.
 *
 * The story: EU product rules are turning sustainability from marketing into a
 * purchase requirement, and the three manufacturers are at visibly different
 * stages of being ready for it. Buyers are already asking. See the note in
 * `../types.ts` on what these figures are.
 */

import type { DomainDef } from '../types';
import {
  careersPage, carry, leadershipPage, newsroomPage, pricingPage, regulatorPage,
} from '../render';

const masCapabilities = pricingPage(
  'https://masholdings.com/capabilities',
  'MAS Holdings capabilities',
  carry([
    {
      lines: [
        { item: 'Manufacturing footprint', price: '52 facilities across 17 countries' },
        { item: 'Standard programme lead time', price: '45 days' },
        { item: 'Recycled polyester content', price: '22 percent of output' },
        { item: 'Minimum order', price: '15,000 units per style' },
      ],
      note: 'Intimates, sportswear and performance wear. Design-to-delivery programmes available.',
    },
    null,
    {
      lines: [
        { item: 'Manufacturing footprint', price: '53 facilities across 17 countries' },
        { item: 'Standard programme lead time', price: '42 days' },
        { item: 'Recycled polyester content', price: '31 percent of output' },
        { item: 'Minimum order', price: '15,000 units per style' },
      ],
      note: 'Intimates, sportswear and performance wear. Design-to-delivery programmes available.',
    },
    null, null,
    {
      lines: [
        { item: 'Manufacturing footprint', price: '54 facilities across 17 countries' },
        { item: 'Standard programme lead time', price: '38 days' },
        { item: 'Recycled polyester content', price: '41 percent of output' },
        { item: 'Minimum order', price: '10,000 units per style' },
      ],
      note: 'Intimates, sportswear and performance wear. Digital product passport support available on request. Closed-loop water treatment at 12 facilities.',
    },
    null, null,
  ]),
);

const masNewsroom = newsroomPage(
  'https://masholdings.com/news',
  'MAS Holdings news',
  [
    null, null,
    {
      month: '2026-03',
      headline: 'MAS commissions recycled-fibre capacity in Thulhiriya',
      body: 'The investment lifts recycled polyester content across group output and is aimed squarely at European buyers writing recycled minimums into contracts.',
    },
    null,
    {
      month: '2026-05',
      headline: 'MAS wins a multi-year performance-wear programme with a European sportswear buyer',
      body: 'The company said digital product passport readiness was a condition of the tender.',
    },
    {
      month: '2026-06',
      headline: 'Digital product passport support goes live across the group',
      body: 'Every garment produced on a supported programme now carries a scannable record of materials and origin.',
    },
    null, null,
  ],
);

const masLeadership = leadershipPage(
  'https://masholdings.com/leadership',
  'MAS Holdings leadership',
  carry([
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Suren Fernando', since: 'April 2019' },
        { role: 'Group Chief Operating Officer', name: 'Nathan Sivagananathan', since: 'June 2020' },
        { role: 'Chief Sustainability Officer', name: 'Nadeeka Perera', since: 'February 2023' },
      ],
    },
    null, null, null, null, null, null, null,
  ]),
);

const brandixSustainability = pricingPage(
  'https://brandix.com/sustainability',
  'Brandix sustainability',
  carry([
    {
      lines: [
        { item: 'Water usage against 2019 baseline', price: 'Reduced 34 percent' },
        { item: 'Recycled material content', price: '18 percent of output' },
        { item: 'LEED Platinum certified facilities', price: '6 facilities' },
      ],
      note: 'Reported annually and verified by an external assessor.',
    },
    null, null,
    {
      lines: [
        { item: 'Water usage against 2019 baseline', price: 'Reduced 41 percent' },
        { item: 'Recycled material content', price: '29 percent of output' },
        { item: 'LEED Platinum certified facilities', price: '9 facilities' },
      ],
      note: 'Reported annually and verified by an external assessor. Committed to digital product passport readiness by 2027.',
    },
    null, null, null, null,
  ]),
);

const brandixNewsroom = newsroomPage(
  'https://brandix.com/news',
  'Brandix news',
  [
    null, null, null,
    {
      month: '2026-04',
      headline: 'Brandix commits to digital product passport readiness by 2027',
      body: 'The company published a roadmap but has not said which programmes will be covered first.',
    },
    null, null,
    {
      month: '2026-07',
      headline: 'Brandix appoints a new Chief Executive Officer',
      body: 'The board named an internal candidate after a six-month search, with the outgoing chief executive moving to a non-executive seat.',
    },
    null,
  ],
);

const brandixLeadership = leadershipPage(
  'https://brandix.com/leadership',
  'Brandix leadership',
  carry([
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Ashroff Omar', since: 'January 2012' },
        { role: 'Chief Operating Officer', name: 'Hasitha Premaratne', since: 'March 2021' },
        { role: 'Director, Sustainability', name: 'Ramesh Kumar', since: 'September 2022' },
      ],
    },
    null, null, null, null, null,
    {
      officers: [
        { role: 'Chief Executive Officer', name: 'Hasitha Premaratne', since: 'July 2026' },
        { role: 'Chief Operating Officer', name: 'Vacant', since: 'July 2026' },
        { role: 'Director, Sustainability', name: 'Ramesh Kumar', since: 'September 2022' },
        { role: 'Non-Executive Director', name: 'Ashroff Omar', since: 'July 2026' },
      ],
      note: 'The chief operating officer seat is being recruited following the internal promotion.',
    },
    null,
  ]),
);

const hirdaramaniCapabilities = pricingPage(
  'https://hirdaramani.com/capabilities',
  'Hirdaramani capabilities',
  carry([
    {
      lines: [
        { item: 'Manufacturing footprint', price: '42 facilities across 6 countries' },
        { item: 'Standard programme lead time', price: '40 days' },
        { item: 'Recycled material content', price: '26 percent of output' },
        { item: 'Minimum order', price: '8,000 units per style' },
      ],
      note: 'Casualwear, activewear and outerwear. Carbon-neutral facilities in Sri Lanka and Vietnam.',
    },
    null, null, null,
    {
      lines: [
        { item: 'Manufacturing footprint', price: '44 facilities across 6 countries' },
        { item: 'Standard programme lead time', price: '36 days' },
        { item: 'Recycled material content', price: '34 percent of output' },
        { item: 'Minimum order', price: '6,000 units per style' },
      ],
      note: 'Casualwear, activewear and outerwear. Carbon-neutral facilities in Sri Lanka and Vietnam. Product passport pilot running with two European buyers.',
    },
    null, null, null,
  ]),
);

const hirdaramaniCareers = careersPage(
  'https://hirdaramani.com/careers',
  'Careers at Hirdaramani',
  carry([
    { counts: [{ team: 'Production', open: 12 }, { team: 'Compliance', open: 2 }] },
    null, null,
    { counts: [{ team: 'Production', open: 14 }, { team: 'Compliance', open: 11 }, { team: 'Data and traceability', open: 7 }], note: 'Compliance and traceability hiring is tied to European buyer requirements.' },
    null, null, null, null,
  ]),
);

const espr = regulatorPage(
  'https://ec.europa.eu/espr/notices',
  'EU Ecodesign for Sustainable Products notices',
  [
    null,
    {
      month: '2026-02',
      reference: 'ESPR/2026/TEX-02',
      headline: 'Textile product passport requirements confirmed',
      body: 'Garments placed on the EU market from July 2027 must carry a digital product passport recording fibre composition, country of manufacture and recycled content.',
    },
    null, null,
    {
      month: '2026-05',
      reference: 'ESPR/2026/TEX-06',
      headline: 'Recycled content minimums published for polyester textiles',
      body: 'A minimum of 25 percent recycled content applies to polyester garments from July 2027, rising to 35 percent from 2030.',
    },
    null, null, null,
  ],
);

export const apparel: DomainDef = {
  id: 'apparel',
  label: 'Apparel manufacturing',
  home: 'MAS Holdings',
  geography: 'Sri Lanka · export to EU and US',
  decisionContext:
    'Whether to keep investing ahead of the EU product rules or hold capacity until buyers actually require it.',
  companies: [
    {
      label: 'MAS Holdings',
      what: 'Intimates, sportswear and performance wear, design to delivery',
      homeUrl: 'https://masholdings.com',
      pages: [masCapabilities, masNewsroom, masLeadership],
      share: [34, 34, 35, 35, 36, 37, 37, 38],
      scale: { label: 'Facilities', value: '54 across 17 countries' },
      strengths: [
        'Only one of the three with product passports actually live rather than promised',
        'Recycled content at 41 percent, well past the 25 percent EU minimum',
        'Cut lead time from 45 days to 38 while everyone else moved slower',
      ],
      watchOuts: [
        'Highest minimum order of the three until June, which costs it smaller brands',
        'Heaviest capital spend of the three, ahead of demand',
      ],
      moves: [
        { month: '2026-03', kind: 'expansion', headline: 'Recycled-fibre capacity in Thulhiriya', soWhat: 'Built the capacity three months before the EU published its recycled minimum.', sourceUrl: 'https://masholdings.com/news' },
        { month: '2026-05', kind: 'partnership', headline: 'Won a multi-year European performance-wear programme', soWhat: 'Passport readiness was a condition of the tender — the investment is already paying.', sourceUrl: 'https://masholdings.com/news' },
        { month: '2026-06', kind: 'product', headline: 'Digital product passports live across the group', soWhat: 'A year ahead of the July 2027 requirement, and the only one of the three that is live.', sourceUrl: 'https://masholdings.com/news' },
        { month: '2026-06', kind: 'pricing', headline: 'Minimum order cut from 15,000 to 10,000 units', soWhat: 'Opens mid-sized brands it previously could not serve.', sourceUrl: 'https://masholdings.com/capabilities' },
      ],
    },
    {
      label: 'Brandix',
      what: 'Apparel manufacturing across casual, intimates and activewear',
      homeUrl: 'https://brandix.com',
      pages: [brandixSustainability, brandixNewsroom, brandixLeadership],
      share: [29, 29, 29, 29, 28, 28, 27, 27],
      scale: { label: 'LEED Platinum facilities', value: '9' },
      strengths: [
        'Strongest water and facility-certification record of the three',
        'Recycled content improved from 18 to 29 percent in one step',
      ],
      watchOuts: [
        'Product passports are a 2027 commitment with no programme named — MAS is already live',
        'Changed chief executive in July and the operating chief seat is empty',
      ],
      moves: [
        { month: '2026-04', kind: 'regulatory', headline: 'Committed to product passport readiness by 2027', soWhat: 'A roadmap, not a capability. Buyers writing tenders this year cannot use a promise.', sourceUrl: 'https://brandix.com/news' },
        { month: '2026-07', kind: 'leadership', headline: 'New chief executive promoted internally; operating chief seat vacant', soWhat: 'A leadership transition in the same quarter its main competitor went live with passports.', sourceUrl: 'https://brandix.com/leadership' },
      ],
    },
    {
      label: 'Hirdaramani',
      what: 'Casualwear, activewear and outerwear, carbon-neutral facilities',
      homeUrl: 'https://hirdaramani.com',
      pages: [hirdaramaniCapabilities, hirdaramaniCareers],
      share: [21, 21, 21, 21, 21, 21, 22, 22],
      scale: { label: 'Facilities', value: '44 across 6 countries' },
      strengths: [
        'Lowest minimum order of the three, so it wins smaller brands',
        'Hired eleven compliance and seven traceability people in one quarter',
        'Passport pilot running with two European buyers',
      ],
      watchOuts: [
        'Recycled content at 34 percent is above the minimum but below MAS',
        'Pilot is two buyers, not the whole group',
      ],
      moves: [
        { month: '2026-04', kind: 'regulatory', headline: 'Compliance and traceability headcount jumped from 2 to 18', soWhat: 'The hiring page showed the passport programme starting two months before any announcement did.', sourceUrl: 'https://hirdaramani.com/careers' },
        { month: '2026-05', kind: 'product', headline: 'Product passport pilot with two European buyers', soWhat: 'Ahead of Brandix, behind MAS, and cheaper than either approach.', sourceUrl: 'https://hirdaramani.com/capabilities' },
      ],
    },
  ],
  otherShare: [16, 16, 15, 15, 15, 14, 14, 13],
  regulations: [
    {
      month: '2026-02',
      authority: 'European Commission',
      headline: 'Textile product passports required from July 2027',
      soWhat: 'Fibre composition, origin and recycled content on every garment. This is now a condition in tenders, not a 2027 problem.',
      sourceUrl: 'https://ec.europa.eu/espr/notices',
    },
    {
      month: '2026-05',
      authority: 'European Commission',
      headline: '25 percent recycled-content minimum for polyester from July 2027',
      soWhat: 'MAS is at 41 percent, Hirdaramani 34, Brandix 29. All three clear it — the differentiator is passports, not fibre.',
      sourceUrl: 'https://ec.europa.eu/espr/notices',
    },
  ],
  regulationsPage: espr,
  readOut:
    'European buyers stopped treating sustainability as a nice-to-have this year, and the tender MAS won in May makes that concrete: product passport readiness was a condition of bidding. MAS is the only one of the three with passports actually live, six months after building the recycled-fibre capacity that the EU then made a minimum requirement. Hirdaramani is running a two-buyer pilot and tripled its compliance headcount to get there. Brandix has published a 2027 commitment and no named programme, and changed chief executive in July with the operating chief seat still empty. All three clear the recycled-content bar comfortably, so that is not where this is decided — passports are.',
  outlook: {
    call: 'MAS extends its lead through 2027 tenders, with Hirdaramani taking the smaller-brand end.',
    because: 'Passport readiness is already appearing as a tender condition and only one of the three can answer it today.',
    breaksIf: 'Brandix names a passport programme before year end, or the EU delays the July 2027 date.',
  },
};
