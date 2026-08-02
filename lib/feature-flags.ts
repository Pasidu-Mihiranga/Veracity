/**
 * Feature flags.
 *
 * IMPORTANT — why every variable below is written out literally:
 * Next.js replaces `process.env.NEXT_PUBLIC_*` in browser bundles only when the
 * property is referenced *statically*. A dynamic lookup (`process.env[name]`)
 * is not inlined, so client code silently fell back to the hardcoded default
 * while the server read the deployed value. That disagreement is a correctness
 * bug — a surface could render as enabled in the browser while the server
 * treated it as off. See:
 * https://nextjs.org/docs/pages/guides/environment-variables
 *
 * Rule: never introduce a dynamic `process.env[...]` read in this file, and
 * never read a flag env var anywhere else. `__testResolveFlag` exists only so
 * the parsing rules can be unit-tested.
 */

/** Parse one raw env value. Unset/empty falls back to `defaultOn`. */
function parseFlag(raw: string | undefined, defaultOn: boolean): boolean {
  if (raw === undefined || raw === '') return defaultOn;
  const v = raw.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  return defaultOn;
}

/** Exposed for tests only — production code must use `featureFlags`. */
export const __testResolveFlag = parseFlag;

export const featureFlags = {
  /** Expandable claim↔URL Evidence Trail on recommendations */
  evidenceTrail: parseFlag(process.env.NEXT_PUBLIC_FF_EVIDENCE_TRAIL, true),
  /** Live Orchestrator View + Thinking Timeline */
  orchestratorView: parseFlag(process.env.NEXT_PUBLIC_FF_ORCHESTRATOR_VIEW, true),
  /** Full-screen Executive Board / Presentation Mode */
  boardMode: parseFlag(process.env.NEXT_PUBLIC_FF_BOARD_MODE, true),
  /** Async sweep — Inngest transport must also be configured */
  asyncSweep: parseFlag(process.env.NEXT_PUBLIC_FF_ASYNC_SWEEP, true),
  /** Durable audit logs for exports / sweeps */
  auditLogs: parseFlag(process.env.NEXT_PUBLIC_FF_AUDIT_LOGS, false),
  /** Strategic watchlists UI */
  watchlists: parseFlag(process.env.NEXT_PUBLIC_FF_WATCHLISTS, true),
  /** Weekly monitoring + in-app alerts */
  alerts: parseFlag(process.env.NEXT_PUBLIC_FF_ALERTS, true),
  /** Decision Memory store */
  decisionMemory: parseFlag(process.env.NEXT_PUBLIC_FF_DECISION_MEMORY, true),
  /** Competitive Timeline + Trend Summary */
  competitiveTimeline: parseFlag(process.env.NEXT_PUBLIC_FF_COMPETITIVE_TIMELINE, true),
  /** Cross-session feedback learning injection */
  feedbackLearning: parseFlag(process.env.NEXT_PUBLIC_FF_FEEDBACK_LEARNING, true),
  /** Canonical entities, profile snapshots, and timeline board refresh */
  continuousIntelligence: parseFlag(process.env.NEXT_PUBLIC_FF_CONTINUOUS_INTELLIGENCE, true),

  // ── Deferred until after the functional product ships ────────────────────
  // Enterprise identity, tenancy, and governance are sequenced after the MVP
  // and the research features (plans/GAP_CLOSURE_AND_FEATURE_PLAN.md §5.6).
  // These default OFF on both client and server and must stay that way until
  // the enterprise phase begins.

  /** Multi-tenant workspaces */
  workspaces: parseFlag(process.env.NEXT_PUBLIC_FF_WORKSPACES, false),
  /** RBAC enforcement UI + assertPermission */
  rbac: parseFlag(process.env.NEXT_PUBLIC_FF_RBAC, false),
  /**
   * SAML SSO ACS + config.
   * Deferred: the current implementation does not verify assertion signatures,
   * so it must not be enabled in the functional product. A standards-compliant
   * replacement is scheduled for the enterprise phase.
   */
  samlSso: parseFlag(process.env.NEXT_PUBLIC_FF_SAML_SSO, false),
  /** Organization Intelligence Monitor */
  orgIntelligence: parseFlag(process.env.NEXT_PUBLIC_FF_ORG_INTELLIGENCE, false),

  // ── Knowledge-graph surfaces — deferred (research §11.3) ─────────────────

  /** Evidence knowledge graph */
  evidenceGraph: parseFlag(process.env.NEXT_PUBLIC_FF_EVIDENCE_GRAPH, false),
  /** Competitor profiles + timeline */
  competitorProfiles: parseFlag(process.env.NEXT_PUBLIC_FF_COMPETITOR_PROFILES, false),
  /** Knowledge Graph Explorer UI */
  kgExplorer: parseFlag(process.env.NEXT_PUBLIC_FF_KG_EXPLORER, false),
  /** Cross-Agent Memory */
  crossAgentMemory: parseFlag(process.env.NEXT_PUBLIC_FF_CROSS_AGENT_MEMORY, false),
  /** Entity resolution / maintenance */
  kgMaintenance: parseFlag(process.env.NEXT_PUBLIC_FF_KG_MAINTENANCE, false),
  /** Graph analytics widgets */
  kgAnalytics: parseFlag(process.env.NEXT_PUBLIC_FF_KG_ANALYTICS, false),
  /**
   * LangGraph wave executor (ADR-0004 / ADR-0007 / ADR-0008).
   * Gated behind a benchmark; default OFF.
   */
  langgraphExecutor: parseFlag(process.env.NEXT_PUBLIC_FF_LANGGRAPH_EXECUTOR, false),
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;
