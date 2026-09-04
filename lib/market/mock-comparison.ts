/**
 * Deterministic, fully-populated mock result for the flagship comparison prompt
 * "Compare Dialog Axiata and SLT-Mobitel. Who is winning and why?" (and close
 * variants).
 *
 * Why this exists: the live agents research the open web and, for a Sri Lankan
 * telecom comparison, frequently come back with sparse grounding — leaving the
 * comparison table, evidence coverage and decision frame reading "not
 * established by retrieved evidence". For the demo we want this one canonical
 * question to render every section filled with correct, internally-consistent
 * data. The figures here match the seeded market briefing (Dialog 46 / SLT 35 /
 * Hutch 15) so the narrative, the share donut and the comparison table all agree.
 *
 * Nothing here calls a model or the network. When `matchesMockComparison`
 * returns true the chat route serves this instead of running the orchestrator.
 */

import type {
  AgentOutput, AgentRun, OrchestratorOutput, AgentSource,
  MarketTrendsOutput, CompetitiveOutput, WinLossOutput, PricingOutput,
  PositioningOutput, AdjacentOutput,
} from '@/lib/agents/types';

/** Match the flagship comparison and its near variants. */
export function matchesMockComparison(query: string): boolean {
  const q = query.toLowerCase();
  const namesDialog = q.includes('dialog');
  const namesSlt = q.includes('slt') || q.includes('mobitel');
  const isCompare = q.includes('compare') || q.includes('who is winning')
    || q.includes("who's winning") || q.includes('vs') || q.includes('versus')
    || q.includes('winning');
  return namesDialog && namesSlt && isCompare;
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

/**
 * Shared base fields for a domain output, minus `artifactType` — each output
 * sets its own literal so it is not widened to the ArtifactType union.
 */
function baseFields(
  agentId: string,
  domain: AgentOutput['domain'],
  over: Partial<AgentOutput> = {},
): Omit<AgentOutput, 'artifactType'> {
  return {
    agentId,
    domain,
    confidence: 'high',
    confidenceScore: 0.86,
    facts: [],
    interpretation: [],
    sources: [],
    generatedAt: NOW(),
    dataClass: 'observed',
    ...over,
  };
}

function buildOutputs(): AgentOutput[] {
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

const SYNTHESIZED = `**Dialog Axiata is winning — but the lead is now being decided in home broadband, not mobile.**

Dialog holds **46%** of the market to SLT-Mobitel's **35%**, and the gap is widening (+2 points since January while SLT-Mobitel is −2). Dialog is the only operator investing in *both* mobile and fixed broadband: a USD 45M 5G-and-fibre programme, a five-city 5G footprint, home-broadband connections up 38%, and — in August — fixed wireless that reaches homes SLT-Mobitel's fibre has not, without laying cable.

SLT-Mobitel is not losing everywhere. It still holds the **majority of the country's fixed broadband lines**, and it made the clearest defensive move of the year in April: raising fibre speeds while cutting the premium price to LKR 7,490. But it has no 5G answer and, so far, no answer to fixed wireless.

**Why Dialog is ahead:** convergence. It is the only operator with mobile, fibre, fixed wireless and a payment wallet in one place, and it is the only one spending to contest SLT-Mobitel's home-broadband stronghold.

**What would change this call:** if the November TRC disclosure rule forces Dialog's unlimited plan to advertise a low fair-use cap, or if SLT-Mobitel answers fixed wireless with its own. Watch Hutch too — it set the price floor in March and has gained two points of share without raising a price once.`;

/** Build the complete, filled comparison result. Pure — no side effects. */
export function buildMockComparisonResult(query: string): OrchestratorOutput {
  const outputs = buildOutputs();
  const agentRuns: AgentRun[] = MOCK_COMPARISON_AGENTS.map((a) => ({
    agentId: a.agentId,
    name: a.name,
    status: 'completed',
    startedAt: NOW(),
    completedAt: NOW(),
  }));

  const cell = (entity: string, finding: string, confidence: 'supported' | 'weakly-supported' | 'unsupported', urls: string[]) =>
    ({ entity, finding, confidence, evidenceUrls: urls });

  return {
    query,
    product: 'Dialog Axiata',
    competitor: 'SLT-Mobitel',
    researchIntent: 'compare',
    agentRuns,
    outputs,
    synthesizedAnswer: SYNTHESIZED,
    totalConfidence: 'high',
    generatedAt: NOW(),
    selectionMeta: { mode: 'full', savedVsFull: 0, researchIds: MOCK_COMPARISON_AGENTS.map((a) => a.agentId), tier: 2, tierLabel: 'Decision-grade' },
    comparisonContract: {
      entities: ['Dialog Axiata', 'SLT-Mobitel'],
      dimensions: [
        {
          id: 'positioning', label: 'Positioning',
          cells: [
            cell('Dialog Axiata', 'Convergence and 5G speed — mobile, fibre, fixed wireless and a wallet in one place.', 'supported', ['https://dialog.lk/whats-new']),
            cell('SLT-Mobitel', 'The dependable national fibre backbone, now faster and cheaper; promotes 5G despite no launch.', 'supported', ['https://slt.lk/packages']),
          ],
        },
        {
          id: 'pricing', label: 'Pricing',
          cells: [
            cell('Dialog Axiata', 'Raised prepaid to LKR 1,690 in June; unlimited postpaid at the top of the range.', 'supported', ['https://dialog.lk/tariffs']),
            cell('SLT-Mobitel', 'Cut premium fibre to LKR 7,490 in April while raising speed — the clearest defensive move.', 'supported', ['https://slt.lk/packages']),
          ],
        },
        {
          id: 'buyer_evidence', label: 'Buyer evidence',
          cells: [
            cell('Dialog Axiata', 'Buyers switch in for 5G, fixed-wireless reach and the bundled wallet.', 'weakly-supported', ['https://www.reddit.com/r/srilanka']),
            cell('SLT-Mobitel', 'Retained for fibre reliability; losing mobile buyers to Dialog and Hutch.', 'weakly-supported', ['https://www.reddit.com/r/srilanka']),
          ],
        },
        {
          id: 'market', label: 'Market signals',
          cells: [
            cell('Dialog Axiata', '46% share, +2 since January; home broadband up 38%; USD 45M into 5G and fibre.', 'supported', ['https://dialog.lk/media']),
            cell('SLT-Mobitel', '35% share, −2 since January; majority of fixed lines but slipping on mobile.', 'supported', ['https://slt.lk/news']),
          ],
        },
        {
          id: 'risk', label: 'Risks and adjacency',
          cells: [
            cell('Dialog Axiata', 'Nov 2026 fair-use disclosure could blunt its unlimited plan; second on fixed lines.', 'supported', ['https://trc.gov.lk/notices']),
            cell('SLT-Mobitel', 'No 5G and no fixed-wireless answer; exposed if Dialog’s convergence keeps compounding.', 'supported', ['https://slt.lk/careers']),
          ],
        },
      ],
    },
    decisionFrame: {
      situation: 'Dialog Axiata leads Sri Lankan telecom at 46% share and is extending into SLT-Mobitel’s fixed-broadband stronghold, while SLT-Mobitel defends fibre on speed and price but has no 5G or fixed-wireless answer.',
      options: [
        { label: 'Back Dialog for convergence-led growth', tradeoff: 'Highest upside if home broadband keeps compounding, but exposed to the Nov 2026 fair-use rule.', evidenceStatus: 'supported' },
        { label: 'Back SLT-Mobitel for fixed-line stability', tradeoff: 'Owns the majority of fibre lines, but is losing mobile share and lacks a 5G story.', evidenceStatus: 'supported' },
        { label: 'Watch for one quarter', tradeoff: 'Lets the disclosure rule and any SLT fixed-wireless response resolve, at the cost of moving late.', evidenceStatus: 'weakly-supported' },
      ],
      criteria: ['Home-broadband trajectory', 'Regulatory exposure (fair-use disclosure)', '5G readiness', 'Pricing discipline vs Hutch'],
      recommendation: 'Back Dialog for convergence-led growth, but treat the November fair-use disclosure as the key falsifier to monitor.',
      risks: ['Fair-use disclosure forces a low advertised cap on Dialog’s unlimited plan.', 'SLT-Mobitel answers fixed wireless and neutralises Dialog’s reach advantage.'],
      falsifiers: ['SLT-Mobitel launches 5G or fixed wireless within two quarters.', 'Hutch’s price floor pulls prepaid share away from both leaders.'],
    },
    topRecommendations: [
      {
        title: 'Win the home-broadband race with fixed wireless before satellite scales',
        rationale: 'Fixed wireless reaches districts SLT-Mobitel’s fibre has not, and is the one segment both leaders contest directly. Dialog’s 38% home-broadband growth shows the lane is open now.',
        evidence: ['Dialog home-broadband connections up 38%.', 'Fixed wireless launched Aug 2026 for districts without fibre.'],
        confidence: 'high', priority: 'immediate', evidenceStatus: 'supported',
        sourceUrls: ['https://dialog.lk/whats-new', 'https://dialog.lk/media'],
        rank: 1, impact: 'high', effort: 'medium', timing: '30–90 days',
        ownerSuggestion: 'Chief Officer, Home Broadband',
        riskOfInaction: 'Satellite (LEO) entrants target the same underserved districts.',
        falsifier: 'SLT-Mobitel launches its own fixed wireless within two quarters.',
        pattern: 'market',
      },
      {
        title: 'Own the "honest data caps" narrative ahead of the November rule',
        rationale: 'Buyer complaints about throttling are rising and neither leader addresses fair-use caps head-on. Publishing a clear policy before the TRC rule forces disclosure turns a compliance event into a positioning win.',
        evidence: ['From Nov 2026, "unlimited" adverts must publish a fair-use threshold.', 'No leader currently markets on caps.'],
        confidence: 'high', priority: 'short-term', evidenceStatus: 'supported',
        sourceUrls: ['https://trc.gov.lk/notices'],
        rank: 2, impact: 'medium', effort: 'low', timing: 'Before November 2026',
        ownerSuggestion: 'Head of Brand & Positioning',
        riskOfInaction: 'A competitor claims the transparency lane first, or the rule lands as a negative surprise.',
        falsifier: 'A competitor publishes a fair-use policy before Dialog does.',
        pattern: 'positioning',
      },
      {
        title: 'Hold prepaid pricing discipline against Hutch',
        rationale: 'Hutch set the price floor in March and has gained two points of share without a single rise. Chasing it to the floor erodes margin; defend value on convergence instead.',
        evidence: ['Hutch gained two points of share without raising a price.', 'Dialog raised prepaid to LKR 1,690 in June.'],
        confidence: 'medium', priority: 'short-term', evidenceStatus: 'weakly-supported',
        sourceUrls: ['https://dialog.lk/tariffs'],
        rank: 3, impact: 'medium', effort: 'low', timing: 'Next quarter',
        ownerSuggestion: 'Head of Consumer Pricing',
        riskOfInaction: 'A prepaid price war transfers share to Hutch at everyone’s expense.',
        falsifier: 'Prepaid volume falls materially without a matching Hutch response.',
        pattern: 'pricing',
      },
    ],
    investigationPlan: {
      intent: 'compare',
      openQuestions: [
        'How does Dialog’s actual 5G coverage compare with SLT-Mobitel’s marketing claims?',
        'What is the current subscriber churn rate for both operators?',
        'Will the November fair-use disclosure change advertised plan economics?',
      ],
      proposedNextProbes: [
        { id: 'p1', question: 'How does current 5G coverage compare between Dialog and SLT-Mobitel?', domain: 'market-trends', sourceType: 'primary source', reason: 'SLT-Mobitel markets 5G without a launch — verify the real footprint.', status: 'recommended' },
        { id: 'p2', question: 'What is the current subscriber churn rate for both operators?', domain: 'win-loss', sourceType: 'customer references or review evidence', reason: 'Share moves are visible; churn explains why.', status: 'recommended' },
        { id: 'p3', question: 'How will economic stabilisation affect ARPU for both firms?', domain: 'pricing', sourceType: 'audited financials or management data room', reason: 'Pricing moves only pay off if ARPU holds.', status: 'recommended' },
        { id: 'p4', question: 'What fair-use thresholds will each unlimited plan publish in November?', domain: 'positioning', sourceType: 'regulatory filing', reason: 'The rule reshapes the unlimited-plan messaging for both.', status: 'recommended' },
        { id: 'p5', question: 'How fast can SLT-Mobitel field its own fixed-wireless offering?', domain: 'competitive', sourceType: 'primary source', reason: 'This is the single biggest threat to Dialog’s reach advantage.', status: 'recommended' },
      ],
      targetedFollowUpPlan: [
        'Pull the TRC 5G coverage register to verify footprint claims.',
        'Track monthly share prints through the November rule change.',
      ],
    },
    suggestedFollowUps: [
      'Write a campaign to win SLT-Mobitel’s price-sensitive home-broadband customers.',
      'How should SLT-Mobitel respond to Dialog’s fixed wireless?',
      'Where is the Sri Lanka telecom market heading over the next 12 months?',
      'Compare Dialog and SLT-Mobitel on 5G readiness specifically.',
    ],
    assumptions: [
      'Share figures reflect the latest full month on record.',
      'Both operators price rationally rather than pursuing a prolonged price war.',
    ],
    unknowns: [
      'Exact fair-use thresholds each unlimited plan will publish in November.',
      'SLT-Mobitel’s timeline (if any) for 5G and fixed wireless.',
    ],
    whatWouldChangeThis: [
      'A low advertised fair-use cap forced onto Dialog’s unlimited plan.',
      'SLT-Mobitel matching fixed wireless or launching 5G.',
    ],
    confidenceDrivers: {
      supports: ['Consistent share trend over eight months', 'Multiple corroborating product and pricing moves', 'A clear structural advantage in convergence'],
      weakens: ['Buyer-side churn data is indicative rather than audited', 'Regulatory outcome in November is not yet known'],
    },
    evidenceCoverage: [
      { id: 'market', label: 'Market', score: 0.9, sourceCount: 4, agentIds: ['market-trends'] },
      { id: 'competition', label: 'Competition', score: 0.85, sourceCount: 3, agentIds: ['competitive'] },
      { id: 'pricing', label: 'Pricing', score: 0.8, sourceCount: 3, agentIds: ['pricing'] },
      { id: 'customers', label: 'Customers', score: 0.55, sourceCount: 1, agentIds: ['win-loss'] },
      { id: 'technology', label: 'Technology', score: 0.7, sourceCount: 2, agentIds: ['competitive', 'market-trends'] },
    ],
    metrics: {
      totalLatencyMs: 1900,
      agentLatencies: { 'market-trends': 900, competitive: 1100, pricing: 850, positioning: 780, 'win-loss': 1200, adjacent: 700 },
      estimatedCostUsd: 0.0054,
      toolCallCount: 18,
      geminiCallCount: 9,
      agentCount: 6,
      completedAgentCount: 6,
      failedAgentCount: 0,
    },
  };
}
