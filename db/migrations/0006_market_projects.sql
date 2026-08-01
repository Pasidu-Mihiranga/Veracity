-- MVP Market Projects: reusable research context shared by related sessions.

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

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS market_projects_user_id_idx
  ON market_projects(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_sessions_project_id_idx
  ON chat_sessions(project_id, updated_at DESC);
