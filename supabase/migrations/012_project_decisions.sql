-- Link durable decisions to the market project that owned the originating session.
alter table decision_memory
  add column if not exists project_id uuid references market_projects(id) on delete set null;

update decision_memory as decision
set project_id = session.project_id
from chat_sessions as session
where decision.session_id = session.id
  and decision.project_id is null
  and session.project_id is not null;

create index if not exists decision_memory_project_idx
  on decision_memory(project_id, created_at desc);
