-- Durable project research snapshots and honest source-coverage changes.

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
