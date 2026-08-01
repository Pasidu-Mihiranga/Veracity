-- MVP Market Projects: reusable research context shared by related sessions.

create table if not exists market_projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  product          text not null,
  product_url      text,
  competitors      text[] not null default '{}',
  geography        text,
  decision_context text,
  approved_sources text[] not null default '{}',
  blocked_sources  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id, name)
);

alter table chat_sessions
  add column if not exists project_id uuid references market_projects(id) on delete set null;

create index if not exists market_projects_user_id_idx
  on market_projects(user_id, updated_at desc);

create index if not exists chat_sessions_project_id_idx
  on chat_sessions(project_id, updated_at desc);

alter table market_projects enable row level security;

drop policy if exists "Users own their market projects" on market_projects;
create policy "Users own their market projects"
  on market_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
