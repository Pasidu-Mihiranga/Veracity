/**
 * Retail banking and payments — Sampath Bank, Commercial Bank, HNB.
 *
 * The story: rates came down through the first half, which squeezed what banks
 * earn on lending and pushed all three toward fee income and digital accounts.
 * The central bank then tightened digital onboarding rules mid-cycle. See the
 * note in `../types.ts` on what these figures are.
 */

import type { DomainDef } from '../types';
import {
  careersPage, carry, changelogPage, leadershipPage, newsroomPage,
  pricingPage, regulatorPage,
} from '../render';

const sampathRates = pricingPage(
  'https://sampath.lk/rates',
  'Sampath Bank rates and fees',
  carry([
    {
      lines: [
        { item: 'Savings account', price: 'Interest 7.50 percent per annum', secondary: 'No minimum balance' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 11.25 percent per annum', secondary: 'Minimum LKR 100,000' },
        { item: 'Personal loan', price: 'Interest from 15.50 percent per annum', secondary: 'Up to 5 years' },
        { item: 'Monthly account fee', price: 'LKR 250', secondary: 'Waived above LKR 100,000 average balance' },
      ],
      note: 'Rates reviewed monthly. Digital account opening available for resident customers.',
    },
    null,
    {
      lines: [
        { item: 'Savings account', price: 'Interest 6.75 percent per annum', secondary: 'No minimum balance' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 10.40 percent per annum', secondary: 'Minimum LKR 100,000' },
        { item: 'Personal loan', price: 'Interest from 14.75 percent per annum', secondary: 'Up to 5 years' },
        { item: 'Monthly account fee', price: 'LKR 250', secondary: 'Waived above LKR 100,000 average balance' },
      ],
      note: 'Rates reviewed monthly. Digital account opening available for resident customers.',
    },
    null,
    {
      lines: [
        { item: 'Savings account', price: 'Interest 6.00 percent per annum', secondary: 'No minimum balance' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 9.60 percent per annum', secondary: 'Minimum LKR 100,000' },
        { item: 'Personal loan', price: 'Interest from 13.90 percent per annum', secondary: 'Up to 5 years' },
        { item: 'Monthly account fee', price: 'LKR 350', secondary: 'Waived above LKR 250,000 average balance' },
      ],
      note: 'Rates reviewed monthly. Digital account opening available for resident customers.',
    },
    null, null, null,
  ]),
);

const sampathChangelog = changelogPage(
  'https://sampath.lk/whats-new',
  'What is new at Sampath',
  [
    { month: '2026-01', items: ['Card controls: freeze and unfreeze from the app.'] },
    null,
    { month: '2026-03', items: ['Instant account opening with digital identity verification.', 'Standing orders can now be edited in the app.'] },
    null,
    { month: '2026-05', items: ['Merchant settlement moved to same-day for QR payments.'] },
    null,
    { month: '2026-07', items: ['Business banking dashboard for SME customers.', 'Bulk payroll upload for companies under 200 staff.'] },
    { month: '2026-08', items: ['Working-capital lending for ride-hailing and delivery drivers, in partnership with PickMe.'] },
  ],
);

const sampathNewsroom = newsroomPage(
  'https://sampath.lk/news',
  'Sampath Bank news',
  [
    null, null,
    {
      month: '2026-03',
      headline: 'Sampath passes 1.9 million digital banking users',
      body: 'Digital transactions now account for 71 percent of all retail transactions, up from 58 percent a year earlier.',
    },
    null, null,
    {
      month: '2026-06',
      headline: 'Sampath raises fee income as lending margins narrow',
      body: 'Fee and commission income grew 22 percent year on year, offsetting a narrower interest margin as policy rates fell.',
    },
    null,
    {
      month: '2026-08',
      headline: 'Sampath partners with PickMe on driver working-capital lending',
      body: 'Drivers with six months of trip history can borrow against future earnings, with repayment collected from weekly settlement.',
    },
  ],
);

const sampathLeadership = leadershipPage(
  'https://sampath.lk/board',
  'Sampath Bank board and management',
  carry([
    {
      officers: [
        { role: 'Chairman', name: 'Harsha Amarasekera', since: 'January 2021' },
        { role: 'Managing Director', name: 'Nanda Fernando', since: 'March 2019' },
        { role: 'Chief Digital Officer', name: 'Ajantha Madurapperuma', since: 'August 2023' },
      ],
    },
    null, null,
    {
      officers: [
        { role: 'Chairman', name: 'Harsha Amarasekera', since: 'January 2021' },
        { role: 'Managing Director', name: 'Nanda Fernando', since: 'March 2019' },
        { role: 'Chief Digital Officer', name: 'Ajantha Madurapperuma', since: 'August 2023' },
        { role: 'Head of SME Banking', name: 'Chathuri Munaweera', since: 'April 2026' },
      ],
      note: 'The SME banking role is newly created.',
    },
    null, null, null, null,
  ]),
);

const combankRates = pricingPage(
  'https://combank.lk/rates',
  'Commercial Bank rates and fees',
  carry([
    {
      lines: [
        { item: 'Savings account', price: 'Interest 7.25 percent per annum', secondary: 'Minimum balance LKR 5,000' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 11.00 percent per annum', secondary: 'Minimum LKR 50,000' },
        { item: 'Personal loan', price: 'Interest from 15.90 percent per annum', secondary: 'Up to 7 years' },
        { item: 'Monthly account fee', price: 'LKR 200', secondary: 'Waived for salary accounts' },
      ],
      note: 'Rates reviewed monthly. Branch network of 268 locations.',
    },
    null, null,
    {
      lines: [
        { item: 'Savings account', price: 'Interest 6.25 percent per annum', secondary: 'Minimum balance LKR 5,000' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 10.10 percent per annum', secondary: 'Minimum LKR 50,000' },
        { item: 'Personal loan', price: 'Interest from 14.20 percent per annum', secondary: 'Up to 7 years' },
        { item: 'Monthly account fee', price: 'LKR 200', secondary: 'Waived for salary accounts' },
      ],
      note: 'Rates reviewed monthly. Branch network of 268 locations.',
    },
    null, null, null, null,
  ]),
);

const combankNewsroom = newsroomPage(
  'https://combank.lk/news',
  'Commercial Bank news',
  [
    null,
    {
      month: '2026-02',
      headline: 'Commercial Bank keeps the largest private branch network',
      body: 'The bank said physical presence remains its main acquisition channel outside the Western Province.',
    },
    null, null,
    {
      month: '2026-05',
      headline: 'Commercial Bank launches instant digital onboarding',
      body: 'Account opening without a branch visit, two months after the same capability appeared at its closest competitor.',
    },
    null, null, null,
  ],
);

const hnbRates = pricingPage(
  'https://hnb.lk/rates',
  'HNB rates and fees',
  carry([
    {
      lines: [
        { item: 'Savings account', price: 'Interest 7.60 percent per annum', secondary: 'No minimum balance' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 11.40 percent per annum', secondary: 'Minimum LKR 100,000' },
        { item: 'Personal loan', price: 'Interest from 15.20 percent per annum', secondary: 'Up to 5 years' },
        { item: 'Monthly account fee', price: 'No monthly fee' },
      ],
      note: 'Rates reviewed monthly. Digital-first accounts available through the HNB app.',
    },
    null,
    {
      lines: [
        { item: 'Savings account', price: 'Interest 6.90 percent per annum', secondary: 'No minimum balance' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 10.60 percent per annum', secondary: 'Minimum LKR 100,000' },
        { item: 'Personal loan', price: 'Interest from 14.40 percent per annum', secondary: 'Up to 5 years' },
        { item: 'Monthly account fee', price: 'No monthly fee' },
      ],
      note: 'Rates reviewed monthly. Digital-first accounts available through the HNB app.',
    },
    null, null,
    {
      lines: [
        { item: 'Savings account', price: 'Interest 6.10 percent per annum', secondary: 'No minimum balance' },
        { item: 'Fixed deposit, 12 months', price: 'Interest 9.75 percent per annum', secondary: 'Minimum LKR 100,000' },
        { item: 'Personal loan', price: 'Interest from 13.60 percent per annum', secondary: 'Up to 5 years' },
        { item: 'Monthly account fee', price: 'No monthly fee' },
      ],
      note: 'Rates reviewed monthly. Digital-first accounts available through the HNB app. SME lending decisions within 48 hours.',
    },
    null, null,
  ]),
);

const hnbCareers = careersPage(
  'https://hnb.lk/careers',
  'Careers at HNB',
  carry([
    { counts: [{ team: 'Branch banking', open: 14 }, { team: 'Digital', open: 6 }] },
    null, null, null,
    { counts: [{ team: 'Branch banking', open: 5 }, { team: 'Digital', open: 21 }, { team: 'SME lending', open: 12 }], note: 'Branch hiring has slowed while digital and SME lending roles have tripled.' },
    null, null, null,
  ]),
);

const cbslCirculars = regulatorPage(
  'https://cbsl.gov.lk/circulars',
  'Central Bank of Sri Lanka circulars',
  [
    {
      month: '2026-01',
      reference: 'CBSL/2026/01',
      headline: 'Policy rate reduced by 100 basis points',
      body: 'The Monetary Board reduced the standing lending facility rate, citing easing inflation and weak private credit growth.',
    },
    null, null,
    {
      month: '2026-04',
      reference: 'CBSL/2026/06',
      headline: 'Policy rate reduced by a further 75 basis points',
      body: 'The Board noted that transmission to lending rates had been slower than expected and urged licensed banks to pass reductions through.',
    },
    null,
    {
      month: '2026-06',
      reference: 'CBSL/2026/11',
      headline: 'Digital onboarding: enhanced identity verification required',
      body: 'Licensed banks offering account opening without a branch visit must complete liveness checks and verify against the national identity database from September 2026.',
    },
    null, null,
  ],
);

export const banking: DomainDef = {
  id: 'banking',
  label: 'Retail banking and payments',
  home: 'Sampath Bank',
  geography: 'Sri Lanka',
  decisionContext:
    'Where to replace the interest income lost to falling policy rates — fees, SME lending, or embedded lending partnerships.',
  companies: [
    {
      label: 'Sampath Bank',
      what: 'Retail and SME bank, strongest digital adoption of the three',
      homeUrl: 'https://sampath.lk',
      pages: [sampathRates, sampathChangelog, sampathNewsroom, sampathLeadership],
      share: [24, 24, 25, 25, 26, 26, 27, 27],
      scale: { label: 'Digital banking users', value: '1.9 million' },
      strengths: [
        'Digital onboarding live two months before its closest rival',
        'Fee income up 22 percent, which is what covers the falling margin',
        'The PickMe lending partnership reaches borrowers no branch network can',
      ],
      watchOuts: [
        'Raised the monthly account fee and the balance waiver together in May — the only one of the three to raise fees',
        'Most exposed to the September identity-verification rule because it onboards digitally at scale',
      ],
      moves: [
        { month: '2026-03', kind: 'product', headline: 'Instant account opening with digital identity checks', soWhat: 'Two months ahead of Commercial Bank on the same capability.', sourceUrl: 'https://sampath.lk/whats-new' },
        { month: '2026-04', kind: 'leadership', headline: 'Created a Head of SME Banking role', soWhat: 'A new seat is the clearest signal of where lending growth is meant to come from.', sourceUrl: 'https://sampath.lk/board' },
        { month: '2026-05', kind: 'pricing', headline: 'Monthly fee raised to LKR 350 and the waiver threshold to LKR 250,000', soWhat: 'Two changes in one: more customers pay, and they pay more. HNB still charges nothing.', sourceUrl: 'https://sampath.lk/rates' },
        { month: '2026-06', kind: 'product', headline: 'Fee income up 22 percent year on year', soWhat: 'The fee strategy is working, and it is what is holding profit up as rates fall.', sourceUrl: 'https://sampath.lk/news' },
        { month: '2026-08', kind: 'partnership', headline: 'Driver lending with PickMe', soWhat: 'Lending inside somebody else’s app, repaid from settlement — no branch, no collections.', sourceUrl: 'https://sampath.lk/news' },
      ],
    },
    {
      label: 'Commercial Bank',
      what: 'Largest private bank, biggest branch network',
      homeUrl: 'https://combank.lk',
      pages: [combankRates, combankNewsroom],
      share: [31, 31, 31, 30, 30, 30, 29, 29],
      scale: { label: 'Branches', value: '268' },
      strengths: [
        'Largest branch network, which still wins customers outside the Western Province',
        'Held its monthly fee flat all year',
      ],
      watchOuts: [
        'Reached digital onboarding two months after Sampath',
        'Cut savings rates hardest of the three, which is what savers notice first',
      ],
      moves: [
        { month: '2026-02', kind: 'expansion', headline: 'Reaffirmed branches as the main acquisition channel', soWhat: 'A deliberate bet against the direction the other two are moving.', sourceUrl: 'https://combank.lk/news' },
        { month: '2026-05', kind: 'product', headline: 'Launched instant digital onboarding', soWhat: 'Two months behind Sampath on the capability that drives account growth.', sourceUrl: 'https://combank.lk/news' },
      ],
    },
    {
      label: 'HNB',
      what: 'Retail bank pushing digital-first accounts and SME lending',
      homeUrl: 'https://hnb.lk',
      pages: [hnbRates, hnbCareers],
      share: [22, 22, 22, 23, 23, 23, 23, 24],
      scale: { label: 'Monthly account fee', value: 'None' },
      strengths: [
        'No monthly account fee at all, against LKR 350 at Sampath',
        'Best savings rate of the three in every month',
        'Digital and SME hiring tripled while branch hiring fell',
      ],
      watchOuts: [
        'No fee income to offset the falling interest margin',
        'SME lending promise of 48-hour decisions is new and untested',
      ],
      moves: [
        { month: '2026-05', kind: 'expansion', headline: 'Digital and SME hiring tripled; branch hiring cut', soWhat: 'The hiring page shows the strategy shift a full quarter before any announcement.', sourceUrl: 'https://hnb.lk/careers' },
        { month: '2026-06', kind: 'product', headline: 'SME lending decisions within 48 hours', soWhat: 'Competing on speed rather than price, in the segment Sampath just created a role for.', sourceUrl: 'https://hnb.lk/rates' },
      ],
    },
  ],
  otherShare: [23, 23, 22, 22, 21, 21, 21, 20],
  regulations: [
    {
      month: '2026-01',
      authority: 'Central Bank of Sri Lanka',
      headline: 'Policy rate cut 100 basis points',
      soWhat: 'The start of the squeeze. Everything the three banks did this year follows from it.',
      sourceUrl: 'https://cbsl.gov.lk/circulars',
    },
    {
      month: '2026-04',
      authority: 'Central Bank of Sri Lanka',
      headline: 'A further 75 basis point cut, with pressure to pass it through',
      soWhat: 'Lending rates had to come down faster than deposit rates, which is exactly where the margin went.',
      sourceUrl: 'https://cbsl.gov.lk/circulars',
    },
    {
      month: '2026-06',
      authority: 'Central Bank of Sri Lanka',
      headline: 'Liveness checks required for digital onboarding from September 2026',
      soWhat: 'Adds a step to the flow that Sampath and Commercial Bank both just built.',
      sourceUrl: 'https://cbsl.gov.lk/circulars',
    },
  ],
  regulationsPage: cbslCirculars,
  readOut:
    'The central bank cut rates twice in the first half and told banks to pass the cuts through to borrowers, which narrowed what all three earn on lending. They responded differently. Sampath went for fees and partnerships: it raised the monthly account fee, lifted the waiver threshold, grew fee income 22 percent, and put lending inside PickMe’s app where it needs no branch. HNB went the other way, charging no monthly fee at all and paying the best savings rate every month, funding it by moving hiring out of branches into digital and SME lending. Commercial Bank stayed on branches and arrived at digital onboarding two months after Sampath. From September, digital account opening needs a liveness check, which slows the flow for the two banks that just built it.',
  outlook: {
    call: 'Sampath keeps taking share from Commercial Bank, but HNB is the one to watch on customer numbers.',
    because: 'Fee-free accounts and the best savings rate win new customers; fees win revenue from existing ones. They are not competing for the same win.',
    breaksIf: 'The September verification rule delays Sampath’s onboarding, or HNB has to introduce a fee to hold margin.',
  },
};
