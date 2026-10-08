-- Commercial SaaS foundation: tenant/workspace isolation.
-- DCL becomes one workspace rather than a hard-coded special case.

create type workspace_role as enum ('owner','admin','member','viewer');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan_key text not null default 'internal',
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table workspace_sales_config (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  services jsonb not null default '[]'::jsonb,
  target_countries text[] not null default '{}',
  target_industries text[] not null default '{}',
  fit_weights jsonb not null default '{}'::jsonb,
  need_weights jsonb not null default '{}'::jsonb,
  intent_weights jsonb not null default '{}'::jsonb,
  exclusion_rules jsonb not null default '[]'::jsonb,
  buyer_role_rules jsonb not null default '{}'::jsonb,
  sales_motion_rules jsonb not null default '{}'::jsonb,
  outreach_rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table provider_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null,
  action text not null,
  units numeric(12,4) not null default 1,
  estimated_cost_usd numeric(12,6),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Existing business data becomes tenant scoped.
alter table accounts add column workspace_id uuid references workspaces(id) on delete cascade;
alter table signals add column workspace_id uuid references workspaces(id) on delete cascade;
alter table storefront_findings add column workspace_id uuid references workspaces(id) on delete cascade;
alter table contacts add column workspace_id uuid references workspaces(id) on delete cascade;
alter table proof_points add column workspace_id uuid references workspaces(id) on delete cascade;
alter table outreach add column workspace_id uuid references workspaces(id) on delete cascade;
alter table source_audit add column workspace_id uuid references workspaces(id) on delete cascade;
alter table discovery_runs add column workspace_id uuid references workspaces(id) on delete cascade;
alter table discovery_observations add column workspace_id uuid references workspaces(id) on delete cascade;

-- Domain and signal identity are unique inside a customer workspace, not globally.
alter table accounts drop constraint if exists accounts_domain_key;
alter table signals drop constraint if exists signals_fingerprint_key;
create unique index accounts_workspace_domain_key on accounts(workspace_id, domain) where workspace_id is not null;
create unique index signals_workspace_fingerprint_key on signals(workspace_id, fingerprint) where workspace_id is not null;
create index provider_usage_workspace_time_idx on provider_usage(workspace_id, occurred_at desc);
create index workspace_members_user_idx on workspace_members(user_id, workspace_id);

-- Existing tables were default-deny in migration 003. Add authenticated tenant policies.
-- Service-role server operations bypass RLS as before.
create or replace function is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid()
  );
$$;

create or replace function can_manage_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  );
$$;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_sales_config enable row level security;
alter table provider_usage enable row level security;

create policy workspaces_select_member on workspaces for select using (is_workspace_member(id));
create policy workspaces_update_admin on workspaces for update using (can_manage_workspace(id)) with check (can_manage_workspace(id));
create policy workspace_members_select_member on workspace_members for select using (is_workspace_member(workspace_id));
create policy workspace_members_manage_admin on workspace_members for all using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));
create policy workspace_config_select_member on workspace_sales_config for select using (is_workspace_member(workspace_id));
create policy workspace_config_manage_admin on workspace_sales_config for all using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));
create policy provider_usage_select_admin on provider_usage for select using (can_manage_workspace(workspace_id));

-- Tenant-scoped read/write policies for product data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts','signals','storefront_findings','contacts','proof_points','outreach',
    'source_audit','discovery_runs','discovery_observations'
  ]
  loop
    execute format('create policy %I on %I for select using (is_workspace_member(workspace_id))', table_name || '_tenant_select', table_name);
    execute format('create policy %I on %I for insert with check (can_manage_workspace(workspace_id))', table_name || '_tenant_insert', table_name);
    execute format('create policy %I on %I for update using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id))', table_name || '_tenant_update', table_name);
    execute format('create policy %I on %I for delete using (can_manage_workspace(workspace_id))', table_name || '_tenant_delete', table_name);
  end loop;
end $$;
