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
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;
