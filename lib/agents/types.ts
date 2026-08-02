// ─── Source citation ──────────────────────────────────────────────────────────
export interface AgentSource {
  url: string;
  title: string;
  timestamp: string;
  tool: 'serpapi' | 'firecrawl' | 'reddit' | 'hn' | 'apify' | 'synthesis' | 'mirofish' | 'mirofish-live';
}

// ─── Confidence ───────────────────────────────────────────────────────────────
export type ConfidenceLevel = 'high' | 'medium' | 'low';

function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}
export { scoreToLevel };

// ─── Agent lifecycle ──────────────────────────────────────────────────────────
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentRun {
  agentId: string;
  name: string;
  status: AgentStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ─── Base output every agent must return ──────────────────────────────────────
export interface AgentOutput {
  agentId: string;                  // e.g. "market-trends"
  domain: IntelligenceDomain;
  confidence: ConfidenceLevel;
  confidenceScore: number;          // 0–1
  facts: string[];                  // verifiable, source-backed claims
  interpretation: string[];         // analyst synthesis (clearly separated)
  sources: AgentSource[];
  generatedAt: string;
  artifactType: ArtifactType;
  /** Public truth class for the artifact. Never infer synthetic output as observed evidence. */
  dataClass?: 'observed' | 'derived' | 'synthetic';
  /**
   * When quality gate abstains (weak / ambiguous entity), Stage-1 cards are
   * category context — not claims about a confirmed product.
   */
  contextOnly?: boolean;
  /** Short UI badge, e.g. "Category context only" */
  contextOnlyLabel?: string;
  /** True when charts/matrices must not be used as decision-grade evidence. */
  decisionUseSuppressed?: boolean;
  /** Evidence gaps or unresolved questions discovered by this agent. */
  openQuestions?: string[];
}

// ─── Intelligence domains ─────────────────────────────────────────────────────
export type IntelligenceDomain =
  | 'market-trends'
  | 'competitive'
  | 'win-loss'
  | 'pricing'
  | 'positioning'
  | 'adjacent'
  | 'execution-engine'
  | 'mirofish'
  | 'mirofish-live';

export type ResearchIntentClass =
  | 'compare'
  | 'market'
  | 'dd_acquisition'
  | 'risk'
  | 'tech_assessment'
  | 'executive_strategy'
  | 'monitoring';

export type InvestigationProbe = {
  id: string;
  question: string;
  domain: IntelligenceDomain;
  sourceType: string;
  reason: string;
  status: 'completed' | 'recommended';
};

export type InvestigationPlan = {
  intent: ResearchIntentClass;
  openQuestions: string[];
  proposedNextProbes: InvestigationProbe[];
  targetedFollowUpPlan: string[];
};

export type DueDiligenceSectionId =
  | 'identity'
  | 'business_model'
  | 'financials_news'
  | 'people'
  | 'risk'
  | 'open_items';

export type DueDiligencePack = {
  target: string;
  sections: Array<{
    id: DueDiligenceSectionId;
    label: string;
    status: 'verified' | 'partial' | 'open';
    findings: string[];
    evidenceUrls: string[];
    openItems: string[];
  }>;
};

export type ComparisonContract = {
  entities: string[];
  dimensions: Array<{
    id: 'positioning' | 'pricing' | 'buyer_evidence' | 'market' | 'risk';
    label: string;
    cells: Array<{
      entity: string;
      finding: string;
      confidence: 'supported' | 'weakly-supported' | 'unsupported';
      evidenceUrls: string[];
    }>;
  }>;
};

export type AdaptiveReplan = {
  triggered: boolean;
  reasons: string[];
  addedDomains: IntelligenceDomain[];
  deepenDomains: IntelligenceDomain[];
  executedDeepenDomains?: IntelligenceDomain[];
};

// ─── Artifact types (drives which component renders) ─────────────────────────
export type ArtifactType =
  | 'trend-chart'
  | 'competitive-matrix'
  | 'win-loss-scorecard'
  | 'pricing-table'
  | 'positioning-gap'
  | 'threat-heatmap'
  | 'mind-map'
  | 'scorecard'
  | 'execution-plan'
  | 'scenario-distribution'
  | 'forecast-chart';

// ─── Domain-specific output shapes ───────────────────────────────────────────

export interface TrendDataPoint {
  keyword: string;
  direction: 'up' | 'down' | 'flat';
  changePercent: number;    // positive = growth
  signal: string;           // human-readable signal
  source: string;
}

export interface MarketTrendsOutput extends AgentOutput {
  artifactType: 'trend-chart';
  trends: TrendDataPoint[];
  /**
   * Undefined when synthesis failed. These are analyst *judgments*, so a
   * default value would assert an assessment the system never made — the UI
   * must render an explicit unavailable state instead of a plausible badge.
   */
  categoryOutlook?: 'accelerating' | 'consolidating' | 'maturing' | 'emerging';
  keySignals: string[];     // top 3 leading indicators
  timeHorizon?: string;     // e.g. "6-12 months"
}

export interface CompetitorFeature {
  feature: string;
  yourProduct: 'strong' | 'medium' | 'weak' | 'none';
  competitor: 'strong' | 'medium' | 'weak' | 'none';
  gapDirection: 'advantage' | 'parity' | 'disadvantage';
}

export interface CompetitiveOutput extends AgentOutput {
  artifactType: 'competitive-matrix';
  competitor: string;
  matrix: CompetitorFeature[];
  competitorSummary: string;
  hiringSignals: string[];  // job posting signals
  recentMoves: string[];    // funding, launches, pivots
}

export interface WinReason {
  reason: string;
  frequency: 'often' | 'sometimes' | 'rarely';
  evidence: string;         // quote or source snippet
}

export interface WinLossOutput extends AgentOutput {
  artifactType: 'win-loss-scorecard';
  competitor: string;
  competitorWins: WinReason[];
  competitorLosses: WinReason[];
  /** Undefined when synthesis failed — see MarketTrendsOutput.categoryOutlook. */
  buyerSentiment?: 'positive' | 'mixed' | 'negative';
  topSwitchTriggers: string[];  // reasons buyers switch
}

export interface PricingTier {
  tierName: string;
  price: string;
  features: string[];
  targetSegment: string;
}

export interface PricingOutput extends AgentOutput {
  artifactType: 'pricing-table';
  competitorPricing: PricingTier[];
  yourPricing?: PricingTier[];
  /** Undefined when synthesis failed — see MarketTrendsOutput.categoryOutlook. */
  willingnessToPay?: 'premium' | 'mid-market' | 'price-sensitive';
  pricingSignals: string[];   // what buyers say about pricing
  recommendation: string;
}

export interface MessagingGap {
  dimension: string;        // e.g. "Value framing"
  yourMessage: string;
  competitorMessage: string;
  gap: string;              // the insight
  opportunity: string;      // what to do about it
}

export interface PositioningOutput extends AgentOutput {
  artifactType: 'positioning-gap';
  competitor: string;
  gaps: MessagingGap[];
  yourPositioning: string;       // how you market yourself
  competitorPositioning: string; // how they market themselves
  adThemes: string[];            // observed ad messaging themes
}

export interface AdjacentThreat {
  company: string;
  category: string;
  threatVector: string;    // how they could enter your space
  riskLevel: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface AdjacentOutput extends AgentOutput {
  artifactType: 'threat-heatmap';
  threats: AdjacentThreat[];
  /** Undefined when synthesis failed — see MarketTrendsOutput.categoryOutlook. */
  overallRisk?: 'high' | 'medium' | 'low';
  timeToImpact?: string;   // e.g. "6-18 months"
  defensiveActions: string[];
}

// ─── Mind map output ─────────────────────────────────────────────────────────

export interface MindMapNode {
  id: string;
  label: string;
  detail?: string;                // short description shown on hover/expand
  sentiment?: 'positive' | 'neutral' | 'negative' | 'warning';
  confidence?: ConfidenceLevel;   // per-node confidence (from source agent)
  sourceAgent?: string;           // which intelligence domain produced this branch
  children?: MindMapNode[];
}

export interface MindMapOutput extends AgentOutput {
  artifactType: 'mind-map';
  centralTopic: string;           // root node label
  branches: MindMapNode[];        // top-level branches
  summary: string;                // one-line overview
}

// ─── Orchestrator output ──────────────────────────────────────────────────────
export interface RunMetrics {
  totalLatencyMs: number;          // wall-clock time from start to final response
  agentLatencies: Record<string, number>;  // per-agent latency in ms
  estimatedCostUsd: number;        // lightweight cost estimate
  toolCallCount: number;           // total tool invocations across all agents
  geminiCallCount: number;         // total model calls (classification + synthesis + agents)
  agentCount: number;              // total agents dispatched (research + execution)
  completedAgentCount: number;     // agents that finished with status "completed"
  failedAgentCount: number;        // agents that finished with status "failed"
}

/** Post-synthesis quality / anti-hallucination report (Phase 3B) */
export interface OutputQualityReport {
  /** 0–1 overall evidence quality after checks */
  evidenceScore: number;
  sourceMatchRatio: number;
  matchedSourceCount: number;
  totalSourceCount: number;
  flags: string[];
  /** When true, decision should stay cautious / abstain from bold pivots */
  shouldAbstainFromStrongClaims: boolean;
  /** Breakdown components for Evidence Strength Meter (0–1) */
  toolHealth: number;
  entityMatch: number;
  agentAvg: number;
  qualityGate: number;
}

/** Domain coverage axis for Evidence Coverage Radar */
export interface EvidenceCoverageAxis {
  id: 'market' | 'competition' | 'customers' | 'technology' | 'pricing';
  label: string;
  score: number; // 0–1
  sourceCount: number;
  agentIds: string[];
}

export interface OrchestratorOutput {
  query: string;
  product: string;
  competitor?: string;
  agentRuns: AgentRun[];
  outputs: AgentOutput[];
  synthesizedAnswer: string;       // prose summary for chat
  topRecommendations: Recommendation[];
  suggestedFollowUps: string[];
  totalConfidence: ConfidenceLevel;
  /** Enterprise research workflow selected for this query. */
  researchIntent?: ResearchIntentClass;
  /** Explicit investigation loop generated from unresolved evidence gaps. */
  investigationPlan?: InvestigationPlan;
  /** Present for acquisition diligence missions. */
  dueDiligencePack?: DueDiligencePack;
  /** Present for comparison missions; every entity uses the same dimensions. */
  comparisonContract?: ComparisonContract;
  /** Quality-adaptive second-pass decision and collectors. */
  adaptiveReplan?: AdaptiveReplan;
  /** Structured situation-to-decision contract for Tier >= 2 runs. */
  decisionFrame?: DecisionFrame;
  /** Board-ready sections derived from this run and prior decision context. */
  boardPack?: BoardPack;
  /** Mode-aware executive brief and decision appendix. */
  executiveContent?: ExecutiveContentContract;
  /** Explicit reasoning boundaries for decision-grade research runs. */
  assumptions?: string[];
  unknowns?: string[];
  evidenceLimitations?: string[];
  whatWouldChangeThis?: string[];
  alternativeHypotheses?: string[];
  confidenceDrivers?: {
    supports: string[];
    weakens: string[];
  };
  generatedAt: string;
  metrics?: RunMetrics;            // cost + latency — populated by orchestrator
  refinement?: RefinementInfo;     // present when generated by /api/refine loop
  /** Quality gate report — attached after Step 7 */
  quality?: OutputQualityReport;
  /** Per-domain evidence coverage for Coverage Radar */
  evidenceCoverage?: EvidenceCoverageAxis[];
  /** Mission plan / DAG from Mission Planner */
  missionPlan?: {
    steps: Array<{
      id: string;
      label: string;
      agentId: string;
      dependsOn?: string[];
      rationale?: string;
      stage?: 'scope' | 'collect' | 'cross-reference' | 'act';
    }>;
    intent?: ResearchIntentClass;
    objective?: string;
    deliverables?: string[];
  };
  /** Agents planned vs full sweep (adaptive selection) */
  selectionMeta?: {
    mode: 'full' | 'adaptive';
    savedVsFull: number;
    researchIds: string[];
    tier?: number;
    tierLabel?: string;
  };
}

export interface Recommendation {
  title: string;
  rationale: string;
  evidence: string[];
  confidence: ConfidenceLevel;
  priority: 'immediate' | 'short-term' | 'strategic';
  /** URLs bound to evidence claims (Evidence Trail) */
  sourceUrls?: string[];
  /** Aggregate support across evidence claims. */
  evidenceStatus?: EvidenceSupportLevel;
  /** Claim-level evidence trail; unsupported claims intentionally have no URLs. */
  evidenceBindings?: EvidenceClaimBinding[];
  /** Deterministic decision ranking (1 = highest priority). */
  rank?: number;
  impact?: 'high' | 'medium' | 'low';
  effort?: 'high' | 'medium' | 'low';
  timing?: string;
  ownerSuggestion?: string;
  dependencies?: string[];
  riskOfInaction?: string;
  falsifier?: string;
  /** Transparent 0-100 score used to rank this recommendation. */
  decisionScore?: number;
  /** Structural feedback-learning adjustment applied to the score. */
  learningAdjustment?: {
    delta: number;
    reason: string;
  };
  /** Stable coarse pattern used for cross-session accept/reject learning. */
  pattern?: RecommendationPattern;
}

export type RecommendationPattern =
  | 'pricing'
  | 'product'
  | 'positioning'
  | 'customer'
  | 'market'
  | 'risk'
  | 'research'
  | 'execution'
  | 'general';

export interface DecisionFrame {
  situation: string;
  options: Array<{
    label: string;
    tradeoff: string;
    evidenceStatus: EvidenceSupportLevel;
  }>;
  criteria: string[];
  recommendation: string;
  risks: string[];
  falsifiers: string[];
}

export interface BoardPack {
  title: string;
  executiveBrief: string;
  decision: DecisionFrame;
  sections: Array<{
    id: 'situation' | 'options' | 'criteria' | 'recommendation' | 'risks' | 'falsifiers' | 'evidence';
    title: string;
    bullets: string[];
  }>;
  timeline: Array<{
    date: string;
    label: string;
    detail: string;
    sourceUrl?: string;
  }>;
  decisionMemory: string[];
  generatedAt: string;
}

export interface ExecutiveContentContract {
  brief: string;
  /** Sentence-level claim bindings for the executive brief (AIQ-016). */
  briefBindings?: EvidenceClaimBinding[];
  rankedRecommendationTitles: string[];
  decisionAppendix: {
    assumptions: string[];
    unknowns: string[];
    evidenceLimitations: string[];
    whatWouldChangeThis: string[];
    alternativeHypotheses: string[];
    confidenceDrivers: {
      supports: string[];
      weakens: string[];
    };
  };
}

export type EvidenceSupportLevel = 'supported' | 'weakly-supported' | 'unsupported';

export interface EvidenceClaimBinding {
  claim: string;
  support: EvidenceSupportLevel;
  sourceUrls: string[];
  /** Best deterministic lexical/entity overlap score, 0–1. */
  matchScore: number;
  /**
   * How this binding was established.
   *
   * `span` means an excerpt from the cited page actually supports the claim.
   * `lexical` means only that the claim's words overlap the source's title and
   * URL — which is a hint that the source is topically related, not proof of
   * anything. The two must stay distinguishable, because presenting a lexical
   * match as evidence is precisely the "citations that don't prove the claim"
   * problem the evidence ledger exists to fix.
   */
  bindingMethod?: 'span' | 'lexical';
  /** Evidence spans backing the claim. Present only when `bindingMethod` is 'span'. */
  evidenceSpanIds?: string[];
}

export interface FeedbackAppliedCounts {
  recommendationFeedback: number;
  recommendationActions: number;
  variantResults: number;
}

export interface RefinementDelta {
  domain: IntelligenceDomain;
  summary: string;
  beforeConfidence?: ConfidenceLevel;
  afterConfidence?: ConfidenceLevel;
}

export interface RefinementInfo {
  refinedFromMessageId: string;
  focus?: string;
  feedbackApplied: FeedbackAppliedCounts;
  deltas: RefinementDelta[];
  feedbackSummary: string;
}

// ─── Legacy MiroFish forecast output (read compatibility only) ───────────────

export interface ForecastSignal {
  persona: string;        // e.g. "skeptical VP of Engineering"
  weight: number;         // -1 to +1 (positive = supports the forecast direction)
  excerpt?: string;       // short representative quote from the swarm response
}

export interface DistributionBucket {
  label: string;          // e.g. "strongly positive"
  count: number;          // number of simulated personas in this bucket
}

export interface ForecastOutput extends AgentOutput {
  artifactType: 'forecast-chart';
  question: string;                     // LLM-rewritten forecast question from user query
  pointEstimate: number;                // 0-1 probability
  unit: 'probability' | 'value' | 'percent';
  confidenceLow: number;                // lower bound of 90% CI
  confidenceHigh: number;               // upper bound of 90% CI
  direction: 'up' | 'down' | 'flat';   // headline direction of the predicted outcome
  swarmSize: number;                    // number of simulated personas polled
  timeHorizon: string;                  // e.g. "6 months", "Q3 2026"
  distribution: DistributionBucket[];   // sentiment distribution across the swarm
  contributingSignals: ForecastSignal[]; // top 3-5 personas + influence weight
  rationale: string;                    // 2-3 sentence plain-English forecast summary
}

export interface SwarmPersonaResponse {
  persona: string;
  response: string;
}

/** Synthetic stakeholder scenario. It is not survey evidence or a calibrated forecast. */
export interface SwarmScenarioOutput extends AgentOutput {
  artifactType: 'scenario-distribution';
  dataClass: 'synthetic';
  question: string;
  swarmSize: number;
  timeHorizon: string;
  distribution: DistributionBucket[];
  perspectives: ForecastSignal[];
  scenarioObservations: string[];
  personaResponses: SwarmPersonaResponse[];
  rationale: string;
  methodology: string;
  limitations: string[];
}

// ─── Image attachment ────────────────────────────────────────────────────────
export interface ImageAttachment {
  data: string;       // base64-encoded image data (no data: prefix)
  mimeType: string;   // e.g. "image/png", "image/jpeg"
}

// ─── Chat message ─────────────────────────────────────────────────────────────
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
  agentOutput?: OrchestratorOutput;
  /** Slim workflow state supplied by the client for cross-turn investigations. */
  investigationOpenQuestions?: string[];
  researchProduct?: string;
  researchCompetitor?: string;
  timestamp: string;
}

// ─── Agent config (what the orchestrator dispatches) ─────────────────────────
export interface AgentConfig {
  id: IntelligenceDomain;
  name: string;
  description: string;
  run: (context: AgentContext) => Promise<AgentOutput>;
}

export interface AgentContext {
  query: string;
  product: string;
  competitor?: string;
  productUrl?: string;
  competitorUrl?: string;
  entities?: string[];
  researchIntent?: ResearchIntentClass;
  priorContext?: string;    // serialised prior conversation findings
  images?: ImageAttachment[];  // optional visual context from user
  memoryContext?: string;      // persistent user memory across all sessions
  researchOutputs?: AgentOutput[];  // stage-1 research findings — populated for Execution Engine only
  /**
   * Excerpts already collected for this project, with ids the agent can cite.
   *
   * A citation the agent made is testimony about what it used; a similarity
   * score computed afterwards is only an inference about what it might have
   * used. Agents that receive this should append `[span-id]` to any fact taken
   * from an excerpt.
   */
  evidencePackBlock?: string;
  /** Shared intermediate facts across mission waves */
  scratchpad?: {
    productFacts: string[];
    competitorFacts: string[];
    openQuestions: string[];
  };
}

// ─── Execution Engine output shapes (Member 3) ───────────────────────────────

export interface CampaignVariant {
  id: string;                                    // e.g. "V1-ROI"
  angle: string;                                 // e.g. "ROI-focused"
  hypothesis: string;                            // falsifiable — tied to a research signal
  successMetric: string;                         // e.g. "reply rate > 4%"
  variable: string;                              // the single variable being tested
  channels: {
    email?: { subject: string; body: string; followUps?: string[] };
    linkedin?: { hook: string; post: string };
  };
  groundedSignals: string[];                     // pointers back to research agent findings
}

export interface CampaignBrief {
  objective: string;
  targetAudience: string;
  painPoints: string[];
  keyMessagingAngles: { angle: string; hypothesis: string }[];
  variantsSummary: string;
  channelStrategy: string;
  successMetrics: string[];
  nextSteps: string[];
}

export interface DeploymentStep {
  day: number;
  action: string;                                // e.g. "Send Variant A to Segment X"
  channel: 'email' | 'linkedin' | 'ads';
  audience: string;
}

export interface ExecutionPlanOutput extends AgentOutput {
  artifactType: 'execution-plan';
  variants: CampaignVariant[];
  brief: CampaignBrief;
  deployment: DeploymentStep[];
}
