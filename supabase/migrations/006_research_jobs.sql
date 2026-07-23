-- Phase 4: async research jobs (Inngest-backed)
create table if not exists research_jobs (
  id uuid primary key default gen_random_uuid(),
  execution_id text not null unique,
  user_id uuid not null,
  session_id uuid references chat_sessions(id) on delete cascade,
  status text not null default 'queued',
  -- queued | running | retrying | dead_letter | failed | completed | cancelled
  attempt int not null default 0,
  max_attempts int not null default 2,
  cancel_requested boolean not null default false,
  request jsonb not null default '{}',
  mission_summary jsonb,
  progress jsonb not null default '{}',
  orchestration_log jsonb not null default '[]',
  metrics jsonb not null default '{}',
  result jsonb,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_jobs_user_status_idx
  on research_jobs(user_id, status);

create index if not exists research_jobs_session_idx
  on research_jobs(session_id);
