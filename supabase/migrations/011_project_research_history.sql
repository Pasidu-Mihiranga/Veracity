create table if not exists project_research_snapshots (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references market_projects(id) on delete cascade,
  session_id     uuid references chat_sessions(id) on delete set null,
  message_id     uuid references chat_messages(id) on delete set null,
  product        text not null,
  competitor     text,
  summary        text not null default '',
  source_urls    jsonb not null default '[]',
  source_count   integer not null default 0,
  evidence_score real,
  generated_at   timestamptz not null,
  created_at     timestamptz not null default now(),
  unique(message_id)
);

create table if not exists project_research_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references market_projects(id) on delete cascade,
  snapshot_id uuid references project_research_snapshots(id) on delete cascade,
  event_type  text not null check (event_type in ('coverage_changed')),
  title       text not null,
  details     jsonb not null default '{}',
  observed_at timestamptz not null default now()
);

create index if not exists project_research_snapshots_project_idx
  on project_research_snapshots(project_id, generated_at desc);
create index if not exists project_research_events_project_idx
  on project_research_events(project_id, observed_at desc);

alter table project_research_snapshots enable row level security;
alter table project_research_events enable row level security;

drop policy if exists "Users read project research snapshots" on project_research_snapshots;
create policy "Users read project research snapshots" on project_research_snapshots for select
  using (project_id in (select id from market_projects where user_id = auth.uid()));

drop policy if exists "Users read project research events" on project_research_events;
create policy "Users read project research events" on project_research_events for select
  using (project_id in (select id from market_projects where user_id = auth.uid()));
