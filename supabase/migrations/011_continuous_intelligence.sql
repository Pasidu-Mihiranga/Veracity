-- Phase 6: canonical entities, immutable monitoring snapshots, and refreshed board packs.

create table if not exists canonical_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid,
  scope_key text not null,
  entity_key text not null,
  entity_type text not null check (entity_type in ('company', 'competitor', 'product')),
  display_name text not null,
  official_domains text[] not null default '{}',
  product_lines text[] not null default '{}',
  props jsonb not null default '{}',
  confidence real not null default 0.7 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_key, entity_type, entity_key)
);
create index if not exists canonical_entities_scope_idx
  on canonical_entities(user_id, workspace_id, entity_type);

create table if not exists canonical_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references canonical_entities(id) on delete cascade,
  user_id uuid not null,
  workspace_id uuid,
  scope_key text not null,
  alias_key text not null,
  alias text not null,
  source text not null default 'monitoring'
    check (source in ('monitoring', 'manual', 'resolver', 'official-domain')),
  created_at timestamptz not null default now(),
  unique (scope_key, alias_key)
);
create index if not exists canonical_entity_aliases_entity_idx
  on canonical_entity_aliases(entity_id);

create table if not exists source_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references canonical_entities(id) on delete cascade,
  user_id uuid not null,
  workspace_id uuid,
  scope_key text not null,
  job_id uuid,
  source_type text not null,
  source_url text not null,
  source_title text not null default '',
  content_hash text not null,
  extracted jsonb not null default '{}',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (entity_id, source_url, content_hash)
);
create index if not exists source_snapshots_entity_observed_idx
  on source_snapshots(entity_id, observed_at desc);

create table if not exists competitor_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references canonical_entities(id) on delete cascade,
  user_id uuid not null,
  workspace_id uuid,
  job_id uuid,
  profile_hash text not null,
  profile jsonb not null default '{}',
  diff jsonb not null default '{}',
  material_event_count integer not null default 0,
  source_snapshot_ids jsonb not null default '[]',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (entity_id, profile_hash)
);
create index if not exists competitor_profile_snapshots_entity_idx
  on competitor_profile_snapshots(entity_id, observed_at desc);

create table if not exists board_pack_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid,
  scope_key text not null,
  period_start date not null,
  period_end date not null,
  pack jsonb not null,
  event_count integer not null default 0,
  decision_count integer not null default 0,
  content_hash text not null,
  refresh_reason text not null default 'scheduled',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (scope_key, period_start, period_end, content_hash)
);
create index if not exists board_pack_snapshots_scope_idx
  on board_pack_snapshots(user_id, workspace_id, generated_at desc);

alter table canonical_entities enable row level security;
alter table canonical_entity_aliases enable row level security;
alter table source_snapshots enable row level security;
alter table competitor_profile_snapshots enable row level security;
alter table board_pack_snapshots enable row level security;

create policy "Users access canonical entities" on canonical_entities for all
  using (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = canonical_entities.workspace_id and m.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = canonical_entities.workspace_id and m.user_id = auth.uid()
  ));
create policy "Users access canonical aliases" on canonical_entity_aliases for all
  using (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = canonical_entity_aliases.workspace_id and m.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = canonical_entity_aliases.workspace_id and m.user_id = auth.uid()
  ));
create policy "Users access source snapshots" on source_snapshots for all
  using (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = source_snapshots.workspace_id and m.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = source_snapshots.workspace_id and m.user_id = auth.uid()
  ));
create policy "Users access profile snapshots" on competitor_profile_snapshots for all
  using (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = competitor_profile_snapshots.workspace_id and m.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = competitor_profile_snapshots.workspace_id and m.user_id = auth.uid()
  ));
create policy "Users access board pack snapshots" on board_pack_snapshots for all
  using (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = board_pack_snapshots.workspace_id and m.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from workspace_members m
    where m.workspace_id = board_pack_snapshots.workspace_id and m.user_id = auth.uid()
  ));

