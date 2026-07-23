-- Phase 5: Continuous Platform (audit, watchlists, alerts, timeline, decisions)

-- ── audit_logs ──────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_idx
  on audit_logs(user_id, created_at desc);

alter table audit_logs enable row level security;

create policy "Users own their audit logs"
  on audit_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── watchlists ──────────────────────────────────────────────────────────────
create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  product text not null default '',
  enabled boolean not null default true,
  last_sweep_at timestamptz,
  next_sweep_at timestamptz,
  health_status text not null default 'paused'
    check (health_status in ('healthy', 'degraded', 'stale', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchlists_user_idx on watchlists(user_id);

alter table watchlists enable row level security;

create policy "Users own their watchlists"
  on watchlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── watchlist_items ─────────────────────────────────────────────────────────
create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  competitor text not null,
  competitor_url text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists watchlist_items_watchlist_idx on watchlist_items(watchlist_id);

alter table watchlist_items enable row level security;

create policy "Users own their watchlist items"
  on watchlist_items for all
  using (
    exists (
      select 1 from watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

-- ── alert_events ────────────────────────────────────────────────────────────
create table if not exists alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  watchlist_id uuid references watchlists(id) on delete set null,
  job_id uuid,
  product text not null default '',
  competitor text not null default '',
  title text not null,
  summary text not null default '',
  severity text not null default 'medium'
    check (severity in ('high', 'medium', 'low')),
  diff jsonb not null default '{}',
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists alert_events_user_created_idx
  on alert_events(user_id, created_at desc);
create index if not exists alert_events_user_unread_idx
  on alert_events(user_id) where read_at is null;

alter table alert_events enable row level security;

create policy "Users own their alert events"
  on alert_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── competitive_events ──────────────────────────────────────────────────────
create table if not exists competitive_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product text not null default '',
  competitor text not null,
  event_date date not null default current_date,
  title text not null,
  summary text not null default '',
  category text not null default 'other'
    check (category in ('pricing', 'launch', 'feature', 'hiring', 'docs', 'sentiment', 'funding', 'other')),
  source_urls jsonb not null default '[]',
  job_id uuid,
  confidence text not null default 'medium',
  cluster_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists competitive_events_user_comp_idx
  on competitive_events(user_id, competitor, event_date desc);
create index if not exists competitive_events_cluster_idx
  on competitive_events(user_id, cluster_key);

alter table competitive_events enable row level security;

create policy "Users own their competitive events"
  on competitive_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── decision_memory ─────────────────────────────────────────────────────────
create table if not exists decision_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid references chat_sessions(id) on delete set null,
  title text not null,
  rationale text not null default '',
  decision text not null
    check (decision in ('accepted', 'rejected', 'refined', 'deferred')),
  reason text not null default '',
  outcome text not null default 'pending'
    check (outcome in ('pending', 'validated', 'invalidated', 'adopted_after_reject')),
  confidence real not null default 0.65
    check (confidence >= 0 and confidence <= 1),
  outcome_note text,
  source_recommendation_key text,
  evidence_urls jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_memory_user_idx
  on decision_memory(user_id, created_at desc);
create index if not exists decision_memory_key_idx
  on decision_memory(user_id, source_recommendation_key);

alter table decision_memory enable row level security;

create policy "Users own their decision memory"
  on decision_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
