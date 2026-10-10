-- Team directory contains member email addresses and is only required by workspace managers.
-- Keep the SECURITY DEFINER read narrow and enforce the same Owner/Admin boundary as team mutations.

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
    and public.can_manage_workspace(p_workspace_id)
  order by
    case wm.role when 'owner' then 1 when 'admin' then 2 when 'member' then 3 else 4 end,
    wm.created_at;
$$;

revoke all on function get_workspace_member_directory(uuid) from public, anon;
grant execute on function get_workspace_member_directory(uuid) to authenticated;
