/**
 * Adaptive Report Layout Templates Engine.
 *
 * Automatically tailors report layout structures, section ordering,
 * and primary visualizations based on detected query intent.
 */

export type ReportTemplateId =
  | 'comparison'
  | 'pricing'
  | 'strategy'
  | 'threat'
  | 'campaign'
  | 'persona'
  | 'executive_summary';

export interface ReportTemplateConfig {
  id: ReportTemplateId;
  name: string;
  badge: string;
  description: string;
  primaryVisuals: string[];
  recommendedSections: string[];
}

export const REPORT_TEMPLATES: Record<ReportTemplateId, ReportTemplateConfig> = {
  comparison: {
    id: 'comparison',
    name: 'Competitive Benchmark Matrix',
    badge: 'Comparison Template',
    description: 'Side-by-side feature matrix, pricing parity, and market positioning gaps.',
    primaryVisuals: ['competitive-matrix', 'positioning-gap'],
    recommendedSections: ['Executive Summary', 'Feature & Capability Matrix', 'Pricing Parity', 'Strategic Gaps', 'Action Plan'],
  },
  pricing: {
    id: 'pricing',
    name: 'Pricing & Monetization Breakdown',
    badge: 'Pricing Template',
    description: 'Tier-by-tier pricing, value metrics, ROI models, and discount risks.',
    primaryVisuals: ['pricing-table', 'forecast-chart'],
    recommendedSections: ['Pricing Overview', 'Tier Breakdown Table', 'Value Metric Comparison', 'Monetization Risks', 'Recommendations'],
  },
  strategy: {
    id: 'strategy',
    name: 'Growth & Strategy Canvas',
    badge: 'Strategy Template',
    description: 'Strategic roadmap, 2x2 Impact vs Effort prioritization, and core levers.',
    primaryVisuals: ['trend-chart', 'positioning-gap'],
    recommendedSections: ['Executive Brief', 'Market Drivers', '2x2 Opportunity Matrix', 'Execution Roadmap', 'Immediate Actions'],
  },
  threat: {
    id: 'threat',
    name: 'Competitive Threat & Risk Scorecard',
    badge: 'Threat & Risk Template',
    description: 'Risk assessment, competitor aggressive moves, churn vulnerability, and defense strategy.',
    primaryVisuals: ['threat-heatmap', 'win-loss-scorecard'],
    recommendedSections: ['Threat Level Overview', 'Competitor Risk Matrix', 'Vulnerability Factors', 'Defensive Counter-Moves'],
  },
  campaign: {
    id: 'campaign',
    name: 'Go-To-Market & Campaign Blueprint',
    badge: 'Campaign Template',
    description: 'Messaging pillars, cold email sequences, channel tactics, and objection handlers.',
    primaryVisuals: ['trend-chart'],
    recommendedSections: ['Campaign Objective', 'Core Messaging Pillars', 'Outreach Sequence', 'Objection Playbook'],
  },
  persona: {
    id: 'persona',
    name: 'Buyer Persona & ICP Intelligence',
    badge: 'Persona Template',
    description: 'Target decision-maker pains, buying triggers, evaluation criteria, and pitch angles.',
    primaryVisuals: ['win-loss-scorecard'],
    recommendedSections: ['ICP Profile', 'Pain Points & Triggers', 'Evaluation Criteria', 'Value Proposition Fit'],
  },
  executive_summary: {
    id: 'executive_summary',
    name: 'Executive Briefing',
    badge: 'Executive Briefing',
    description: 'Concise executive synthesis, key takeaways, and action items.',
    primaryVisuals: ['trend-chart', 'competitive-matrix'],
    recommendedSections: ['Executive Summary', 'Key Findings', 'Strategic Recommendations', 'Evidence & Sources'],
  },
};

/**
 * Selects the optimal report template based on query keywords and intent class.
 */
export function selectReportTemplate(query: string, intentClass?: string): ReportTemplateConfig {
  const q = (query || '').toLowerCase();
  const intent = (intentClass || '').toLowerCase();

  if (intent.includes('compare') || q.includes('vs') || q.includes('compare') || q.includes('comparison')) {
    return REPORT_TEMPLATES.comparison;
  }
  if (intent.includes('pricing') || q.includes('price') || q.includes('pricing') || q.includes('tier') || q.includes('cost')) {
    return REPORT_TEMPLATES.pricing;
  }
  if (intent.includes('threat') || q.includes('threat') || q.includes('risk') || q.includes('churn') || q.includes('defense')) {
    return REPORT_TEMPLATES.threat;
  }
  if (intent.includes('campaign') || q.includes('campaign') || q.includes('outreach') || q.includes('copy') || q.includes('email')) {
    return REPORT_TEMPLATES.campaign;
  }
  if (intent.includes('persona') || q.includes('persona') || q.includes('icp') || q.includes('buyer') || q.includes('decision maker')) {
    return REPORT_TEMPLATES.persona;
  }
  if (intent.includes('strategy') || q.includes('strategy') || q.includes('roadmap') || q.includes('build') || q.includes('market')) {
    return REPORT_TEMPLATES.strategy;
  }

  return REPORT_TEMPLATES.executive_summary;
}
