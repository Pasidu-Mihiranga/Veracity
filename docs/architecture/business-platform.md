# Business Platform (System A)

System A owns product SaaS concerns. **It must never import LangGraph or LangChain.**

## Responsibilities

| Area | Primary modules | Notes |
|------|-----------------|-------|
| Authentication | `lib/auth-session.ts`, `lib/auth.ts`, middleware | JWT / Supabase paths |
| Workspace / tenancy | `lib/workspace.ts`, `lib/tenant.ts` | FF `workspaces` default off |
| RBAC | `lib/rbac.ts` | FF gated |
| Feature flags | `lib/feature-flags.ts` | Includes future `langgraphExecutor` |
| Chat gateway | `app/api/chat/route.ts` | SSE + Inngest dispatch |
| Rate limiting | `lib/rate-limit.ts` | Upstash optional |
| Memory storage | `lib/memory.ts`, embed/recall APIs | Injects preamble into System B |
| Decision memory | `lib/decisions.ts`, `lib/decision-policy.ts` | FF `decisionMemory` |
| Feedback / refine | `lib/feedback.ts`, `app/api/refine` | Closed loop |
| Knowledge graph | `lib/kg/*` | FF gated; fire-and-forget today |
| Export UI | Intelligence results + PDF/DOCX | Consumes final payload only |
| Alerts / watchlists | `lib/alerts.ts`, monitoring/* | Adjacent to chat |
| Observability | `lib/logger.ts`, Sentry, analytics | Correlation IDs on chat |
| SSO (future) | `lib/sso/*` | Enterprise path |

## Contract with System B

1. Platform builds `memoryContext` / learning preamble and calls `orchestrate(...)`.
2. Platform registers callbacks that encode SSE or job progress — executor-agnostic.
3. Platform persists messages, embeddings, decisions, exports — never inside agents.
4. Switching `CurrentExecutor` ↔ `LangGraphExecutor` must be invisible to System A beyond a feature flag.

## Non-goals for LangGraph

Auth, billing, workspace invites, RBAC, settings, notifications, and UI state machines are **not** workflow-graph concerns.
