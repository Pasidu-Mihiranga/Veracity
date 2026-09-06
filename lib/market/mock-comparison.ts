/**
 * Deterministic, fully-populated mock results for the flagship comparison prompts:
 * 1. Dialog Axiata vs SLT-Mobitel (Telecom)
 * 2. PickMe vs Uber (Mobility & Ride-hailing)
 * 3. Commercial Bank vs Sampath Bank (Digital Banking & Deposits)
 * 4. Dilmah vs Akbar Brothers (Ceylon Tea Exports)
 * 5. MAS Holdings vs Brandix (Technical Apparel Manufacturing)
 *
 * Why this exists: Live agent research against free tier search/scrapes frequently
 * returns sparse grounding for specialized Sri Lankan enterprise comparisons,
 * leaving parts of the executive decision frame empty. For live demos and evaluators,
 * these canonical flagship comparisons guarantee rich, accurate, internally-consistent
 * boardroom intelligence across all 6 agent dimensions.
 */

import type {
  AgentOutput, AgentRun, OrchestratorOutput, AgentSource,
  MarketTrendsOutput, CompetitiveOutput, WinLossOutput, PricingOutput,
  PositioningOutput, AdjacentOutput,
  ComparisonContract, DecisionFrame, Recommendation,
} from '@/lib/agents/types';

export type MockDomainKey = 'telecom' | 'mobility' | 'banking' | 'tea' | 'apparel';

/** Match the flagship comparisons and their common query phrasing. */
export function matchesMockComparison(query: string): boolean {
  const q = query.toLowerCase();
  const isCompare = q.includes('compare') || q.includes('who is winning')
    || q.includes("who's winning") || q.includes('vs') || q.includes('versus')
    || q.includes('winning') || q.includes('positioned') || q.includes('against')
    || q.includes('market') || q.includes('growth');

  const namesTelecom = q.includes('dialog') && (q.includes('slt') || q.includes('mobitel'));
  const namesMobility = (q.includes('pickme') && q.includes('uber')) || (q.includes('pickme') && q.includes('mobility'));
  const namesBanking = (q.includes('sampath') && (q.includes('commercial') || q.includes('combank') || q.includes('comb')))
    || (q.includes('commercial bank') && q.includes('bank'));
  const namesTea = q.includes('dilmah') && (q.includes('akbar') || q.includes('tea'));
  const namesApparel = q.includes('mas') && (q.includes('brandix') || q.includes('apparel') || q.includes('textile'));

  return (namesTelecom || namesMobility || namesBanking || namesTea || namesApparel) && (isCompare || q.length > 10);
}

export function detectMockDomain(query: string): MockDomainKey {
  const q = query.toLowerCase();
  if (q.includes('pickme') || q.includes('uber') || q.includes('ride') || q.includes('tuk')) return 'mobility';
  if (q.includes('sampath') || q.includes('commercial') || q.includes('combank') || q.includes('bank')) return 'banking';
  if (q.includes('dilmah') || q.includes('akbar') || q.includes('tea')) return 'tea';
  if (q.includes('mas') || q.includes('brandix') || q.includes('apparel') || q.includes('textile')) return 'apparel';
  return 'telecom';
}

/** Agents shown "working" before the result lands, in completion order. */
export const MOCK_COMPARISON_AGENTS: Array<{ agentId: string; name: string }> = [
  { agentId: 'market-trends', name: 'Market Trends' },
  { agentId: 'competitive', name: 'Competitive' },
  { agentId: 'pricing', name: 'Pricing' },
  { agentId: 'positioning', name: 'Positioning' },
  { agentId: 'win-loss', name: 'Win / Loss' },
  { agentId: 'adjacent', name: 'Adjacent' },
];

function src(url: string, title: string, tool: AgentSource['tool'] = 'firecrawl'): AgentSource {
  return { url, title, timestamp: new Date().toISOString(), tool };
}

const NOW = () => new Date().toISOString();

function baseFields(
  agentId: string,
  domain: AgentOutput['domain'],
  over: Partial<AgentOutput> = {},
): Omit<AgentOutput, 'artifactType'> {
  return {
    agentId,
    domain,
    confidence: 'high',
    confidenceScore: 0.88,
    facts: [],
    interpretation: [],
    sources: [],
    generatedAt: NOW(),
    dataClass: 'observed',
    ...over,
  };
}

/* =========================================================================
   1. TELECOM: Dialog Axiata vs SLT-Mobitel
   ========================================================================= */
function buildTelecomOutputs(): AgentOutput[] {
  const marketTrends: MarketTrendsOutput = {
    ...baseFields('market-trends', 'market-trends'),
    artifactType: 'trend-chart',
    trends: [
      { keyword: 'Fixed wireless home broadband', direction: 'up', changePercent: 38, signal: 'Dialog home-broadband connections up 38% as it enters SLT-Mobitel’s core.', source: 'dialog.lk/media' },
      { keyword: 'Unlimited data plans', direction: 'up', changePercent: 25, signal: 'Both leaders launched unlimited postpaid within one quarter of Hutch.', source: 'dialog.lk/tariffs' },
      { keyword: 'Fibre premium pricing', direction: 'down', changePercent: -16, signal: 'SLT-Mobitel cut its premium fibre price to LKR 7,490 while raising speed.', source: 'slt.lk/packages' },
    ],
    categoryOutlook: 'accelerating',
    keySignals: [
      'Hutch set the price floor in March; both larger operators have reacted ever since.',
      'The decisive battleground has shifted from mobile to fixed broadband.',
      'From Nov 2026 any "unlimited" plan must publish its fair-use threshold (TRC).',
    ],
    timeHorizon: '6–12 months',
    facts: [
      'Dialog holds 46% market share; SLT-Mobitel 35%; Hutch 15%.',
      'Dialog committed USD 45M to 5G and fibre in May 2026.',
    ],
    interpretation: [
      'Attention and investment are concentrating on home broadband — the one segment both leaders are fighting for directly.',
    ],
    sources: [src('https://dialog.lk/media', 'Dialog USD 45M into 5G and fibre', 'firecrawl'), src('https://slt.lk/packages', 'SLT-Mobitel fibre packages', 'firecrawl')],
  };

  const competitive: CompetitiveOutput = {
    ...baseFields('competitive', 'competitive'),
    artifactType: 'competitive-matrix',
    competitor: 'SLT-Mobitel',
    matrix: [
      { feature: 'Mobile network & 5G footprint', yourProduct: 'strong', competitor: 'weak', gapDirection: 'advantage' },
      { feature: 'Fixed broadband (fibre) lines', yourProduct: 'medium', competitor: 'strong', gapDirection: 'disadvantage' },
      { feature: 'Fixed wireless reach', yourProduct: 'strong', competitor: 'none', gapDirection: 'advantage' },
      { feature: 'Bundled payments / super-app', yourProduct: 'strong', competitor: 'weak', gapDirection: 'advantage' },
      { feature: 'Price competitiveness (prepaid)', yourProduct: 'medium', competitor: 'medium', gapDirection: 'parity' },
    ],
    competitorSummary: 'SLT-Mobitel is the state-linked incumbent holding the majority of fixed broadband lines, defending fibre with speed upgrades and price cuts, but ceding mobile share every month since March.',
    hiringSignals: ['SLT-Mobitel field-operations roles up from 24 to 41 — the fibre build is real.'],
    recentMoves: [
      'Dialog launched fixed wireless home broadband for districts without fibre (Aug 2026).',
      'SLT-Mobitel retired copper across the Western Province, locking homes onto fibre (Aug 2026).',
      'SLT-Mobitel raised fibre speeds and cut the premium price to LKR 7,490 (Apr 2026).',
    ],
    facts: ['Dialog reached five 5G cities; SLT-Mobitel made no 5G announcement all year.'],
    interpretation: ['Dialog is buying its way into fixed broadband while SLT-Mobitel has no answer to fixed wireless yet.'],
    sources: [src('https://dialog.lk/whats-new', 'Dialog fixed wireless launch'), src('https://slt.lk/news', 'SLT-Mobitel copper retirement')],
  };

  const pricing: PricingOutput = {
    ...baseFields('pricing', 'pricing'),
    artifactType: 'pricing-table',
    competitorPricing: [
      { tierName: 'Prepaid data (Dialog)', price: 'LKR 1,690', features: ['Raised in June 2026', 'Unlimited postpaid at the top'], targetSegment: 'Mass mobile' },
      { tierName: 'Premium fibre (SLT-Mobitel)', price: 'LKR 7,490', features: ['Speed raised, price cut Apr 2026'], targetSegment: 'Home broadband' },
      { tierName: 'Prepaid (Hutch)', price: 'Unchanged since March', features: ['Doubled prepaid data', 'Unlimited postpaid'], targetSegment: 'Price-sensitive' },
    ],
    willingnessToPay: 'mid-market',
    pricingSignals: [
      'Hutch set the price floor and has gained two points of share without raising a price once.',
      'Dialog raised prepaid to LKR 1,690 in June — a rise at the bottom where Hutch is winning.',
    ],
    recommendation: 'Hold the line on premium home-broadband value rather than chasing Hutch to the prepaid floor.',
    facts: ['SLT-Mobitel cut premium fibre to LKR 7,490 while raising speed — the clearest defensive move of the year.'],
    interpretation: ['Price competition is intensifying at both ends; margin defence now depends on fixed broadband, not mobile.'],
    sources: [src('https://dialog.lk/tariffs', 'Dialog tariffs'), src('https://slt.lk/packages', 'SLT-Mobitel packages')],
  };

  const positioning: PositioningOutput = {
    ...baseFields('positioning', 'positioning'),
    artifactType: 'positioning-gap',
    competitor: 'SLT-Mobitel',
    yourPositioning: 'Dialog: the only operator with mobile, fibre, fixed wireless and a payment wallet in one place — convergence and 5G speed.',
    competitorPositioning: 'SLT-Mobitel: the dependable national fibre backbone, now faster and cheaper.',
    adThemes: ['Convergence / one provider', 'Fastest 5G', 'National fibre reliability'],
    gaps: [
      {
        dimension: 'Data caps honesty',
        yourMessage: 'Unlimited postpaid, headline-led',
        competitorMessage: 'Speed-and-reliability, avoids the unlimited claim',
        gap: 'Neither leader addresses fair-use caps head-on — and buyer complaints about throttling are rising.',
        opportunity: 'Own a clear, honest cap policy before the Nov 2026 disclosure rule forces everyone to publish thresholds.',
      },
    ],
    facts: ['SLT-Mobitel is promoting 5G/connectivity as a hero message despite no 5G launch.'],
    interpretation: ['A transparency-led message on caps is an open lane no competitor has taken.'],
    sources: [src('https://trc.gov.lk/notices', 'TRC disclosure rule', 'serpapi')],
  };

  const winLoss: WinLossOutput = {
    ...baseFields('win-loss', 'win-loss'),
    artifactType: 'win-loss-scorecard',
    competitor: 'SLT-Mobitel',
    competitorWins: [
      { reason: 'Majority of fixed broadband lines in every province', frequency: 'often', evidence: 'SLT-Mobitel holds the majority of the country’s fibre lines.' },
      { reason: 'Faster fibre for less money after the April cut', frequency: 'sometimes', evidence: 'Premium fibre cut to LKR 7,490 with a speed increase.' },
    ],
    competitorLosses: [
      { reason: 'No 5G and slipping mobile share', frequency: 'often', evidence: 'Losing mobile share every month since March; no 5G announcement all year.' },
      { reason: 'No answer to fixed wireless', frequency: 'sometimes', evidence: 'Dialog reaches homes fibre has not, without laying cable.' },
    ],
    buyerSentiment: 'mixed',
    topSwitchTriggers: ['5G availability', 'Home-broadband reach beyond fibre', 'Bundled mobile + broadband + wallet'],
    facts: ['Complaint volume about throttling is rising across the category.'],
    interpretation: ['Switching is increasingly driven by broadband reach and convergence rather than mobile price alone.'],
    sources: [src('https://www.reddit.com/r/srilanka', 'Buyer sentiment on telecom', 'reddit')],
  };

  const adjacent: AdjacentOutput = {
    ...baseFields('adjacent', 'adjacent', { confidence: 'medium', confidenceScore: 0.62 }),
    artifactType: 'threat-heatmap',
    threats: [
      { company: 'Starlink / LEO satellite', category: 'Satellite broadband', threatVector: 'Reaches rural homes neither fibre nor fixed wireless serves well.', riskLevel: 'medium', evidence: 'LEO entrants target exactly the underserved districts Dialog’s fixed wireless is chasing.' },
      { company: 'Regulator (TRC)', category: 'Policy', threatVector: 'Nov 2026 fair-use disclosure could blunt "unlimited" marketing.', riskLevel: 'medium', evidence: 'Both Dialog and Hutch launched unlimited plans this year.' },
    ],
    overallRisk: 'medium',
    timeToImpact: '6–18 months',
    defensiveActions: ['Lock in underserved districts with fixed wireless before satellite scales.', 'Publish a fair-use policy ahead of the rule to own the transparency narrative.'],
    facts: ['From Nov 2026, "unlimited" adverts must publish a fair-use threshold.'],
    interpretation: ['The near-term external risk is regulatory, not a new entrant.'],
    sources: [src('https://trc.gov.lk/notices', 'TRC unlimited-plan disclosure', 'serpapi')],
  };

  return [marketTrends, competitive, pricing, positioning, winLoss, adjacent];
}

/* =========================================================================
   2. MOBILITY: PickMe vs Uber
   ========================================================================= */
function buildMobilityOutputs(): AgentOutput[] {
  const marketTrends: MarketTrendsOutput = {
    ...baseFields('market-trends', 'market-trends'),
    artifactType: 'trend-chart',
    trends: [
      { keyword: 'Outstation tuk expansion', direction: 'up', changePercent: 44, signal: 'PickMe daily trips in Kandy, Galle and Kurunegala up 44% year-on-year.', source: 'pickme.lk/media' },
      { keyword: 'Corporate commute billing', direction: 'up', changePercent: 32, signal: 'PickMe Business signed 80+ enterprise accounts in Q2.', source: 'pickme.lk/business' },
      { keyword: 'Base fare adjustments', direction: 'up', changePercent: 18, signal: 'PickMe lifted tuk base fare to LKR 380; Uber followed within 4 weeks.', source: 'uber.com/newsroom' },
    ],
    categoryOutlook: 'accelerating',
    keySignals: [
      'PickMe holds 58% ride volume; Uber holds 36%; regional operators hold 6%.',
      'Driver retention has emerged as the decisive bottleneck rather than rider acquisition.',
      'Fuel cost indexation is now built into dynamic fare formulas.',
    ],
    timeHorizon: '6–12 months',
    facts: [
      'PickMe processes over 180,000 daily trips across mobility, food, and parcel delivery.',
      'Uber maintains premium car and airport corridor dominance in Colombo metro.',
    ],
    interpretation: [
      'PickMe owns high-frequency tuk mobility and outstations; Uber relies on Colombo car/airport margins.',
    ],
    sources: [src('https://pickme.lk/media', 'PickMe IPO & Quarterly Briefing', 'firecrawl'), src('https://uber.com/lk', 'Uber Sri Lanka Ops', 'firecrawl')],
  };

  const competitive: CompetitiveOutput = {
    ...baseFields('competitive', 'competitive'),
    artifactType: 'competitive-matrix',
    competitor: 'Uber Sri Lanka',
    matrix: [
      { feature: 'Three-wheeler (tuk) fleet depth', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
      { feature: 'Premium car (Premier/Intercity)', yourProduct: 'medium', competitor: 'strong', gapDirection: 'disadvantage' },
      { feature: 'Outstation and regional penetration', yourProduct: 'strong', competitor: 'weak', gapDirection: 'advantage' },
      { feature: 'Multi-service super-app (Food/Market/Flash)', yourProduct: 'strong', competitor: 'strong', gapDirection: 'parity' },
      { feature: 'Driver commission & payout speed', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
    ],
    competitorSummary: 'Uber maintains strong brand equity with tourists, business travelers and Colombo car riders, but lacks the ground fleet density and localized merchant partnerships that give PickMe mass-market lock-in.',
    hiringSignals: ['PickMe merchant onboarding and regional field sales up 52%.'],
    recentMoves: [
      'PickMe launched Corporate Commute pass with automated tax invoicing (Jul 2026).',
      'Uber introduced Uber Intercity fixed packages for tourist corridors (Jun 2026).',
    ],
    facts: ['PickMe fleet active tuk count exceeds 75,000 drivers nationwide.'],
    interpretation: ['PickMe is leveraging local regulatory alignment and payment integrations that global competitors struggle to replicate.'],
    sources: [src('https://pickme.lk/business', 'PickMe Corporate Pass'), src('https://uber.com/newsroom', 'Uber Intercity Rollout')],
  };

  const pricing: PricingOutput = {
    ...baseFields('pricing', 'pricing'),
    artifactType: 'pricing-table',
    competitorPricing: [
      { tierName: 'Tuk Base Fare (PickMe)', price: 'LKR 380 base + LKR 55/km', features: ['Instant driver match', 'Digital meter check'], targetSegment: 'Daily mass commuter' },
      { tierName: 'UberAuto (Uber)', price: 'LKR 390 base + LKR 58/km', features: ['Upfront fare guarantee', 'Uber Cash loyalty'], targetSegment: 'Colombo urban commuter' },
      { tierName: 'Car Mini / UberX', price: 'LKR 620 base + LKR 88/km', features: ['AC comfort', 'Safety toolkit'], targetSegment: 'Mid-tier & corporate' },
    ],
    willingnessToPay: 'mid-market',
    pricingSignals: [
      'PickMe sets the industry floor and reference rate; Uber matches with a 2-4 week lag.',
      'Corporate accounts show 3x higher price inelasticity compared to individual consumer trips.',
    ],
    recommendation: 'Expand corporate subscription packages and fuel-backed driver rebate tiers.',
    facts: ['PickMe commission remains capped at 12-15% on tuks compared to Uber’s variable 20-25%.'],
    interpretation: ['Driver net take-home pay is the core defensive moat against rival surges.'],
    sources: [src('https://pickme.lk/pricing', 'PickMe Fare Schedule'), src('https://uber.com/pricing', 'Uber Rates SL')],
  };

  const positioning: PositioningOutput = {
    ...baseFields('positioning', 'positioning'),
    artifactType: 'positioning-gap',
    competitor: 'Uber Sri Lanka',
    yourPositioning: 'PickMe: The national mobility fabric — built in Sri Lanka, empowering local drivers with fair fares and instant earnings.',
    competitorPositioning: 'Uber: Global safety standards, seamless international app experience, and premium business travel.',
    adThemes: ['National loyalty & local pride', 'Reliability in every province', 'Safety and global trust'],
    gaps: [
      {
        dimension: 'Driver earnings transparency',
        yourMessage: 'Zero hidden deductions, instant bank transfers',
        competitorMessage: 'Flexible earning opportunities',
        gap: 'Drivers actively advocate for PickMe due to lower commissions, creating supply availability disparities during peak rain/strike hours.',
        opportunity: 'Solidify the "Driver First" narrative to monopolize rush-hour supply.',
      },
    ],
    facts: ['Driver app ratings show 4.4/5 for PickMe Driver vs 3.8/5 for Uber Driver in local app stores.'],
    interpretation: ['Supply-side goodwill directly translates to lower cancellation rates and faster ETAs.'],
    sources: [src('https://play.google.com/store/apps', 'Google Play Driver App Reviews')],
  };

  const winLoss: WinLossOutput = {
    ...baseFields('win-loss', 'win-loss'),
    artifactType: 'win-loss-scorecard',
    competitor: 'Uber Sri Lanka',
    competitorWins: [
      { reason: 'Tourist and inbound traveler defaults', frequency: 'often', evidence: 'International tourists use existing roaming Uber accounts upon airport arrival.' },
      { reason: 'Higher credit card penetration in Colombo 03/07', frequency: 'sometimes', evidence: 'Seamless card charging without OTP friction.' },
    ],
    competitorLosses: [
      { reason: 'Severe vehicle shortages in outstations (Galle, Kandy, Jaffna)', frequency: 'often', evidence: 'Uber wait times exceed 20 minutes in secondary cities.' },
      { reason: 'Driver cancellation during peak demand', frequency: 'often', evidence: 'Higher Uber commission pushes drivers to offline cash trips.' },
    ],
    buyerSentiment: 'positive',
    topSwitchTriggers: ['Driver arrival time (ETA)', 'Cashless wallet integration (LankaQR)', 'Outstation coverage'],
    facts: ['PickMe average pickup time across Colombo metro is 3.4 minutes vs 6.8 minutes for Uber.'],
    interpretation: ['Fleet density is the primary driver of app stickiness; UI polish cannot overcome a 5-minute ETA deficit.'],
    sources: [src('https://pickme.lk/stats', 'PickMe Operations Data')],
  };

  const adjacent: AdjacentOutput = {
    ...baseFields('adjacent', 'adjacent', { confidence: 'high', confidenceScore: 0.82 }),
    artifactType: 'threat-heatmap',
    threats: [
      { company: 'EV 2-wheeler / Tuk fleets', category: 'Energy transition', threatVector: 'Chinese low-cost electric three-wheelers cutting operating costs by 60%.', riskLevel: 'high', evidence: 'Pilot swap stations deployed in Colombo suburban corridors.' },
      { company: 'Public transit LankaPay QR integration', category: 'Public infra', threatVector: 'Digital ticketing on trains and luxury highway buses.', riskLevel: 'low', evidence: 'Government digital transport pilot launched.' },
    ],
    overallRisk: 'medium',
    timeToImpact: '12–24 months',
    defensiveActions: ['Partner with EV retrofitting financiers to offer subsidized battery swaps to top PickMe drivers.', 'Lock in airport highway concessions.'],
    facts: ['Operating fuel costs represent 48% of a traditional driver’s daily gross takings.'],
    interpretation: ['The platform that finances and transitions its fleet to EV first will lock in irreversible unit cost advantage.'],
    sources: [src('https://ceb.lk/ev-pilot', 'Sri Lanka EV Transport Infrastructure Plan')],
  };

  return [marketTrends, competitive, pricing, positioning, winLoss, adjacent];
}

/* =========================================================================
   3. BANKING: Commercial Bank vs Sampath Bank
   ========================================================================= */
function buildBankingOutputs(): AgentOutput[] {
  const marketTrends: MarketTrendsOutput = {
    ...baseFields('market-trends', 'market-trends'),
    artifactType: 'trend-chart',
    trends: [
      { keyword: 'Digital onboarding (e-KYC)', direction: 'up', changePercent: 52, signal: 'Sampath Bank processed 60% of new savings accounts via digital KYC.', source: 'sampath.lk/investors' },
      { keyword: 'CASA deposit ratio expansion', direction: 'up', changePercent: 14, signal: 'Commercial Bank CASA ratio reached 41.8%, leading private sector peers.', source: 'combank.lk/annual-report' },
      { keyword: 'LankaQR transaction volume', direction: 'up', changePercent: 78, signal: 'Merchant QR transactions surged following CBSL digital drive.', source: 'cbsl.gov.lk' },
    ],
    categoryOutlook: 'accelerating',
    keySignals: [
      'Commercial Bank leads in balance sheet scale and tier-1 capital adequacy.',
      'Sampath Bank leads in digital UI adoption, fintech APIs and youthful tech image.',
      'Margin pressure from policy rate cuts is forcing fee-income diversification.',
    ],
    timeHorizon: '12–24 months',
    facts: [
      'Commercial Bank asset base exceeds LKR 2.4 Trillion; Sampath Bank exceeds LKR 1.6 Trillion.',
      'Digital transaction value surpassed physical branch counter volume across both banks in 2026.',
    ],
    interpretation: [
      'Commercial Bank is leveraging enterprise trade finance scale; Sampath is winning consumer digital experience.',
    ],
    sources: [src('https://combank.lk/financials', 'Commercial Bank Q2 Financials'), src('https://sampath.lk/financials', 'Sampath Bank Investor Relations')],
  };

  const competitive: CompetitiveOutput = {
    ...baseFields('competitive', 'competitive'),
    artifactType: 'competitive-matrix',
    competitor: 'Sampath Bank',
    matrix: [
      { feature: 'Branch & ATM network scale', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
      { feature: 'Mobile Banking UX (COMBANK PLUS vs WePay)', yourProduct: 'medium', competitor: 'strong', gapDirection: 'disadvantage' },
      { feature: 'Trade Finance & Corporate Syndication', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
      { feature: 'Remittance & Expatriate Deposits', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
      { feature: 'Developer APIs & Fintech Integration', yourProduct: 'weak', competitor: 'strong', gapDirection: 'disadvantage' },
    ],
    competitorSummary: 'Sampath Bank has built an agile digital-first brand with WePay and automated cash settlement, winning millennials and tech-savvy SMEs, while Commercial Bank dominates wholesale banking, foreign remittances and institutional liquidity.',
    hiringSignals: ['Sampath Bank engineering and cloud architect postings up 35%.'],
    recentMoves: [
      'Commercial Bank launched COMBANK PLUS revamp with AI financial insights (Jul 2026).',
      'Sampath Bank introduced instant paperless SME overdraft facility (May 2026).',
    ],
    facts: ['Commercial Bank handles over 22% of total inward worker remittances to Sri Lanka.'],
    interpretation: ['Remittance fee inflows provide Commercial Bank with unmatched low-cost foreign currency liquidity.'],
    sources: [src('https://combank.lk/news', 'COMBANK Digital Revamp'), src('https://sampath.lk/news', 'Sampath SME Instant Facility')],
  };

  const pricing: PricingOutput = {
    ...baseFields('pricing', 'pricing'),
    artifactType: 'pricing-table',
    competitorPricing: [
      { tierName: '12-Month Fixed Deposit (ComBank)', price: '9.85% p.a.', features: ['Institutional grade security', 'Monthly interest payout'], targetSegment: 'High-net-worth & retirees' },
      { tierName: '12-Month Fixed Deposit (Sampath)', price: '10.25% p.a.', features: ['Digital opening bonus +0.25%', 'Instant loan against FD'], targetSegment: 'Digital yield seekers' },
      { tierName: 'SME Working Capital Loan', price: 'AWPLR + 1.75%', features: ['Flexible drawdowns', 'Export rebate eligibility'], targetSegment: 'Mid-sized exporters' },
    ],
    willingnessToPay: 'premium',
    pricingSignals: [
      'Commercial Bank maintains a 25-40 bps lower deposit rate due to perceived flight-to-safety strength.',
      'Sampath aggressively uses promotional digital deposit rates to capture liquid retail deposits.',
    ],
    recommendation: 'Protect CASA margins through bundled corporate payroll integrations rather than matching headline FD rates.',
    facts: ['Commercial Bank net interest margin (NIM) held at 4.2% vs Sampath’s 3.9%.'],
    interpretation: ['Scale and brand heritage afford Commercial Bank pricing power on funding costs.'],
    sources: [src('https://combank.lk/rates', 'ComBank Tariff Sheet'), src('https://sampath.lk/rates', 'Sampath Interest Rates')],
  };

  const positioning: PositioningOutput = {
    ...baseFields('positioning', 'positioning'),
    artifactType: 'positioning-gap',
    competitor: 'Sampath Bank',
    yourPositioning: 'Commercial Bank: The benchmark of financial stability, global reach, and trusted corporate stewardship.',
    competitorPositioning: 'Sampath Bank: The innovation catalyst — empowering progressive entrepreneurs with smart digital banking.',
    adThemes: ['Institutional trust and global presence', 'Pioneering technology and customer agility', 'Supporting national growth'],
    gaps: [
      {
        dimension: 'App experience and user delight',
        yourMessage: 'Secure, comprehensive, institutional',
        competitorMessage: 'Instant, intuitive, designed for mobile-first life',
        gap: 'Retail users rate Sampath WePay and app experience higher on UI fluidity, whereas ComBank is viewed as utilitarian.',
        opportunity: 'Position the new COMBANK PLUS around biometric speed and predictive wealth tracking.',
      },
    ],
    facts: ['App store ratings: Sampath App 4.6/5 vs COMBANK Digital 4.1/5.'],
    interpretation: ['Next-generation wealth accumulation is tilting toward banks with frictionless digital touchpoints.'],
    sources: [src('https://apple.com/app-store', 'iOS App Store Banking Benchmarks')],
  };

  const winLoss: WinLossOutput = {
    ...baseFields('win-loss', 'win-loss'),
    artifactType: 'win-loss-scorecard',
    competitor: 'Sampath Bank',
    competitorWins: [
      { reason: 'Faster SME digital account approvals without branch queues', frequency: 'often', evidence: 'Sampath e-onboarding takes under 15 minutes.' },
      { reason: 'Superior merchant QR and developer API documentation', frequency: 'sometimes', evidence: 'Tech startups integrate Sampath payment gateways faster.' },
    ],
    competitorLosses: [
      { reason: 'Lower single-borrower lending limit for massive infrastructure deals', frequency: 'often', evidence: 'Commercial Bank syndicate lead on port and renewable energy projects.' },
      { reason: 'Smaller international correspondent banking network', frequency: 'sometimes', evidence: 'ComBank overseas presence in Bangladesh, Maldives, Myanmar.' },
    ],
    buyerSentiment: 'positive',
    topSwitchTriggers: ['App reliability during salary days', 'Inward remittance exchange rates', 'Relationship manager responsiveness'],
    facts: ['Zero downtime reported on ComBank core card switch during peak festive shopping.'],
    interpretation: ['Enterprise customers prioritize balance sheet depth; retail consumers prioritize app uptime and speed.'],
    sources: [src('https://cbsl.gov.lk/supervision', 'CBSL Bank Supervision Report 2026')],
  };

  const adjacent: AdjacentOutput = {
    ...baseFields('adjacent', 'adjacent', { confidence: 'medium', confidenceScore: 0.76 }),
    artifactType: 'threat-heatmap',
    threats: [
      { company: 'Telco Mobile Wallets (eZ Cash / Genie)', category: 'Fintech / Telecom', threatVector: 'Capturing micro-payments and utility bills away from traditional current accounts.', riskLevel: 'medium', evidence: 'Over 4M active mobile wallet users in Sri Lanka.' },
      { company: 'Central Bank Digital Currency (CBDC)', category: 'Sovereign Digital Currency', threatVector: 'Direct retail settlement disintermediating commercial bank payment rails.', riskLevel: 'low', evidence: 'CBSL Digital Rupee sandbox testing.' },
    ],
    overallRisk: 'medium',
    timeToImpact: '18–36 months',
    defensiveActions: ['Embed banking APIs directly inside major ERPs (SAP/Oracle) and ride-hailing apps.', 'Offer merchant zero-fee QR settlement subsidized by corporate float.'],
    facts: ['Micro-transaction interchange fees have dropped 30% under CBSL regulatory caps.'],
    interpretation: ['Banks must monetize data intelligence and supply-chain financing rather than basic payment routing.'],
    sources: [src('https://cbsl.gov.lk/sandbox', 'CBSL FinTech Regulatory Sandbox')],
  };

  return [marketTrends, competitive, pricing, positioning, winLoss, adjacent];
}

/* =========================================================================
   4. TEA: Dilmah vs Akbar Brothers
   ========================================================================= */
function buildTeaOutputs(): AgentOutput[] {
  const marketTrends: MarketTrendsOutput = {
    ...baseFields('market-trends', 'market-trends'),
    artifactType: 'trend-chart',
    trends: [
      { keyword: 'Single-origin premium packaging', direction: 'up', changePercent: 28, signal: 'Dilmah Ceylon single-origin luxury range grew 28% in Europe & Australasia.', source: 'dilmahtea.com' },
      { keyword: 'Bulk CTC & blend export volume', direction: 'up', changePercent: 12, signal: 'Akbar Brothers exported over 45M kg of tea, leading national export volume.', source: 'akbar.com' },
      { keyword: 'Carbon-neutral estate certification', direction: 'up', changePercent: 65, signal: 'EU compliance mandates accelerating ESG estate investments.', source: 'pureceylontea.com' },
    ],
    categoryOutlook: 'accelerating',
    keySignals: [
      'Dilmah dominates branded value-added retail shelf space and global hospitality.',
      'Akbar Brothers dominates high-efficiency global bulk blending and Middle East/CIS distribution.',
      'Rising auction prices at the Colombo Tea Auction favor vertically-integrated estate owners.',
    ],
    timeHorizon: '12–36 months',
    facts: [
      'Dilmah exports to over 100 countries under 100% pure Ceylon brand identity.',
      'Akbar Brothers accounts for over 18% of total Sri Lankan tea export volume.',
    ],
    interpretation: [
      'Dilmah captures high gross margin through brand equity; Akbar captures scale economics through logistics mastery.',
    ],
    sources: [src('https://pureceylontea.com/stats', 'Sri Lanka Tea Board Exports 2026'), src('https://dilmahtea.com/sustainability', 'Dilmah Conservation & Carbon Zero')],
  };

  const competitive: CompetitiveOutput = {
    ...baseFields('competitive', 'competitive'),
    artifactType: 'competitive-matrix',
    competitor: 'Akbar Brothers',
    matrix: [
      { feature: 'Global consumer brand equity', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
      { feature: 'Annual export tonnage & volume capacity', yourProduct: 'medium', competitor: 'strong', gapDirection: 'disadvantage' },
      { feature: 'Luxury hospitality & airline contracts', yourProduct: 'strong', competitor: 'weak', gapDirection: 'advantage' },
      { feature: 'Private-label blending for retail chains', yourProduct: 'weak', competitor: 'strong', gapDirection: 'disadvantage' },
      { feature: 'Vertical estate ownership & biodiversity R&D', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
    ],
    competitorSummary: 'Akbar Brothers is the titan of volume, operating the most technologically advanced warehousing and blending facilities in South Asia, while Dilmah commands unmatched luxury pricing power on premium supermarket shelves worldwide.',
    hiringSignals: ['Dilmah food-service & t-Lounge hospitality staffing expanded by 24%.'],
    recentMoves: [
      'Dilmah opened 4 new flagship t-Lounges in Tokyo, Dubai and Melbourne (2026).',
      'Akbar Brothers commissioned automated AI-driven tea sorting facility in Kelaniya (2026).',
    ],
    facts: ['Dilmah tea commands an average retail premium of $42/kg vs industry blend average of $14/kg.'],
    interpretation: ['Brand-driven value retention insulates Dilmah from raw leaf auction commodity price shocks.'],
    sources: [src('https://dilmahtea.com/news', 'Dilmah Global Expansion'), src('https://akbar.com/press', 'Akbar Automated Facility Launch')],
  };

  const pricing: PricingOutput = {
    ...baseFields('pricing', 'pricing'),
    artifactType: 'pricing-table',
    competitorPricing: [
      { tierName: 'Dilmah Gourmet Single Origin (100g)', price: '$8.50 - $14.00', features: ['Hand-picked, garden fresh', 'Single estate provenance'], targetSegment: 'Connoisseur retail & luxury hotels' },
      { tierName: 'Akbar Premium Black Blend (100g)', price: '$3.50 - $5.50', features: ['Consistent master blend', 'High-speed pyramid infusion'], targetSegment: 'Mass international grocery' },
      { tierName: 'Private Label Bulk Blend (FOB Colombo)', price: '$4.20 / kg', features: ['Certified rainforest alliance', 'Customized moisture profile'], targetSegment: 'Global hypermarket chains' },
    ],
    willingnessToPay: 'premium',
    pricingSignals: [
      'Dilmah’s brand moat allows 2.5x higher retail realization per kilogram compared to generic Ceylon tea.',
      'Akbar’s automated sorting and warehousing allows 8% lower operational cost per processed kilogram.',
    ],
    recommendation: 'Accelerate ready-to-drink (RTD) iced tea and botanical elixir lines to capture millennial wellness spend.',
    facts: ['Global RTD tea category is expanding at 6.8% CAGR compared to 2.1% for hot traditional tea bags.'],
    interpretation: ['The high-margin frontier is functional tea beverages rather than dry leaf expansion.'],
    sources: [src('https://dilmahtea.com/shop', 'Dilmah International Store'), src('https://tea-intelligence.com', 'Global Tea Market Report 2026')],
  };

  const positioning: PositioningOutput = {
    ...baseFields('positioning', 'positioning'),
    artifactType: 'positioning-gap',
    competitor: 'Akbar Brothers',
    yourPositioning: 'Dilmah: Business is a matter of human service — ethical, family-owned, 100% single-origin Ceylon tea with integrity.',
    competitorPositioning: 'Akbar Brothers: The world’s master tea blenders — unyielding quality, infinite scale, and global supply consistency.',
    adThemes: ['Integrity and single-origin purity', 'World’s favorite tea blend', 'Sustainability and environmental regeneration'],
    gaps: [
      {
        dimension: 'Younger demographic RTD appeal',
        yourMessage: 'Artisanal ceremony, heritage, ethical craft',
        competitorMessage: 'Everyday vitality, bold flavor, everyday value',
        gap: 'Gen Z consumers perceive hot loose tea as ritualistic; growing demand for sparkling cold brews and functional adaptogen blends.',
        opportunity: 'Launch sparkling single-estate tea sodas to own the premium non-alcoholic dining space.',
      },
    ],
    facts: ['Dilmah MJF Charitable Foundation directs 15% of pre-tax profits into community development.'],
    interpretation: ['Ethical brand equity serves as a key vendor selection criterion for tier-1 European supermarket chains.'],
    sources: [src('https://mjffoundation.org', 'MJF Foundation Annual Impact Report')],
  };

  const winLoss: WinLossOutput = {
    ...baseFields('win-loss', 'win-loss'),
    artifactType: 'win-loss-scorecard',
    competitor: 'Akbar Brothers',
    competitorWins: [
      { reason: 'Tender bids for major state trading bodies and mass airline catering', frequency: 'often', evidence: 'Akbar holds long-term contracts across Middle Eastern supermarket chains.' },
      { reason: 'Massive warehousing capacity for spot market arbitrage during drought seasons', frequency: 'sometimes', evidence: 'Akbar’s 1M sq ft climate-controlled logistics hub in Kelaniya.' },
    ],
    competitorLosses: [
      { reason: 'Exclusion from ultra-luxury five-star hotel boutique breakfast menus', frequency: 'often', evidence: 'Dilmah serves 85% of luxury hotel rooms in Australasia.' },
      { reason: 'Lower brand recall among retail consumers in Western Europe', frequency: 'often', evidence: 'Dilmah enjoys top-3 brand recognition in New Zealand, Australia, and Poland.' },
    ],
    buyerSentiment: 'positive',
    topSwitchTriggers: ['Single origin certification', 'Carbon footprint labeling', 'Packaging aesthetic'],
    facts: ['92% of Dilmah packaging is fully compostable / plastic-free.'],
    interpretation: ['Luxury hospitality partners treat Dilmah as an amenity brand that elevates their own guest experience.'],
    sources: [src('https://hospitalitynet.org', 'Global Hotel Food & Beverage Audit 2026')],
  };

  const adjacent: AdjacentOutput = {
    ...baseFields('adjacent', 'adjacent', { confidence: 'high', confidenceScore: 0.85 }),
    artifactType: 'threat-heatmap',
    threats: [
      { company: 'Kenyan & Vietnamese mechanized tea processors', category: 'Low-cost export competition', threatVector: 'High-yield mechanical harvesting depressing global CTC tea floor prices.', riskLevel: 'high', evidence: 'Mombasa auction prices trading at 30% discount to Colombo Orthodox teas.' },
      { company: 'Specialty Coffee & Matcha Boom', category: 'Alternative beverages', threatVector: 'Youth beverage wallet share shifting toward ceremonial matcha and specialty cold brew.', riskLevel: 'medium', evidence: 'Urban cafes dedicating 60% of beverage menus to non-black-tea formats.' },
    ],
    overallRisk: 'medium',
    timeToImpact: '12–24 months',
    defensiveActions: ['Double down on Ceylon’s unique high-elevation terroir marketing (Nuwara Eliya / Dimbula).', 'Develop Ceylon Matcha and white tea extracts.'],
    facts: ['Orthodox hand-plucked tea preserves intact polyphenols that CTC machine processing destroys.'],
    interpretation: ['Compete on craftsmanship and health terroir; never compete on commodity price per kilogram.'],
    sources: [src('https://fao.org/tea', 'UN FAO Intergovernmental Group on Tea Report')],
  };

  return [marketTrends, competitive, pricing, positioning, winLoss, adjacent];
}

/* =========================================================================
   5. APPAREL: MAS Holdings vs Brandix
   ========================================================================= */
function buildApparelOutputs(): AgentOutput[] {
  const marketTrends: MarketTrendsOutput = {
    ...baseFields('market-trends', 'market-trends'),
    artifactType: 'trend-chart',
    trends: [
      { keyword: 'FemTech & smart wearable textiles', direction: 'up', changePercent: 42, signal: 'MAS FemTech and wearable health tech division revenue up 42%.', source: 'masholdings.com' },
      { keyword: 'Net-zero carbon apparel factories', direction: 'up', changePercent: 30, signal: 'Brandix operates the world’s highest-rated LEED Platinum manufacturing plant.', source: 'brandix.com' },
      { keyword: 'Nearshoring to Central America / Africa', direction: 'up', changePercent: 22, signal: 'Both giants expanding offshore hubs in Kenya, Jordan and Honduras.', source: 'srilankabusiness.com' },
    ],
    categoryOutlook: 'accelerating',
    keySignals: [
      'MAS Holdings leads in intimate wear, performance sportswear, FemTech and technical R&D.',
      'Brandix leads in casual wear, denim mastery, supply chain verticality and green manufacturing.',
      'Speed-to-market and AI supply-chain forecasting are replacing simple labor-arbitrage contracting.',
    ],
    timeHorizon: '12–36 months',
    facts: [
      'MAS Holdings generates over $2.0 Billion in annual revenue with 100,000+ global workforce.',
      'Brandix generates over $1.2 Billion in annual revenue, anchor supplier for Gap, Marks & Spencer, and PVH.',
    ],
    interpretation: [
      'MAS is transitioning into a tech-led design partner; Brandix is the benchmark for sustainable lean manufacturing.',
    ],
    sources: [src('https://masholdings.com/news', 'MAS Innovation Roadmap'), src('https://brandix.com/sustainability', 'Brandix Net Zero Milestone')],
  };

  const competitive: CompetitiveOutput = {
    ...baseFields('competitive', 'competitive'),
    artifactType: 'competitive-matrix',
    competitor: 'Brandix Apparel',
    matrix: [
      { feature: 'Intimate apparel & technical sports bras (Nike/Lululemon)', yourProduct: 'strong', competitor: 'medium', gapDirection: 'advantage' },
      { feature: 'Denim & casual woven manufacturing speed', yourProduct: 'medium', competitor: 'strong', gapDirection: 'disadvantage' },
      { feature: 'Patent portfolio & FemTech R&D (Twinery)', yourProduct: 'strong', competitor: 'weak', gapDirection: 'advantage' },
      { feature: 'LEED Platinum green building leadership', yourProduct: 'strong', competitor: 'strong', gapDirection: 'parity' },
      { feature: 'Raw material backward integration (Teejay Lanka)', yourProduct: 'medium', competitor: 'strong', gapDirection: 'disadvantage' },
    ],
    competitorSummary: 'Brandix possesses deep mastery in automated green manufacturing, denim and synthetic fabric knitting through Teejay, while MAS dominates advanced bodywear engineering, high-value sportswear innovation and medical wearables.',
    hiringSignals: ['MAS Twinery biomedical engineers and material scientist headcount up 28%.'],
    recentMoves: [
      'MAS expanded Twinery patent applications for non-invasive health monitoring garments (2026).',
      'Brandix scaled its India Apparel City (BIAC) in Visakhapatnam to 22,000 workers (2026).',
    ],
    facts: ['MAS holds over 75 active international design and utility patents.'],
    interpretation: ['MAS has decoupled from pure contract manufacturing into high-margin co-creator status with global brands.'],
    sources: [src('https://twinery.com', 'Twinery Innovations Portfolio'), src('https://brandix.com/press', 'Brandix India Expansion')],
  };

  const pricing: PricingOutput = {
    ...baseFields('pricing', 'pricing'),
    artifactType: 'pricing-table',
    competitorPricing: [
      { tierName: 'Technical Performance Wear (MAS FOB)', price: '$18.00 - $34.00 / unit', features: ['Seamless bonded construction', 'Targeted compression zones'], targetSegment: 'Premium athletic brands (Nike, Lululemon)' },
      { tierName: 'Sustainable Denim / Casual (Brandix FOB)', price: '$12.00 - $22.00 / unit', features: ['Zero-water dye technology', '100% recycled organic cotton'], targetSegment: 'Global lifestyle retail (Gap, M&S, Uniqlo)' },
      { tierName: 'Smart FemTech / Wearable Device (MAS)', price: '$45.00 - $85.00 / unit', features: ['Integrated sensor arrays', 'FDA-cleared therapeutic heat'], targetSegment: 'MedTech & wellness DTC brands' },
    ],
    willingnessToPay: 'premium',
    pricingSignals: [
      'MAS captures 35-50% higher average unit FOB realization through patented bonding and fabric IP.',
      'Brandix offers unmatched multi-country tariff optimization across Sri Lanka, India, and Jordan.',
    ],
    recommendation: 'Deepen joint ventures with global health-tech startups to build recurring licensing royalties.',
    facts: ['Apparel brands are willing to pay an 18% premium for 3-week lead time agility vs standard 8-week cycles.'],
    interpretation: ['Speed and proprietary IP insulate manufacturers from low-wage competition in Bangladesh and Cambodia.'],
    sources: [src('https://srilankabusiness.com/apparel', 'EDB Sri Lanka Apparel Performance Report')],
  };

  const positioning: PositioningOutput = {
    ...baseFields('positioning', 'positioning'),
    artifactType: 'positioning-gap',
    competitor: 'Brandix Apparel',
    yourPositioning: 'MAS: Change is Courage — The tech-apparel pioneer shaping the future of wearable technology, bodywear, and social sustainability.',
    competitorPositioning: 'Brandix: Inspired Solutions — The world’s benchmark for inspired, ethical, and eco-intelligent apparel solutions.',
    adThemes: ['Wearable tech innovation & FemTech', 'Eco-intelligent sustainable manufacturing', 'Empowering female workforce'],
    gaps: [
      {
        dimension: 'Software-enabled smart garment integration',
        yourMessage: 'Hardware + textile integration in-house',
        competitorMessage: 'World-class apparel manufacturing partner',
        gap: 'Brands seek single-source partners who can deliver clinical-grade wearable sensors embedded in consumer-friendly apparel.',
        opportunity: 'Position MAS as the "Foxconn of Wearable Health Textiles".',
      },
    ],
    facts: ['MAS Women Go Beyond program has trained and empowered over 150,000 female associates.'],
    interpretation: ['ESG credentials are a mandatory qualifier for Nike and Patagonia supplier tier-1 status.'],
    sources: [src('https://masholdings.com/sustainability', 'MAS Plan for Change Annual Audit')],
  };

  const winLoss: WinLossOutput = {
    ...baseFields('win-loss', 'win-loss'),
    artifactType: 'win-loss-scorecard',
    competitor: 'Brandix Apparel',
    competitorWins: [
      { reason: 'Large-scale denim and woven program consolidation with duty-free advantages', frequency: 'often', evidence: 'Brandix captured major high-volume contracts from Gap and Levi’s.' },
      { reason: 'Speed of delivery from Indian Apparel City hub for European shipments', frequency: 'sometimes', evidence: 'Visakhapatnam port proximity cuts transit time by 4 days.' },
    ],
    competitorLosses: [
      { reason: 'Complex bonded athletic bras and seamless technical apparel execution', frequency: 'often', evidence: 'MAS produces over 40% of Victoria’s Secret and Nike premium technical bra lines.' },
      { reason: 'Lack of dedicated advanced prototyping labs like MAS Twinery', frequency: 'often', evidence: 'Lululemon and Gymshark co-develop flagship lines directly inside MAS labs.' },
    ],
    buyerSentiment: 'positive',
    topSwitchTriggers: ['R&D co-creation speed', 'Supply-chain carbon audit score', 'On-time delivery in full (OTIF)'],
    facts: ['MAS OTIF delivery rate exceeded 98.4% across all global operating clusters in 2026.'],
    interpretation: ['Tier-1 sportswear brands do not switch suppliers based on a 50-cent price difference; reliability and design IP dominate.'],
    sources: [src('https://just-style.com', 'Global Apparel Sourcing Excellence Benchmark 2026')],
  };

  const adjacent: AdjacentOutput = {
    ...baseFields('adjacent', 'adjacent', { confidence: 'high', confidenceScore: 0.88 }),
    artifactType: 'threat-heatmap',
    threats: [
      { company: 'Automated Robotic Sewing (Sewbots)', category: 'Industrial Automation', threatVector: 'Fully autonomous sewing cells in North America reducing nearshore labor differentials.', riskLevel: 'high', evidence: 'DARPA-backed automated sewing machines deployed in US textile mills.' },
      { company: 'EU Digital Product Passport (DPP)', category: 'Regulatory compliance', threatVector: 'Mandatory QR traceability of every fiber and dye batch from January 2027.', riskLevel: 'medium', evidence: 'European Green Deal textile regulation enacted.' },
    ],
    overallRisk: 'medium',
    timeToImpact: '18–36 months',
    defensiveActions: ['Deploy blockchain fiber-to-garment traceability across all MAS suppliers.', 'Invest in autonomous micro-factory hubs near consumer hubs.'],
    facts: ['MAS has already piloted Digital Product Passports across 100% of Patagonia-destined lines.'],
    interpretation: ['Regulatory compliance barriers favor scaled institutional leaders while squeezing small unorganized suppliers.'],
    sources: [src('https://ec.europa.eu/environment/strategy/textiles-strategy_en', 'EU Textile Strategy Guidelines')],
  };

  return [marketTrends, competitive, pricing, positioning, winLoss, adjacent];
}

/* =========================================================================
   Executive Summaries & Synthesis
   ========================================================================= */
const SYNTHESIZED_TELECOM = `**Dialog Axiata is winning — but the lead is now being decided in home broadband, not mobile.**

Dialog holds **46%** of the market to SLT-Mobitel's **35%**, and the gap is widening (+2 points since January while SLT-Mobitel is −2). Dialog is the only operator investing in *both* mobile and fixed broadband: a USD 45M 5G-and-fibre programme, a five-city 5G footprint, home-broadband connections up 38%, and — in August — fixed wireless that reaches homes SLT-Mobitel's fibre has not, without laying cable.

SLT-Mobitel is not losing everywhere. It still holds the **majority of the country's fixed broadband lines**, and it made the clearest defensive move of the year in April: raising fibre speeds while cutting the premium price to LKR 7,490. But it has no 5G answer and, so far, no answer to fixed wireless.

**Why Dialog is ahead:** convergence. It is the only operator with mobile, fibre, fixed wireless and a payment wallet in one place, and it is the only one spending to contest SLT-Mobitel's home-broadband stronghold.

**What would change this call:** if the November TRC disclosure rule forces Dialog's unlimited plan to advertise a low fair-use cap, or if SLT-Mobitel answers fixed wireless with its own. Watch Hutch too — it set the price floor in March and has gained two points of share without raising a price once.`;

const SYNTHESIZED_MOBILITY = `**PickMe holds a commanding lead across Sri Lanka's mobility market through tuk volume dominance and outstation lock-in.**

PickMe commands **58%** of total daily rides to Uber's **36%**, powered by a fleet of over 75,000 active three-wheelers and deep expansion into Kandy, Galle, and Kurunegala (+44% YoY trip growth). PickMe's lower driver commission (12-15% vs Uber's 20-25%) delivers higher driver net earnings, resulting in an average Colombo pickup time of **3.4 minutes** compared to **6.8 minutes** for Uber.

Uber maintains high profitability in its fortress: Colombo premium car commuters, business travelers, and tourists arriving at BIA. However, Uber has struggled to match PickMe's ground presence in secondary cities and corporate multi-service billing (Food + Flash + Business Commute).

**Why PickMe is ahead:** localized ecosystem integration. Seamless LankaQR payments, transparent driver payouts, and outstation supply density create a network effect that global app polish cannot overcome.

**Strategic next horizon:** the transition to EV three-wheelers. With fuel representing 48% of driver daily operating costs, the platform that deploys subsidized EV battery-swap fleets will establish an insurmountable unit-economics advantage.`;

const SYNTHESIZED_BANKING = `**Commercial Bank leads in institutional scale and deposit stability; Sampath Bank leads in consumer digital agility.**

Commercial Bank maintains Sri Lanka's largest private balance sheet with **LKR 2.4 Trillion+ in assets**, a sector-leading **41.8% CASA ratio**, and control of over 22% of total inward worker remittances. Its balance sheet depth and credit ratings give it pricing power on deposits (25-40 bps lower cost of funds) and syndicate leadership on major national infrastructure projects.

Sampath Bank is the innovation benchmark: **60% of new savings accounts opened via e-KYC**, higher app store customer ratings (4.6/5 for WePay vs 4.1/5 for ComBank Digital), and rapid SME digital loan approvals under 15 minutes.

**The Verdict:** Commercial Bank wins on enterprise profitability, remittance float, and flight-to-safety resilience. Sampath Bank wins on digital customer acquisition and millennial developer ecosystem integration. ComBank's new AI-driven COMBANK PLUS rollout directly challenges Sampath's UX lead.`;

const SYNTHESIZED_TEA = `**Dilmah wins on global brand equity and retail unit value; Akbar Brothers wins on export scale and automated supply chain.**

Dilmah commands a **$42/kg average retail realization** across 100+ countries, generating high gross margins through its 100% pure single-origin Ceylon positioning and luxury hospitality presence (serving 85% of luxury hotel rooms in Australasia). Its vertical integration into high-elevation carbon-neutral estates provides brand insulation from auction commodity price volatility.

Akbar Brothers is Sri Lanka's undisputed **export tonnage leader (45M+ kg, ~18% of national export volume)**, operating South Asia's most advanced automated tea blending and climate-controlled warehousing facilities.

**The Strategic Playbook:** Akbar is the master of high-volume global distribution and private-label retail contracts. Dilmah is the ethical luxury benchmark. Dilmah's next multi-million dollar growth vector lies in expanding ready-to-drink (RTD) single-estate sparkling teas and functional wellness adaptogens to capture millennial beverage spend.`;

const SYNTHESIZED_APPAREL = `**MAS Holdings leads as a global co-creation tech partner; Brandix leads in sustainable high-efficiency lean manufacturing.**

MAS Holdings (**$2.0B+ revenue, 75+ patents**) has successfully transformed from a traditional apparel contractor into a biomedical and performance design partner. Its Twinery innovation lab co-develops patented smart wearables, FemTech, and bonded sports bras directly with Nike, Lululemon, and Victoria's Secret, capturing 35-50% higher FOB price realization.

Brandix (**$1.2B+ revenue**) is the global benchmark for eco-intelligent manufacturing, operating the world's highest LEED Platinum certified plant and delivering massive volume agility through its 22,000-worker India Apparel City and vertically integrated Teejay knitting mills.

**The Bottom Line:** MAS wins on proprietary IP, biomedical wearable integration, and high-complexity bodywear engineering. Brandix wins on denim/casual consolidation and multi-country green supply chain speed.`;

/** Build the complete, filled comparison result for any matched industry. */
export function buildMockComparisonResult(query: string): OrchestratorOutput {
  const domain = detectMockDomain(query);
  let outputs = buildTelecomOutputs();
  let synthesizedAnswer = SYNTHESIZED_TELECOM;
  let product = 'Dialog Axiata';
  let competitor = 'SLT-Mobitel';
  let comparisonContract: ComparisonContract = buildTelecomContract();
  let decisionFrame: DecisionFrame = buildTelecomDecisionFrame();
  let topRecommendations: Recommendation[] = buildTelecomRecommendations();

  if (domain === 'mobility') {
    outputs = buildMobilityOutputs();
    synthesizedAnswer = SYNTHESIZED_MOBILITY;
    product = 'PickMe Sri Lanka';
    competitor = 'Uber Sri Lanka';
    comparisonContract = buildMobilityContract();
    decisionFrame = buildMobilityDecisionFrame();
    topRecommendations = buildMobilityRecommendations();
  } else if (domain === 'banking') {
    outputs = buildBankingOutputs();
    synthesizedAnswer = SYNTHESIZED_BANKING;
    product = 'Commercial Bank of Ceylon';
    competitor = 'Sampath Bank';
    comparisonContract = buildBankingContract();
    decisionFrame = buildBankingDecisionFrame();
    topRecommendations = buildBankingRecommendations();
  } else if (domain === 'tea') {
    outputs = buildTeaOutputs();
    synthesizedAnswer = SYNTHESIZED_TEA;
    product = 'Dilmah Ceylon Tea';
    competitor = 'Akbar Brothers';
    comparisonContract = buildTeaContract();
    decisionFrame = buildTeaDecisionFrame();
    topRecommendations = buildTeaRecommendations();
  } else if (domain === 'apparel') {
    outputs = buildApparelOutputs();
    synthesizedAnswer = SYNTHESIZED_APPAREL;
    product = 'MAS Holdings';
    competitor = 'Brandix Apparel';
    comparisonContract = buildApparelContract();
    decisionFrame = buildApparelDecisionFrame();
    topRecommendations = buildApparelRecommendations();
  }

  const agentRuns: AgentRun[] = MOCK_COMPARISON_AGENTS.map((a) => ({
    agentId: a.agentId,
    name: a.name,
    status: 'completed',
    startedAt: NOW(),
    completedAt: NOW(),
  }));

  return {
    query,
    product,
    competitor,
    researchIntent: 'compare',
    agentRuns,
    outputs,
    synthesizedAnswer,
    totalConfidence: 'high',
    generatedAt: NOW(),
    selectionMeta: { mode: 'full', savedVsFull: 0, researchIds: MOCK_COMPARISON_AGENTS.map((a) => a.agentId), tier: 2, tierLabel: 'Decision-grade' },
    comparisonContract,
    decisionFrame,
    topRecommendations,
    investigationPlan: {
      intent: 'compare',
      openQuestions: [
        `How does ${product} compare with ${competitor} across long-term unit economics?`,
        `What is the current customer retention rate and churn differential between both leaders?`,
        `How will upcoming regulatory and technology shifts reshape market share over the next 12 months?`,
      ],
      proposedNextProbes: [
        { id: 'p1', question: `What is the verifiable market share trend between ${product} and ${competitor}?`, domain: 'market-trends', sourceType: 'primary source', reason: 'Verify latest audited quarterly figures and filings.', status: 'recommended' },
        { id: 'p2', question: `Where are buyers switching and what are the main loss triggers?`, domain: 'win-loss', sourceType: 'customer references or review evidence', reason: 'Understand driver/consumer switching behavior.', status: 'recommended' },
        { id: 'p3', question: `How will new entrants or policy adjustments impact margin structures?`, domain: 'adjacent', sourceType: 'regulatory filing', reason: 'Stress-test unit economics against macroeconomic shifts.', status: 'recommended' },
      ],
      targetedFollowUpPlan: [
        'Pull latest statutory filings and industry quarterly briefs.',
        'Track consumer sentiment and switching signals on community channels.',
      ],
    },
    suggestedFollowUps: [
      `What defensive strategy should ${competitor} adopt against ${product}?`,
      `How can ${product} capture an additional 5% market share in the next two quarters?`,
      `Compare ${product} and ${competitor} on sustainability and ESG compliance.`,
      `What are the key margin risks facing both companies over the next 12 months?`,
    ],
    assumptions: [
      'Market share figures reflect latest verified quarterly filings.',
      'Both players continue active commercial operations under current regulatory policy.',
    ],
    unknowns: [
      'Exact timeline for competitor product updates in the next fiscal quarter.',
      'Potential macroeconomic interest rate or exchange rate volatility.',
    ],
    whatWouldChangeThis: [
      'A major disruptive pricing shift by a tertiary challenger.',
      'Sudden policy or tariff intervention by regulatory authorities.',
    ],
    confidenceDrivers: {
      supports: ['Multiple corroborating corporate earnings releases', 'Clear observable pricing schedules and fleet metrics', 'Consistent historical market trajectory'],
      weakens: ['Unlisted private entity operational data is estimated via industry sources'],
    },
    evidenceCoverage: [
      { id: 'market', label: 'Market', score: 0.92, sourceCount: 4, agentIds: ['market-trends'] },
      { id: 'competition', label: 'Competition', score: 0.88, sourceCount: 3, agentIds: ['competitive'] },
      { id: 'pricing', label: 'Pricing', score: 0.85, sourceCount: 3, agentIds: ['pricing'] },
      { id: 'customers', label: 'Customers', score: 0.78, sourceCount: 2, agentIds: ['win-loss'] },
      { id: 'technology', label: 'Technology & Risks', score: 0.82, sourceCount: 2, agentIds: ['adjacent'] },
    ],
    metrics: {
      totalLatencyMs: 9800,
      agentLatencies: { 'market-trends': 1200, competitive: 1400, pricing: 1100, positioning: 950, 'win-loss': 1300, adjacent: 900 },
      estimatedCostUsd: 0.0048,
      toolCallCount: 18,
      geminiCallCount: 8,
      agentCount: 6,
      completedAgentCount: 6,
      failedAgentCount: 0,
    },
  };
}

const cell = (entity: string, finding: string, confidence: 'supported' | 'weakly-supported' | 'unsupported', urls: string[]) =>
  ({ entity, finding, confidence, evidenceUrls: urls });

function buildTelecomContract(): ComparisonContract {
  return {
    entities: ['Dialog Axiata', 'SLT-Mobitel'],
    dimensions: [
      { id: 'positioning' as const, label: 'Positioning', cells: [cell('Dialog Axiata', 'Convergence & 5G speed — mobile, fibre, fixed wireless, wallet in one ecosystem.', 'supported', ['https://dialog.lk']), cell('SLT-Mobitel', 'Dependable national fibre backbone, now faster and cheaper.', 'supported', ['https://slt.lk'])] },
      { id: 'pricing' as const, label: 'Pricing', cells: [cell('Dialog Axiata', 'LKR 1,690 prepaid; premium unlimited postpaid at the top.', 'supported', ['https://dialog.lk/tariffs']), cell('SLT-Mobitel', 'Cut premium fibre to LKR 7,490 while raising speed.', 'supported', ['https://slt.lk/packages'])] },
      { id: 'market' as const, label: 'Market signals', cells: [cell('Dialog Axiata', '46% share (+2 pts); home broadband up 38%; USD 45M invested in 5G.', 'supported', ['https://dialog.lk/media']), cell('SLT-Mobitel', '35% share (−2 pts); owns majority of fibre lines.', 'supported', ['https://slt.lk/news'])] },
    ],
  };
}

function buildTelecomDecisionFrame(): DecisionFrame {
  return {
    situation: 'Dialog Axiata leads Sri Lankan telecom at 46% share and is entering SLT-Mobitel’s fixed broadband stronghold, while SLT defends fibre on speed and price but lacks 5G footprint.',
    options: [
      { label: 'Back Dialog for convergence growth', tradeoff: 'Highest upside if home broadband keeps compounding; monitor Nov 2026 fair-use rule.', evidenceStatus: 'supported' as const },
      { label: 'Back SLT-Mobitel for fibre stability', tradeoff: 'Owns majority of physical fibre lines, but losing mobile share.', evidenceStatus: 'supported' as const },
    ],
    criteria: ['Home-broadband growth', '5G footprint', 'Fair-use regulatory disclosure', 'Price discipline vs Hutch'],
    recommendation: 'Back Dialog for convergence-led growth, treating November fair-use disclosure as the key risk to monitor.',
    risks: ['Fair-use disclosure forces low advertised cap on unlimited plans.', 'SLT-Mobitel fields fixed wireless answer.'],
    falsifiers: ['SLT-Mobitel launches 5G or fixed wireless within 2 quarters.', 'Hutch price floor pulls prepaid share.'],
  };
}

function buildTelecomRecommendations(): Recommendation[] {
  return [
    {
      title: 'Win the home-broadband race with fixed wireless before satellite scales',
      rationale: 'Fixed wireless reaches districts SLT-Mobitel fibre has not reached without laying physical cable. Dialog’s 38% growth confirms strong demand.',
      evidence: ['Dialog home-broadband connections up 38%.', 'Fixed wireless launched Aug 2026.'],
      confidence: 'high' as const, priority: 'immediate' as const, evidenceStatus: 'supported' as const,
      sourceUrls: ['https://dialog.lk/whats-new', 'https://dialog.lk/media'],
      rank: 1, impact: 'high' as const, effort: 'medium' as const, timing: '30–90 days',
      ownerSuggestion: 'Chief Officer, Home Broadband',
      riskOfInaction: 'Satellite (LEO) entrants target the same underserved districts.',
      falsifier: 'SLT-Mobitel launches its own fixed wireless within two quarters.',
      pattern: 'market' as const,
    },
  ];
}

function buildMobilityContract() {
  return {
    entities: ['PickMe Sri Lanka', 'Uber Sri Lanka'],
    dimensions: [
      { id: 'market' as const, label: 'Fleet & Density', cells: [cell('PickMe', '75,000+ active tuks nationwide; 3.4 min average Colombo ETA.', 'supported', ['https://pickme.lk']), cell('Uber', 'Strong Colombo Premier/UberX cars; outstation tuk shortages.', 'supported', ['https://uber.com'])] },
      { id: 'pricing' as const, label: 'Pricing & Take-Rate', cells: [cell('PickMe', 'LKR 380 base fare; 12-15% driver commission.', 'supported', ['https://pickme.lk/pricing']), cell('Uber', 'LKR 390 base fare; 20-25% variable driver commission.', 'supported', ['https://uber.com/pricing'])] },
      { id: 'buyer_evidence' as const, label: 'Market Share & Sentiment', cells: [cell('PickMe', '58% share of daily rides; outstation trips +44% YoY.', 'supported', ['https://pickme.lk/media']), cell('Uber', '36% share of daily rides; commands tourist and airport corridors.', 'supported', ['https://uber.com/news'])] },
    ],
  };
}

function buildMobilityDecisionFrame() {
  return {
    situation: 'PickMe holds 58% ride volume through tuk density and outstation growth, while Uber defends high-margin Colombo premium car and airport corridors.',
    options: [
      { label: 'Back PickMe for mass ecosystem dominance', tradeoff: 'Highest ride frequency and network effects; exposed to fuel price swings.', evidenceStatus: 'supported' as const },
      { label: 'Back Uber for premium urban margins', tradeoff: 'High basket value from corporate and tourist riders, but limited regional scale.', evidenceStatus: 'supported' as const },
    ],
    criteria: ['Fleet supply availability', 'Driver net earnings retention', 'Outstation growth', 'EV transition roadmap'],
    recommendation: 'Back PickMe as the market leader; accelerate EV battery-swap fleet financing to build insurmountable cost advantage.',
    risks: ['Rapid electrification by a well-funded new entrant.', 'Macro fuel price volatility.'],
    falsifiers: ['Uber matches PickMe driver commissions in outstations.', 'PickMe driver cancellation rates rise above 15%.'],
  };
}

function buildMobilityRecommendations() {
  return [
    {
      title: 'Deploy subsidized EV battery-swap financing for top 10,000 drivers',
      rationale: 'Fuel represents 48% of driver operating expenses. Electric tuks slash running costs by 60%, creating permanent driver loyalty.',
      evidence: ['Fuel costs represent 48% of daily takings.', 'EV pilot projects show 60% operational savings.'],
      confidence: 'high' as const, priority: 'immediate' as const, evidenceStatus: 'supported' as const,
      sourceUrls: ['https://pickme.lk/media', 'https://ceb.lk/ev-pilot'],
      rank: 1, impact: 'high' as const, effort: 'high' as const, timing: '90–180 days',
      ownerSuggestion: 'Head of Fleet Partnerships',
      riskOfInaction: 'Third-party EV fleet operators capture driver supply.',
      falsifier: 'Government delays EV commercial three-wheeler homologation standards.',
      pattern: 'market' as const,
    },
  ];
}

function buildBankingContract() {
  return {
    entities: ['Commercial Bank', 'Sampath Bank'],
    dimensions: [
      { id: 'market' as const, label: 'Assets & Capital', cells: [cell('Commercial Bank', 'LKR 2.4T+ assets; 41.8% CASA ratio; 22% of national remittances.', 'supported', ['https://combank.lk']), cell('Sampath Bank', 'LKR 1.6T+ assets; high capital adequacy; agile balance sheet.', 'supported', ['https://sampath.lk'])] },
      { id: 'positioning' as const, label: 'Digital Onboarding & UX', cells: [cell('Commercial Bank', 'COMBANK PLUS revamp with predictive cash flow management.', 'supported', ['https://combank.lk/news']), cell('Sampath Bank', '60% digital KYC onboarding; WePay top-rated merchant QR app.', 'supported', ['https://sampath.lk/investors'])] },
      { id: 'pricing' as const, label: 'NIM & Cost of Funds', cells: [cell('Commercial Bank', '4.2% NIM; 25-40 bps lower deposit cost due to safety perception.', 'supported', ['https://combank.lk/financials']), cell('Sampath Bank', '3.9% NIM; competitive promotional digital FD rates.', 'supported', ['https://sampath.lk/rates'])] },
    ],
  };
}

function buildBankingDecisionFrame() {
  return {
    situation: 'Commercial Bank dominates institutional trade scale, remittance float, and low cost of funds, while Sampath Bank leads in digital consumer onboarding and developer APIs.',
    options: [
      { label: 'Back Commercial Bank for balance sheet scale', tradeoff: 'Unmatched remittance liquidity and institutional corporate lending.', evidenceStatus: 'supported' as const },
      { label: 'Back Sampath Bank for digital growth', tradeoff: 'Agile retail app experience and faster SME onboarding.', evidenceStatus: 'supported' as const },
    ],
    criteria: ['CASA ratio stability', 'Digital customer acquisition speed', 'NIM defense during rate cycles', 'App store CSAT'],
    recommendation: 'Back Commercial Bank for corporate resilience, while closing the UI/UX gap via COMBANK PLUS.',
    risks: ['Rapid rate cuts compressing interest margins.', 'Fintech wallets eating micro-merchant payment fees.'],
    falsifiers: ['Sampath captures 5% of remittance market share from ComBank.', 'ComBank digital app rating drops below 4.0.'],
  };
}

function buildBankingRecommendations() {
  return [
    {
      title: 'Embed zero-friction corporate payroll APIs to lock in CASA deposits',
      rationale: 'Commercial Bank’s 41.8% CASA ratio is its primary cost advantage. Integrating automated payroll directly with enterprise ERPs prevents salary account migration.',
      evidence: ['ComBank CASA ratio at 41.8%.', 'Over 22% of inward remittances processed.'],
      confidence: 'high' as const, priority: 'immediate' as const, evidenceStatus: 'supported' as const,
      sourceUrls: ['https://combank.lk/annual-report'],
      rank: 1, impact: 'high' as const, effort: 'medium' as const, timing: '60–90 days',
      ownerSuggestion: 'Head of Corporate Cash Management',
      riskOfInaction: 'Competitors offer higher FD rates and capture payroll floats.',
      falsifier: 'Corporate clients migrate payroll to fintech neo-banks.',
      pattern: 'pricing' as const,
    },
  ];
}

function buildTeaContract() {
  return {
    entities: ['Dilmah Ceylon Tea', 'Akbar Brothers'],
    dimensions: [
      { id: 'positioning' as const, label: 'Brand & Value Realization', cells: [cell('Dilmah', '$42/kg average retail realization; global single-origin identity.', 'supported', ['https://dilmahtea.com']), cell('Akbar Brothers', '$14/kg blended benchmark; world’s premier master blender.', 'supported', ['https://akbar.com'])] },
      { id: 'market' as const, label: 'Export Volume', cells: [cell('Dilmah', 'Exports to 100+ countries; leader in luxury hospitality tea.', 'supported', ['https://dilmahtea.com/news']), cell('Akbar Brothers', '45M+ kg annual export (~18% of Sri Lanka national total).', 'supported', ['https://akbar.com/press'])] },
      { id: 'risk' as const, label: 'Sustainability & Origin', cells: [cell('Dilmah', 'Carbon-neutral high elevation estates; 15% profits to MJF Foundation.', 'supported', ['https://mjffoundation.org']), cell('Akbar Brothers', 'Automated Kelaniya sorting; Rainforest Alliance certified.', 'supported', ['https://pureceylontea.com'])] },
    ],
  };
}

function buildTeaDecisionFrame() {
  return {
    situation: 'Dilmah commands premium brand equity and luxury hospitality pricing, while Akbar Brothers dominates national export volume and automated blending scale.',
    options: [
      { label: 'Back Dilmah for high-margin brand value', tradeoff: 'Highest gross margin per kg and ethical brand moat, but smaller total tonnage.', evidenceStatus: 'supported' as const },
      { label: 'Back Akbar Brothers for global volume dominance', tradeoff: 'Massive scale economics and private label supply contracts.', evidenceStatus: 'supported' as const },
    ],
    criteria: ['Retail price per kg realization', 'Global export tonnage', 'Hospitality luxury contracts', 'RTD beverage readiness'],
    recommendation: 'Back Dilmah’s value-added model; scale sparkling single-estate ready-to-drink teas to capture wellness consumers.',
    risks: ['Low-cost mechanized CTC competition from East Africa.', 'Generational shift toward specialty coffee/matcha.'],
    falsifiers: ['Auction leaf prices exceed $8/kg for continuous 3 quarters.', 'EU tariffs on packaged Ceylon tea increase.'],
  };
}

function buildTeaRecommendations() {
  return [
    {
      title: 'Launch sparkling single-estate cold-brew RTD tea in European grocery',
      rationale: 'Ready-to-drink tea is growing at 6.8% CAGR while traditional tea bags grow at 2.1%. Dilmah’s single-origin provenance commands premium beverage shelf space.',
      evidence: ['RTD tea category expanding at 6.8% CAGR.', 'Dilmah retail realization exceeds $42/kg.'],
      confidence: 'high' as const, priority: 'immediate' as const, evidenceStatus: 'supported' as const,
      sourceUrls: ['https://dilmahtea.com', 'https://tea-intelligence.com'],
      rank: 1, impact: 'high' as const, effort: 'high' as const, timing: '90–120 days',
      ownerSuggestion: 'Head of Global Brand Innovation',
      riskOfInaction: 'Specialty coffee and iced matcha brands take premium cafe shelf share.',
      falsifier: 'Consumer trial for sparkling unsweetened tea fails taste benchmarks.',
      pattern: 'positioning' as const,
    },
  ];
}

function buildApparelContract() {
  return {
    entities: ['MAS Holdings', 'Brandix Apparel'],
    dimensions: [
      { id: 'positioning' as const, label: 'R&D & High-Tech IP', cells: [cell('MAS Holdings', '75+ international patents; Twinery lab developing FemTech & smart wearables.', 'supported', ['https://masholdings.com']), cell('Brandix', 'World’s highest LEED Platinum green plants; Teejay knitting verticality.', 'supported', ['https://brandix.com'])] },
      { id: 'market' as const, label: 'Revenue & Global Footprint', cells: [cell('MAS Holdings', '$2.0B+ annual revenue; 100,000+ global workforce.', 'supported', ['https://srilankabusiness.com']), cell('Brandix', '$1.2B+ revenue; 22,000-worker India Apparel City hub.', 'supported', ['https://brandix.com/press'])] },
      { id: 'risk' as const, label: 'Core Product Domain & Trade Risks', cells: [cell('MAS Holdings', 'Intimate apparel, technical sports bras (Nike/Lululemon), medical bodywear.', 'supported', ['https://twinery.com']), cell('Brandix', 'Denim mastery, casual wovens, zero-water dye technology.', 'supported', ['https://brandix.com/sustainability'])] },
    ],
  };
}

function buildApparelDecisionFrame() {
  return {
    situation: 'MAS Holdings leads in high-tech bodywear IP and medical wearables, while Brandix leads in sustainable denim, vertical knit fabric scale, and multi-country speed.',
    options: [
      { label: 'Back MAS Holdings for design co-creation IP', tradeoff: 'Highest unit FOB realization and tech patents, insulating against low-wage contract sewers.', evidenceStatus: 'supported' as const },
      { label: 'Back Brandix for eco-intelligent lean manufacturing', tradeoff: 'Unmatched green factory credentials and India/Jordan multi-country tariff agility.', evidenceStatus: 'supported' as const },
    ],
    criteria: ['Patented product margin share', 'LEED green building compliance', 'On-time delivery in full (OTIF)', 'Nearshore factory footprint'],
    recommendation: 'Back MAS Holdings as the tech-apparel leader; accelerate medical FemTech commercialization.',
    risks: ['Robotic automated sewing reducing labor differentials in Western markets.', 'EU Digital Product Passport compliance hurdles.'],
    falsifiers: ['Nike or Lululemon cuts technical bodywear sourcing allocations from Sri Lanka.', 'Nearshore automated sewing costs reach parity with Asian hubs.'],
  };
}

function buildApparelRecommendations() {
  return [
    {
      title: 'Scale Digital Product Passport (DPP) traceability across 100% of EU shipments',
      rationale: 'Mandatory EU DPP traceability takes effect in 2027. Early end-to-end fiber compliance secures MAS’s tier-1 preferred vendor status with European luxury athletic brands.',
      evidence: ['EU Textile Strategy requires mandatory DPP by 2027.', 'MAS OTIF delivery rate exceeds 98.4%.'],
      confidence: 'high' as const, priority: 'immediate' as const, evidenceStatus: 'supported' as const,
      sourceUrls: ['https://masholdings.com/sustainability', 'https://ec.europa.eu'],
      rank: 1, impact: 'high' as const, effort: 'medium' as const, timing: '60–120 days',
      ownerSuggestion: 'Chief Sustainability & Technology Officer',
      riskOfInaction: 'Uncertified suppliers face EU import border delays and administrative fines.',
      falsifier: 'EU delays Digital Product Passport enforcement timeline.',
      pattern: 'market' as const,
    },
  ];
}
