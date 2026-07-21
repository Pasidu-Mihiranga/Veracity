# ADR-0001: Governance and Engineering Standards

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Engineering Leadership Board
- **Tags:** architecture | security | devops | governance

## Context

Veracity AI is moving from a strong prototype toward production SaaS. Without written decision standards, security shortcuts (secret fallbacks, URL-embedded API keys), silent error swallowing, and ad-hoc architecture changes will accumulate faster than the team can repay the debt.

Phase 0 of the master plan requires a durable governance baseline before security hardening (Phase 1) and structural refactors (Phase 2).

## Decision

1. **Architecture Decision Records (ADRs)** are required for major design changes. New ADRs live in `docs/adr/` using `template.md`.
2. **Zero secret fallbacks:** No plaintext default credentials in source. Missing required secrets fail at boot via `lib/config.ts`.
3. **Fail-fast environment validation:** Application configuration is parsed through a centralized Zod schema on first access.
4. **Trunk-based development:** Unreleased behavior is gated by feature flags; main stays releasable.
5. **No merge without verification:** Lint, typecheck, and automated tests must pass before merge (enforced fully in Phase 1B CI).
6. **Definition of Done** for foundation work includes an updated checklist entry and a short change walkthrough when executing phased plan tasks.

## Consequences

### Positive

- Security and config mistakes surface at startup instead of mid-request.
- Future engineers can reconstruct *why* a pattern exists by reading ADRs.
- Phase 1+ work has a clear compliance baseline.

### Negative / Trade-offs

- Local and CI environments must provide a valid `.env` (or test fixtures) before the app boots.
- Small config changes require schema updates in `lib/config.ts` and `.env.example`.

## Alternatives Considered

1. **Document-only standards (no `lib/config.ts`)** — rejected; unenforced standards regress quickly.
2. **Per-module `process.env` reads with ad-hoc checks** — rejected; duplicates validation and allows secret fallbacks to creep back in.
3. **External config service (LaunchDarkly / AWS AppConfig) in Phase 0** — postponed; premature for current scale.

## References

- `doc/phase_by_phase_improvement_plan.md` — Phase 0, Engineering Principles & Governance; living completion tracker in §0
- `lib/config.ts` — centralized environment schema (TASK-0.2)
