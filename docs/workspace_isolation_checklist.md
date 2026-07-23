# Workspace isolation checklist (mandatory post–Phase 6)

Every feature that reads or writes tenant data **must** pass this gate before merge.

## Rules

1. **Tenant helper only** — Build tenancy predicates via [`lib/tenant.ts`](../lib/tenant.ts) (`withTenantScope` / `buildScopeForTest`). Do not add route-level `WHERE user_id = $1` as the isolation key when `NEXT_PUBLIC_FF_WORKSPACES=1`.
2. **Attribution ≠ tenancy** — `user_id` may record creator/actor; isolation key is `workspace_id` when workspaces are on.
3. **Permissions** — Mutations go through `assertPermission` / `requireWorkspaceAccess` ([`lib/rbac.ts`](../lib/rbac.ts), [`lib/workspace.ts`](../lib/workspace.ts)). No inline role comparisons in route handlers.
4. **Cross-workspace negative test** — Add or extend a test proving user A / workspace A cannot read workspace B rows.
5. **Flag-off** — With `NEXT_PUBLIC_FF_WORKSPACES=0`, behavior remains single-user (`user_id` scope via the same helper).

## Checklist (copy into PR)

- [ ] Queries use `withTenantScope`
- [ ] Mutations call `assertPermission` / `requireWorkspaceAccess`
- [ ] Cross-workspace negative test added or covered
- [ ] Flag-off path verified
- [ ] No new App Router pages (single-page product)

## Regression suite

See `__tests__/phase6-enterprise.test.ts` — tenant scope and RBAC matrix must stay green.
