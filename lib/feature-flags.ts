/**
 * Competition / Phase 3B feature flags (NEXT_PUBLIC_* so client + server agree).
 * Default ON when unset so demo surfaces ship; set to "0" | "false" | "off" to disable.
 */

function envFlag(name: string, defaultOn = true): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultOn;
  const v = raw.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  return defaultOn;
}

export const featureFlags = {
  /** Expandable claim↔URL Evidence Trail on recommendations */
  evidenceTrail: envFlag('NEXT_PUBLIC_FF_EVIDENCE_TRAIL'),
  /** Live Orchestrator View + Thinking Timeline */
  orchestratorView: envFlag('NEXT_PUBLIC_FF_ORCHESTRATOR_VIEW'),
  /** Full-screen Executive Board / Presentation Mode */
  boardMode: envFlag('NEXT_PUBLIC_FF_BOARD_MODE'),
  /** Phase 4 — async sweep surfaces */
  asyncSweep: envFlag('NEXT_PUBLIC_FF_ASYNC_SWEEP', false),
  /** Phase 5 — durable audit logs for exports / sweeps */
  auditLogs: envFlag('NEXT_PUBLIC_FF_AUDIT_LOGS', false),
  /** Phase 5 — strategic watchlists UI */
  watchlists: envFlag('NEXT_PUBLIC_FF_WATCHLISTS', false),
  /** Phase 5 — weekly monitoring + in-app alerts */
  alerts: envFlag('NEXT_PUBLIC_FF_ALERTS', false),
  /** Phase 5 — Decision Memory store */
  decisionMemory: envFlag('NEXT_PUBLIC_FF_DECISION_MEMORY', false),
  /** Phase 5 — Competitive Timeline + Trend Summary */
  competitiveTimeline: envFlag('NEXT_PUBLIC_FF_COMPETITIVE_TIMELINE', false),
  /** Phase 5 — cross-session feedback learning injection */
  feedbackLearning: envFlag('NEXT_PUBLIC_FF_FEEDBACK_LEARNING', false),
  /** Phase 6 — multi-tenant workspaces */
  workspaces: envFlag('NEXT_PUBLIC_FF_WORKSPACES', false),
  /** Phase 6 — RBAC enforcement UI + assertPermission */
  rbac: envFlag('NEXT_PUBLIC_FF_RBAC', false),
  /** Phase 6 — SAML SSO ACS + config */
  samlSso: envFlag('NEXT_PUBLIC_FF_SAML_SSO', false),
  /** Phase 6 — Organization Intelligence Monitor */
  orgIntelligence: envFlag('NEXT_PUBLIC_FF_ORG_INTELLIGENCE', false),
  /** Phase 7 — Evidence knowledge graph */
  evidenceGraph: envFlag('NEXT_PUBLIC_FF_EVIDENCE_GRAPH', false),
  /** Phase 7 — competitor profiles + timeline */
  competitorProfiles: envFlag('NEXT_PUBLIC_FF_COMPETITOR_PROFILES', false),
  /** Phase 7 — Knowledge Graph Explorer UI */
  kgExplorer: envFlag('NEXT_PUBLIC_FF_KG_EXPLORER', false),
  /** Phase 7 — Cross-Agent Memory */
  crossAgentMemory: envFlag('NEXT_PUBLIC_FF_CROSS_AGENT_MEMORY', false),
  /** Phase 7 — entity resolution / maintenance */
  kgMaintenance: envFlag('NEXT_PUBLIC_FF_KG_MAINTENANCE', false),
  /** Phase 7 — graph analytics widgets */
  kgAnalytics: envFlag('NEXT_PUBLIC_FF_KG_ANALYTICS', false),
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;
