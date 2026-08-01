-- Phase 6: canonical entities, immutable monitoring snapshots, and refreshed board packs.

CREATE TABLE IF NOT EXISTS canonical_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  scope_key text NOT NULL,
  entity_key text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'competitor', 'product')),
  display_name text NOT NULL,
  official_domains text[] NOT NULL DEFAULT '{}',
  product_lines text[] NOT NULL DEFAULT '{}',
  props jsonb NOT NULL DEFAULT '{}',
  confidence real NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS canonical_entities_scope_idx
  ON canonical_entities(user_id, workspace_id, entity_type);

CREATE TABLE IF NOT EXISTS canonical_entity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workspace_id uuid,
  scope_key text NOT NULL,
  alias_key text NOT NULL,
  alias text NOT NULL,
  source text NOT NULL DEFAULT 'monitoring'
    CHECK (source IN ('monitoring', 'manual', 'resolver', 'official-domain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, alias_key)
);

CREATE INDEX IF NOT EXISTS canonical_entity_aliases_entity_idx
  ON canonical_entity_aliases(entity_id);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workspace_id uuid,
  scope_key text NOT NULL,
  job_id uuid,
  source_type text NOT NULL,
  source_url text NOT NULL,
  source_title text NOT NULL DEFAULT '',
  content_hash text NOT NULL,
  extracted jsonb NOT NULL DEFAULT '{}',
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, source_url, content_hash)
);

CREATE INDEX IF NOT EXISTS source_snapshots_entity_observed_idx
  ON source_snapshots(entity_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS competitor_profile_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workspace_id uuid,
  job_id uuid,
  profile_hash text NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}',
  diff jsonb NOT NULL DEFAULT '{}',
  material_event_count integer NOT NULL DEFAULT 0,
  source_snapshot_ids jsonb NOT NULL DEFAULT '[]',
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, profile_hash)
);

CREATE INDEX IF NOT EXISTS competitor_profile_snapshots_entity_idx
  ON competitor_profile_snapshots(entity_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS board_pack_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  scope_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  pack jsonb NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  decision_count integer NOT NULL DEFAULT 0,
  content_hash text NOT NULL,
  refresh_reason text NOT NULL DEFAULT 'scheduled',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, period_start, period_end, content_hash)
);

CREATE INDEX IF NOT EXISTS board_pack_snapshots_scope_idx
  ON board_pack_snapshots(user_id, workspace_id, generated_at DESC);

