-- Phase 7: Knowledge Platform — versioned temporal graph, aliases, domain events, profiles, agent memory

create table if not exists kg_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  kind text not null
    check (kind in ('claim', 'source', 'competitor', 'product', 'decision', 'event', 'agent_fact')),
  label text not null,
  key text not null,
  props jsonb not null default '{}',
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  archived_at timestamptz,
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kg_nodes_ws_kind_key_active_idx
  on kg_nodes (workspace_id, kind, key)
  where archived_at is null;

create index if not exists kg_nodes_workspace_kind_idx on kg_nodes (workspace_id, kind);
create index if not exists kg_nodes_valid_idx on kg_nodes (workspace_id, valid_from, valid_until);

create table if not exists kg_node_versions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references kg_nodes(id) on delete cascade,
  workspace_id uuid not null,
  version int not null,
  label text not null,
  props jsonb not null default '{}',
  confidence_snapshot real not null default 0.5,
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  created_at timestamptz not null default now(),
  unique (node_id, version)
);

create index if not exists kg_node_versions_node_idx on kg_node_versions (node_id, version desc);

create table if not exists kg_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  from_node_id uuid not null references kg_nodes(id) on delete cascade,
  to_node_id uuid not null references kg_nodes(id) on delete cascade,
  rel text not null
    check (rel in (
      'supports', 'about', 'derived_from', 'mentions', 'decides', 'timed_as',
      'acquired', 'owns', 'competes_with', 'replaces', 'depends_on', 'launched',
      'targets', 'uses', 'invested_in', 'partner_of', 'same_as'
    )),
  weight real not null default 1.0,
  trust real not null default 0.7 check (trust >= 0 and trust <= 1),
  props jsonb not null default '{}',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  created_at timestamptz not null default now()
);

create unique index if not exists kg_edges_active_uniq
  on kg_edges (workspace_id, from_node_id, to_node_id, rel)
  where valid_until is null;

create index if not exists kg_edges_from_idx on kg_edges (workspace_id, from_node_id);
create index if not exists kg_edges_to_idx on kg_edges (workspace_id, to_node_id);
create index if not exists kg_edges_rel_idx on kg_edges (workspace_id, rel);

create table if not exists kg_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  alias_key text not null,
  canonical_node_id uuid not null references kg_nodes(id) on delete cascade,
  source text not null default 'ingest'
    check (source in ('ingest', 'manual', 'resolver')),
  created_at timestamptz not null default now(),
  unique (workspace_id, alias_key)
);

create index if not exists kg_aliases_canonical_idx on kg_aliases (canonical_node_id);

create table if not exists kg_domain_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  aggregate_type text not null
    check (aggregate_type in ('competitor', 'product', 'claim', 'decision', 'other')),
  aggregate_key text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_by uuid,
  source_agent text,
  job_id text,
  session_id text,
  model_version text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists kg_domain_events_agg_idx
  on kg_domain_events (workspace_id, aggregate_type, aggregate_key, occurred_at desc);

create table if not exists competitor_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  competitor_key text not null,
  display_name text not null,
  summary text not null default '',
  website_url text,
  trend_headline text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  props jsonb not null default '{}',
  projected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, competitor_key)
);

create index if not exists competitor_profiles_ws_idx on competitor_profiles (workspace_id);

create table if not exists agent_memory_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id text,
  scope text not null
    check (scope in ('product', 'competitor', 'domain', 'global')),
  key text not null,
  value jsonb not null default '{}',
  source_agent text,
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  expires_at timestamptz,
  created_by uuid,
  job_id text,
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, scope, key)
);

create index if not exists agent_memory_expires_idx on agent_memory_entries (workspace_id, expires_at);
create index if not exists agent_memory_session_idx on agent_memory_entries (workspace_id, session_id);

-- RLS (Supabase path)
alter table kg_nodes enable row level security;
alter table kg_node_versions enable row level security;
alter table kg_edges enable row level security;
alter table kg_aliases enable row level security;
alter table kg_domain_events enable row level security;
alter table competitor_profiles enable row level security;
alter table agent_memory_entries enable row level security;

drop policy if exists "Members access kg_nodes" on kg_nodes;
create policy "Members access kg_nodes" on kg_nodes for all
  using (exists (select 1 from workspace_members m where m.workspace_id = kg_nodes.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = kg_nodes.workspace_id and m.user_id = auth.uid()));

drop policy if exists "Members access kg_node_versions" on kg_node_versions;
create policy "Members access kg_node_versions" on kg_node_versions for all
  using (exists (select 1 from workspace_members m where m.workspace_id = kg_node_versions.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = kg_node_versions.workspace_id and m.user_id = auth.uid()));

drop policy if exists "Members access kg_edges" on kg_edges;
create policy "Members access kg_edges" on kg_edges for all
  using (exists (select 1 from workspace_members m where m.workspace_id = kg_edges.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = kg_edges.workspace_id and m.user_id = auth.uid()));

drop policy if exists "Members access kg_aliases" on kg_aliases;
create policy "Members access kg_aliases" on kg_aliases for all
  using (exists (select 1 from workspace_members m where m.workspace_id = kg_aliases.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = kg_aliases.workspace_id and m.user_id = auth.uid()));

drop policy if exists "Members access kg_domain_events" on kg_domain_events;
create policy "Members access kg_domain_events" on kg_domain_events for all
  using (exists (select 1 from workspace_members m where m.workspace_id = kg_domain_events.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = kg_domain_events.workspace_id and m.user_id = auth.uid()));

drop policy if exists "Members access competitor_profiles" on competitor_profiles;
create policy "Members access competitor_profiles" on competitor_profiles for all
  using (exists (select 1 from workspace_members m where m.workspace_id = competitor_profiles.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = competitor_profiles.workspace_id and m.user_id = auth.uid()));

drop policy if exists "Members access agent_memory_entries" on agent_memory_entries;
create policy "Members access agent_memory_entries" on agent_memory_entries for all
  using (exists (select 1 from workspace_members m where m.workspace_id = agent_memory_entries.workspace_id and m.user_id = auth.uid()))
  with check (exists (select 1 from workspace_members m where m.workspace_id = agent_memory_entries.workspace_id and m.user_id = auth.uid()));
