-- Continuous platform tables that older local DBs may be missing.
-- Safe to re-run (IF NOT EXISTS).

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
CREATE INDEX IF NOT EXISTS alert_events_user_unread_idx ON alert_events(user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS competitive_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product text NOT NULL DEFAULT '',
  competitor text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('pricing', 'launch', 'feature', 'hiring', 'docs', 'sentiment', 'funding', 'other')),
  source_urls jsonb NOT NULL DEFAULT '[]',
  job_id uuid,
  confidence text NOT NULL DEFAULT 'medium',
  cluster_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS competitive_events_user_comp_idx ON competitive_events(user_id, competitor, event_date DESC);
CREATE INDEX IF NOT EXISTS competitive_events_cluster_idx ON competitive_events(user_id, cluster_key);

CREATE TABLE IF NOT EXISTS decision_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
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
ALTER TABLE research_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid;

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
