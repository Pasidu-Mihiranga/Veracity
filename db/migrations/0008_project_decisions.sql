-- Link durable decisions to the market project that owned the originating session.
ALTER TABLE decision_memory
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES market_projects(id) ON DELETE SET NULL;

UPDATE decision_memory AS decision
SET project_id = session.project_id
FROM chat_sessions AS session
WHERE decision.session_id = session.id
  AND decision.project_id IS NULL
  AND session.project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS decision_memory_project_idx
  ON decision_memory(project_id, created_at DESC);
