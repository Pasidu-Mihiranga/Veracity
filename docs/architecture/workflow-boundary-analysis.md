# Workflow Boundary Analysis

## System A — Business Platform

Authentication, workspace, feature flags, RBAC, memory persistence, decision memory storage, settings, export UI, billing (future), notifications/alerts, rate limiting, audit/SSO, SSE/job transport encoding.

**Rule:** No `@langchain/*` / LangGraph imports in System A.

## System B — AI Workflow

Intent routing, tier selection, mission planning, agent selection, wave execution, domain agents, execution engine, quality gate, evidence binding, synthesis/mind map, report **data** construction.

## Placement table

| Concern | System | Move? |
|---------|--------|-------|
| Intent / tier / selection / mission definition | B custom | No |
| Wave runner | B via `WorkflowExecutor` | Optional Hybrid only |
| Agents + tools | B custom | No |
| Quality / evidence / grounding / signal penalty | B custom libraries | **Never** into framework |
| Synthesis prompts | B prompt assets | Extract, do not framework-ize |
| Streaming transport | A | No |
| Memory storage | A | No (inject string into B) |
| Export render | A | No |

## Measurable value test

Move a concern only if it improves maintainability, clarity, reliability, or extensibility **without** reducing accuracy/evidence quality — measured by success metrics and benchmarks.
