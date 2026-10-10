-- Workspace operating layer: saved views and safe team directory for the commercial UI.

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  entity_type text not null check (entity_type in ('global','accounts','contacts','messages','pipeline')),
  filters jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_views_workspace_idx on saved_views(workspace_id, entity_type, updated_at desc);
create unique index if not exists saved_views_owner_name_key on saved_views(workspace_id, owner_user_id, lower(name));

alter table saved_views enable row level security;

create policy saved_views_select on saved_views
for select using (
  is_workspace_member(workspace_id)
  and (shared = true or owner_user_id = auth.uid() or can_manage_workspace(workspace_id))
);

create policy saved_views_insert on saved_views
for insert with check (
  is_workspace_member(workspace_id)
  and owner_user_id = auth.uid()
);

create policy saved_views_update on saved_views
for update using (
  owner_user_id = auth.uid() or can_manage_workspace(workspace_id)
) with check (
  owner_user_id = auth.uid() or can_manage_workspace(workspace_id)
);

create policy saved_views_delete on saved_views
for delete using (
  owner_user_id = auth.uid() or can_manage_workspace(workspace_id)
);

create or replace function get_workspace_member_directory(p_workspace_id uuid)
returns table(user_id uuid, email text, role workspace_role, joined_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select wm.user_id, au.email::text, wm.role, wm.created_at
  from public.workspace_members wm
  join auth.users au on au.id = wm.user_id
  where wm.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id)
  order by
    case wm.role when 'owner' then 1 when 'admin' then 2 when 'member' then 3 else 4 end,
    wm.created_at;
$$;

revoke all on function get_workspace_member_directory(uuid) from public, anon;
grant execute on function get_workspace_member_directory(uuid) to authenticated;
