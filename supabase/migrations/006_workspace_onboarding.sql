-- Authenticated SaaS onboarding: atomically create a workspace and make the caller its owner.
-- Direct unauthenticated workspace creation remains blocked by RLS.

create or replace function create_workspace_with_owner(
  workspace_name text,
  workspace_slug text,
  starter_services jsonb default '[]'::jsonb,
  starter_countries text[] default array['US','CA']::text[],
  starter_industries text[] default array['beauty','wellness','supplements','apparel','food-beverage','fitness','pet','home']::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_workspace_id uuid;
begin
  if caller is null then
    raise exception 'authentication_required';
  end if;
  if nullif(trim(workspace_name), '') is null then
    raise exception 'workspace_name_required';
  end if;
  if workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
    raise exception 'invalid_workspace_slug';
  end if;

  insert into workspaces(name, slug, plan_key)
  values (trim(workspace_name), lower(workspace_slug), 'trial')
  returning id into new_workspace_id;

  insert into workspace_members(workspace_id, user_id, role)
  values (new_workspace_id, caller, 'owner');

  insert into workspace_sales_config(
    workspace_id, services, target_countries, target_industries,
    outreach_rules
  ) values (
    new_workspace_id,
    coalesce(starter_services, '[]'::jsonb),
    coalesce(starter_countries, array['US','CA']::text[]),
    coalesce(starter_industries, '{}'::text[]),
    '{"requireReasonToContact":true,"requireVerifiedEmail":true,"requireHumanApproval":true}'::jsonb
  );

  return new_workspace_id;
end;
$$;

revoke all on function create_workspace_with_owner(text,text,jsonb,text[],text[]) from public;
grant execute on function create_workspace_with_owner(text,text,jsonb,text[],text[]) to authenticated;
