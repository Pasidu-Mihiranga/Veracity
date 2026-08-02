-- Scope canonical entity uniqueness to its owner.
--
-- The original constraint was UNIQUE (scope_key, entity_type, entity_key) with
-- no owner column. Two different users tracking the same competitor under the
-- same scope key collide: the second user's INSERT fails with a 23505, even
-- though the rows belong to different people and neither can see the other's.
--
-- It surfaced when a smoke run collided with a leftover row created by a
-- different test user. In production the same shape means one user's entity
-- keys can deny another user the ability to create theirs — a cross-tenant
-- failure that presents as an unexplained error during project setup.
--
-- Every other table in the schema scopes by user_id (market_projects,
-- evidence_spans, change_events, claims). This brings entities in line.
--
-- Written drop-then-create so re-running repairs a database that already has
-- the broken constraint, rather than silently leaving it in place — the same
-- pattern used for the NULL-uniqueness fix in 0010.

ALTER TABLE canonical_entities
  DROP CONSTRAINT IF EXISTS canonical_entities_scope_key_entity_type_entity_key_key;

DROP INDEX IF EXISTS canonical_entities_owner_scope_idx;

CREATE UNIQUE INDEX IF NOT EXISTS canonical_entities_owner_scope_idx
  ON canonical_entities(user_id, scope_key, entity_type, entity_key);

-- Lookups are always owner-scoped, so the index above already serves them.
-- This one supports listing a project's entities without scanning.
CREATE INDEX IF NOT EXISTS canonical_entities_user_scope_idx
  ON canonical_entities(user_id, scope_key);
