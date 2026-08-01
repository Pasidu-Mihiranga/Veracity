-- Phase 5: material watchlist events, cadence controls, and alert egress.

alter table watchlists add column if not exists cadence text not null default 'weekly';
alter table watchlists add column if not exists max_competitors integer not null default 6;
alter table watchlists add column if not exists weekly_alert_budget integer not null default 12;
alter table watchlists add column if not exists alert_channels text[] not null default array['in_app']::text[];
alter table watchlists add column if not exists last_sweep_summary jsonb not null default '{}'::jsonb;

alter table watchlists drop constraint if exists watchlists_cadence_check;
alter table watchlists add constraint watchlists_cadence_check
  check (cadence in ('daily', 'twice_weekly', 'weekly', 'monthly'));
alter table watchlists drop constraint if exists watchlists_max_competitors_check;
alter table watchlists add constraint watchlists_max_competitors_check
  check (max_competitors between 1 and 12);
alter table watchlists drop constraint if exists watchlists_weekly_alert_budget_check;
alter table watchlists add constraint watchlists_weekly_alert_budget_check
  check (weekly_alert_budget between 1 and 50);

alter table competitive_events drop constraint if exists competitive_events_category_check;
alter table competitive_events add constraint competitive_events_category_check
  check (category in (
    'pricing', 'launch', 'feature', 'hiring', 'leadership', 'security',
    'docs', 'sentiment', 'funding', 'acquisition', 'news', 'other'
  ));
alter table competitive_events add column if not exists severity text not null default 'low';
alter table competitive_events add column if not exists materiality_score real not null default 0;
alter table competitive_events drop constraint if exists competitive_events_severity_check;
alter table competitive_events add constraint competitive_events_severity_check
  check (severity in ('high', 'medium', 'low'));
alter table competitive_events drop constraint if exists competitive_events_materiality_check;
alter table competitive_events add constraint competitive_events_materiality_check
  check (materiality_score between 0 and 1);

create table if not exists alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  alert_id uuid not null references alert_events(id) on delete cascade,
  channel text not null check (channel in ('email', 'slack')),
  status text not null check (status in ('sent', 'skipped', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  unique (alert_id, channel)
);

create index if not exists alert_deliveries_user_created_idx
  on alert_deliveries(user_id, created_at desc);

alter table alert_deliveries enable row level security;
create policy "Users own their alert deliveries"
  on alert_deliveries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
