-- Swarm Decision Lab persistence.
--
-- The existing MiroFish path runs a panel, streams a result, and forgets it.
-- That makes the lab a novelty: a user cannot ask the panel a follow-up, cannot
-- see which persona said what, and cannot compare a branch against its base.
--
-- These tables make a scenario a durable object with rounds and responses, so
-- the panel can be questioned again and the result can be audited.
--
-- The hard rule enforced by the separation: nothing in these tables is
-- evidence. Synthetic responses never join `evidence_spans`, are never cited as
-- sources, and consensus among personas raises no confidence about the real
-- world. They live apart from the ledger for exactly that reason.

-- ── Scenario sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS swarm_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,

  -- Links a scenario to the decision it stress-tests, so a recorded outcome can
  -- later be compared against what the panel expected. That comparison is the
  -- only route to ever calibrating this feature.
  decision_id uuid,

  -- The reviewed, versioned ScenarioBrief. Validated by the Zod schema in
  -- lib/intelligence/scenario-brief.ts before it is written.
  brief jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  parent_version integer,
  branch_reason text,

  -- Model and panel identity, so a result is reproducible and two runs under
  -- different models are never confused for each other.
  model_version text NOT NULL DEFAULT '',
  panel_version text NOT NULL DEFAULT '',
  evidence_hash text NOT NULL DEFAULT '',

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'complete', 'failed')),
  failure_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT swarm_scenarios_version_positive CHECK (version > 0),
  -- A branch must point at an earlier version, never itself or a later one.
  CONSTRAINT swarm_scenarios_parent_earlier
    CHECK (parent_version IS NULL OR parent_version < version)
);

CREATE INDEX IF NOT EXISTS swarm_scenarios_project_idx
  ON swarm_scenarios(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS swarm_scenarios_decision_idx
  ON swarm_scenarios(decision_id, version DESC);

-- ── Rounds ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS swarm_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES swarm_scenarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  -- 1 independent reaction, 2 challenge, 3 decision. A follow-up question to
  -- the panel is recorded as a further round rather than as a new scenario, so
  -- the thread stays intact.
  round integer NOT NULL CHECK (round >= 1),
  purpose text NOT NULL DEFAULT '',

  -- What was introduced this round: a challenge, a new piece of evidence, or a
  -- user follow-up. Null for round 1, which introduces nothing by design.
  intervention text,
  -- Scope of a follow-up: the whole panel, one segment, or one persona.
  scope text NOT NULL DEFAULT 'panel'
    CHECK (scope IN ('panel', 'segment', 'persona')),
  scope_target text,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness has to survive a NULL scope_target.
--
-- A plain UNIQUE (scenario_id, round, scope, scope_target) does not: SQL treats
-- every NULL as distinct, so a panel-scoped round (scope_target IS NULL) could
-- be inserted any number of times and the same round would be recorded twice.
-- COALESCE collapses the NULL to a real value so the constraint actually binds.
DROP INDEX IF EXISTS swarm_rounds_scope_idx;
ALTER TABLE swarm_rounds
  DROP CONSTRAINT IF EXISTS swarm_rounds_scenario_id_round_scope_scope_target_key;

CREATE UNIQUE INDEX IF NOT EXISTS swarm_rounds_scope_idx
  ON swarm_rounds(scenario_id, round, scope, COALESCE(scope_target, ''));

CREATE INDEX IF NOT EXISTS swarm_rounds_scenario_idx
  ON swarm_rounds(scenario_id, round);

-- ── Persona responses ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS swarm_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES swarm_rounds(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES swarm_scenarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  persona_id text NOT NULL,
  segment_id text NOT NULL,

  -- The persona's full answer, stored verbatim so the panel is inspectable
  -- rather than only summarised. A user must be able to read what was actually
  -- said instead of trusting a distribution chart.
  response text NOT NULL,

  -- Round 3 structured fields. Null in earlier rounds.
  chosen_alternative_id text,
  blocking_objection text,
  missing_information text,

  -- Set when a persona changed position, so round-to-round transitions can be
  -- charted rather than inferred.
  changed_from_alternative_id text,

  -- Per-persona failure. A partial panel is reported as partial; it never
  -- silently becomes a smaller panel that looks complete.
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failed')),
  failure_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT swarm_responses_body_present
    CHECK (status = 'failed' OR length(trim(response)) > 0)
);

CREATE INDEX IF NOT EXISTS swarm_responses_round_idx
  ON swarm_responses(round_id);
CREATE INDEX IF NOT EXISTS swarm_responses_scenario_idx
  ON swarm_responses(scenario_id, segment_id);
CREATE INDEX IF NOT EXISTS swarm_responses_persona_idx
  ON swarm_responses(scenario_id, persona_id, created_at);
