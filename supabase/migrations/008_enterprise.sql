-- Phase 6: Enterprise — workspaces, RBAC, invites, SSO configs, workspace_id tenancy

-- ── Tables first (policies after) ───────────────────────────────────────────
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null,
  logo_url text,
  timezone text,
  industry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_created_by_idx on workspaces(created_by);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members(user_id);
create index if not exists workspace_members_workspace_idx on workspace_members(workspace_id);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('admin', 'member', 'viewer')),
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_idx on workspace_invites(workspace_id);
create index if not exists workspace_invites_token_idx on workspace_invites(token);
create index if not exists workspace_invites_email_idx on workspace_invites(email);

create table if not exists workspace_sso_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  enabled boolean not null default false,
  idp_entity_id text,
  idp_sso_url text,
  idp_x509_cert text,
  sp_entity_id text,
  acs_path text not null default '/api/auth/saml/acs',
  allowed_email_domains text[] not null default '{}',
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── Add workspace_id columns (nullable first) ───────────────────────────────
alter table chat_sessions add column if not exists workspace_id uuid references workspaces(id);
alter table user_memory add column if not exists workspace_id uuid references workspaces(id);
alter table recommendation_feedback add column if not exists workspace_id uuid references workspaces(id);
alter table recommendation_actions add column if not exists workspace_id uuid references workspaces(id);
alter table variant_results add column if not exists workspace_id uuid references workspaces(id);
alter table research_jobs add column if not exists workspace_id uuid references workspaces(id);
alter table audit_logs add column if not exists workspace_id uuid references workspaces(id);
alter table watchlists add column if not exists workspace_id uuid references workspaces(id);
alter table alert_events add column if not exists workspace_id uuid references workspaces(id);
alter table competitive_events add column if not exists workspace_id uuid references workspaces(id);
alter table decision_memory add column if not exists workspace_id uuid references workspaces(id);

-- ── Backfill personal workspaces (local users table) ────────────────────────
do $$
declare
  u record;
  wid uuid;
  slug_base text;
begin
  if to_regclass('public.users') is null then
    return;
  end if;

  for u in select id, email from users loop
    select m.workspace_id into wid
    from workspace_members m
    where m.user_id = u.id and m.role = 'owner'
    limit 1;

    if wid is null then
      slug_base := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
      if slug_base = '' then slug_base := 'user'; end if;
      slug_base := slug_base || '-' || substr(u.id::text, 1, 8);

      insert into workspaces (name, slug, created_by)
      values (u.email || ' workspace', slug_base, u.id)
      returning id into wid;

      insert into workspace_members (workspace_id, user_id, role)
      values (wid, u.id, 'owner')
      on conflict do nothing;
    end if;

    update chat_sessions set workspace_id = wid where user_id = u.id and workspace_id is null;
    update user_memory set workspace_id = wid where user_id = u.id and workspace_id is null;
    update recommendation_feedback set workspace_id = wid where user_id = u.id and workspace_id is null;
    update recommendation_actions set workspace_id = wid where user_id = u.id and workspace_id is null;
    update variant_results set workspace_id = wid where user_id = u.id and workspace_id is null;
    update research_jobs set workspace_id = wid where user_id = u.id and workspace_id is null;
    update audit_logs set workspace_id = wid where user_id = u.id and workspace_id is null;
    update watchlists set workspace_id = wid where user_id = u.id and workspace_id is null;
    update alert_events set workspace_id = wid where user_id = u.id and workspace_id is null;
    update competitive_events set workspace_id = wid where user_id = u.id and workspace_id is null;
    update decision_memory set workspace_id = wid where user_id = u.id and workspace_id is null;
  end loop;
end $$;

create index if not exists chat_sessions_workspace_idx on chat_sessions(workspace_id, updated_at desc);
create index if not exists research_jobs_workspace_idx on research_jobs(workspace_id, status);
create index if not exists audit_logs_workspace_idx on audit_logs(workspace_id, created_at desc);
create index if not exists watchlists_workspace_idx on watchlists(workspace_id);
create index if not exists alert_events_workspace_idx on alert_events(workspace_id, created_at desc);
create index if not exists competitive_events_workspace_idx on competitive_events(workspace_id, event_date desc);
create index if not exists decision_memory_workspace_idx on decision_memory(workspace_id, created_at desc);
create index if not exists recommendation_feedback_workspace_idx on recommendation_feedback(workspace_id);
create index if not exists recommendation_actions_workspace_idx on recommendation_actions(workspace_id);
create index if not exists variant_results_workspace_idx on variant_results(workspace_id);
create index if not exists user_memory_workspace_idx on user_memory(workspace_id);

-- ── RLS policies ────────────────────────────────────────────────────────────
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table workspace_sso_configs enable row level security;

drop policy if exists "Members can read their workspaces" on workspaces;
create policy "Members can read their workspaces"
  on workspaces for select
  using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspaces.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Owners and admins can update workspaces" on workspaces;
create policy "Owners and admins can update workspaces"
  on workspaces for update
  using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "Authenticated users can create workspaces" on workspaces;
create policy "Authenticated users can create workspaces"
  on workspaces for insert
  with check (auth.uid() = created_by);

drop policy if exists "Members can read memberships in their workspaces" on workspace_members;
create policy "Members can read memberships in their workspaces"
  on workspace_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_members.workspace_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can manage memberships" on workspace_members;
create policy "Admins can manage memberships"
  on workspace_members for all
  using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "Admins manage invites" on workspace_invites;
create policy "Admins manage invites"
  on workspace_invites for all
  using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_invites.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_invites.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists "Admins manage SSO configs" on workspace_sso_configs;
create policy "Admins manage SSO configs"
  on workspace_sso_configs for all
  using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_sso_configs.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_sso_configs.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
