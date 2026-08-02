CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Phase 6 continuous intelligence registry and immutable projections.
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
CREATE INDEX IF NOT EXISTS canonical_entities_scope_idx ON canonical_entities(user_id, workspace_id, entity_type);

CREATE TABLE IF NOT EXISTS canonical_entity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workspace_id uuid,
  scope_key text NOT NULL,
  alias_key text NOT NULL,
  alias text NOT NULL,
  source text NOT NULL DEFAULT 'monitoring',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, alias_key)
);
CREATE INDEX IF NOT EXISTS canonical_entity_aliases_entity_idx ON canonical_entity_aliases(entity_id);

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
CREATE INDEX IF NOT EXISTS source_snapshots_entity_observed_idx ON source_snapshots(entity_id, observed_at DESC);

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
CREATE INDEX IF NOT EXISTS competitor_profile_snapshots_entity_idx ON competitor_profile_snapshots(entity_id, observed_at DESC);

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
CREATE INDEX IF NOT EXISTS board_pack_snapshots_scope_idx ON board_pack_snapshots(user_id, workspace_id, generated_at DESC);
-- Local PostgreSQL schema for Veracity Growth Intelligence Assistant
-- Apply with: psql -U postgres -d veracity -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users (replaces Supabase auth.users) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text,
  google_id     text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Signal cache ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  text NOT NULL,
  tool       text NOT NULL,
  result     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cache_key, tool)
);

CREATE INDEX IF NOT EXISTS signal_cache_lookup
  ON signal_cache (cache_key, tool, created_at DESC);

-- ── Legacy conversations blob ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  messages   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Chat sessions / messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New Query',
  folder_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS folder_name text;

CREATE TABLE IF NOT EXISTS market_projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  product          text NOT NULL,
  product_url      text,
  competitors      text[] NOT NULL DEFAULT '{}',
  geography        text,
  decision_context text,
  approved_sources text[] NOT NULL DEFAULT '{}',
  blocked_sources  text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_project_id_idx ON chat_sessions(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS market_projects_user_id_idx ON market_projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_research_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES market_projects(id) ON DELETE CASCADE,
  session_id     uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_id     uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  product        text NOT NULL,
  competitor     text,
  summary        text NOT NULL DEFAULT '',
  source_urls    jsonb NOT NULL DEFAULT '[]',
  source_count   integer NOT NULL DEFAULT 0,
  evidence_score real,
  generated_at   timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);

CREATE TABLE IF NOT EXISTS project_research_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES market_projects(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES project_research_snapshots(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN ('coverage_changed')),
  title       text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}',
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_research_snapshots_project_idx
  ON project_research_snapshots(project_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS project_research_events_project_idx
  ON project_research_events(project_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);

-- ── User memory ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role        text,
  company     text,
  products    text[] NOT NULL DEFAULT '{}',
  competitors text[] NOT NULL DEFAULT '{}',
  interests   text[] NOT NULL DEFAULT '{}',
  facts       jsonb NOT NULL DEFAULT '[]',
  raw_summary text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Embeddings (pgvector) ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chat_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  embedding  vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_embeddings_session_id_idx ON chat_embeddings(session_id);
CREATE INDEX IF NOT EXISTS chat_embeddings_embedding_hnsw_idx
  ON chat_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ── Feedback loop ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id         uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  recommendation_key text NOT NULL,
  title              text NOT NULL,
  rating             text NOT NULL CHECK (rating IN ('up', 'down', 'neutral')),
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_actions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id         uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  recommendation_key text NOT NULL,
  title              text NOT NULL,
  action             text NOT NULL CHECK (action IN ('accepted', 'rejected', 'refined', 'copied')),
  metadata           jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variant_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id           uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id           uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  variant_id           text NOT NULL,
  variant_angle        text,
  hypothesis           text,
  success_metric       text,
  sent_count           integer,
  open_rate            numeric(5, 2),
  reply_rate           numeric(5, 2),
  click_rate           numeric(5, 2),
  meetings_booked      integer,
  hypothesis_confirmed text CHECK (hypothesis_confirmed IN ('yes', 'no', 'unclear')),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommendation_feedback_session_idx ON recommendation_feedback(session_id);
CREATE INDEX IF NOT EXISTS recommendation_actions_session_idx ON recommendation_actions(session_id);
CREATE INDEX IF NOT EXISTS variant_results_session_idx ON variant_results(session_id);

-- Phase 4: research jobs
CREATE TABLE IF NOT EXISTS research_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempt int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 2,
  cancel_requested boolean NOT NULL DEFAULT false,
  request jsonb NOT NULL DEFAULT '{}',
  mission_summary jsonb,
  progress jsonb NOT NULL DEFAULT '{}',
  orchestration_log jsonb NOT NULL DEFAULT '[]',
  metrics jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_jobs_user_status_idx ON research_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS research_jobs_session_idx ON research_jobs(session_id);

-- Phase 5: continuous platform
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON audit_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  product text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  last_sweep_at timestamptz,
  next_sweep_at timestamptz,
  health_status text NOT NULL DEFAULT 'paused'
    CHECK (health_status IN ('healthy', 'degraded', 'stale', 'paused')),
  cadence text NOT NULL DEFAULT 'weekly'
    CHECK (cadence IN ('daily', 'twice_weekly', 'weekly', 'monthly')),
  max_competitors integer NOT NULL DEFAULT 6
    CHECK (max_competitors BETWEEN 1 AND 12),
  weekly_alert_budget integer NOT NULL DEFAULT 12
    CHECK (weekly_alert_budget BETWEEN 1 AND 50),
  alert_channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  last_sweep_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watchlists_user_idx ON watchlists(user_id);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  competitor text NOT NULL,
  competitor_url text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watchlist_items_watchlist_idx ON watchlist_items(watchlist_id);

CREATE TABLE IF NOT EXISTS alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  watchlist_id uuid REFERENCES watchlists(id) ON DELETE SET NULL,
  job_id uuid,
  product text NOT NULL DEFAULT '',
  competitor text NOT NULL DEFAULT '',
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('high', 'medium', 'low')),
  diff jsonb NOT NULL DEFAULT '{}',
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS alert_events_user_created_idx ON alert_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS competitive_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product text NOT NULL DEFAULT '',
  competitor text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'pricing', 'launch', 'feature', 'hiring', 'leadership', 'security',
      'docs', 'sentiment', 'funding', 'acquisition', 'news', 'other'
    )),
  source_urls jsonb NOT NULL DEFAULT '[]',
  job_id uuid,
  confidence text NOT NULL DEFAULT 'medium',
  cluster_key text NOT NULL,
  severity text NOT NULL DEFAULT 'low'
    CHECK (severity IN ('high', 'medium', 'low')),
  materiality_score real NOT NULL DEFAULT 0
    CHECK (materiality_score BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS competitive_events_user_comp_idx ON competitive_events(user_id, competitor, event_date DESC);
CREATE INDEX IF NOT EXISTS competitive_events_cluster_idx ON competitive_events(user_id, cluster_key);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'slack')),
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, channel)
);
CREATE INDEX IF NOT EXISTS alert_deliveries_user_created_idx
  ON alert_deliveries(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS decision_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  decision text NOT NULL
    CHECK (decision IN ('accepted', 'rejected', 'refined', 'deferred')),
  reason text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'validated', 'invalidated', 'adopted_after_reject')),
  confidence real NOT NULL DEFAULT 0.65
    CHECK (confidence >= 0 AND confidence <= 1),
  outcome_note text,
  source_recommendation_key text,
  evidence_urls jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decision_memory_user_idx ON decision_memory(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decision_memory_key_idx ON decision_memory(user_id, source_recommendation_key);
CREATE INDEX IF NOT EXISTS decision_memory_project_idx ON decision_memory(project_id, created_at DESC);

-- Phase 6: Enterprise tenancy
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  logo_url text,
  timezone text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspaces_created_by_idx ON workspaces(created_by);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON workspace_members(workspace_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member', 'viewer')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_invites_workspace_idx ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invites_token_idx ON workspace_invites(token);

CREATE TABLE IF NOT EXISTS workspace_sso_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  idp_entity_id text,
  idp_sso_url text,
  idp_x509_cert text,
  sp_entity_id text,
  acs_path text NOT NULL DEFAULT '/api/auth/saml/acs',
  allowed_email_domains text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE recommendation_actions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE variant_results ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE research_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE competitive_events ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
ALTER TABLE decision_memory ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS chat_sessions_workspace_idx ON chat_sessions(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS research_jobs_workspace_idx ON research_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS audit_logs_workspace_idx ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS watchlists_workspace_idx ON watchlists(workspace_id);
CREATE INDEX IF NOT EXISTS alert_events_workspace_idx ON alert_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS competitive_events_workspace_idx ON competitive_events(workspace_id, event_date DESC);
CREATE INDEX IF NOT EXISTS decision_memory_workspace_idx ON decision_memory(workspace_id, created_at DESC);

-- Phase 7: Knowledge Platform
CREATE TABLE IF NOT EXISTS kg_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('claim', 'source', 'competitor', 'product', 'decision', 'event', 'agent_fact')),
  label text NOT NULL,
  key text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}',
  confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  archived_at timestamptz,
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kg_nodes_ws_kind_key_active_idx
  ON kg_nodes (workspace_id, kind, key) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS kg_nodes_workspace_kind_idx ON kg_nodes (workspace_id, kind);

CREATE TABLE IF NOT EXISTS kg_node_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  version int NOT NULL,
  label text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}',
  confidence_snapshot real NOT NULL DEFAULT 0.5,
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, version)
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  from_node_id uuid NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  rel text NOT NULL
    CHECK (rel IN (
      'supports', 'about', 'derived_from', 'mentions', 'decides', 'timed_as',
      'acquired', 'owns', 'competes_with', 'replaces', 'depends_on', 'launched',
      'targets', 'uses', 'invested_in', 'partner_of', 'same_as'
    )),
  weight real NOT NULL DEFAULT 1.0,
  trust real NOT NULL DEFAULT 0.7 CHECK (trust >= 0 AND trust <= 1),
  props jsonb NOT NULL DEFAULT '{}',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kg_edges_active_uniq
  ON kg_edges (workspace_id, from_node_id, to_node_id, rel) WHERE valid_until IS NULL;
CREATE INDEX IF NOT EXISTS kg_edges_from_idx ON kg_edges (workspace_id, from_node_id);
CREATE INDEX IF NOT EXISTS kg_edges_to_idx ON kg_edges (workspace_id, to_node_id);

CREATE TABLE IF NOT EXISTS kg_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  alias_key text NOT NULL,
  canonical_node_id uuid NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'ingest'
    CHECK (source IN ('ingest', 'manual', 'resolver')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, alias_key)
);

CREATE TABLE IF NOT EXISTS kg_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  aggregate_type text NOT NULL
    CHECK (aggregate_type IN ('competitor', 'product', 'claim', 'decision', 'other')),
  aggregate_key text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kg_domain_events_agg_idx
  ON kg_domain_events (workspace_id, aggregate_type, aggregate_key, occurred_at DESC);

CREATE TABLE IF NOT EXISTS competitor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  competitor_key text NOT NULL,
  display_name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  website_url text,
  trend_headline text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  props jsonb NOT NULL DEFAULT '{}',
  projected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, competitor_key)
);

CREATE TABLE IF NOT EXISTS agent_memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  session_id text,
  scope text NOT NULL
    CHECK (scope IN ('product', 'competitor', 'domain', 'global')),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  source_agent text,
  confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  expires_at timestamptz,
  created_by uuid,
  job_id text,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, scope, key)
);
CREATE INDEX IF NOT EXISTS agent_memory_expires_idx ON agent_memory_entries (workspace_id, expires_at);
