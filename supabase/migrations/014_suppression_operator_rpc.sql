-- Audited operator controls for suppression. These functions do not send outreach.
-- Owners/admins can add or lift suppression; all workspace members may read active/history via RLS.

create or replace function add_suppression(
  p_scope text,
  p_account_id uuid default null,
  p_contact_id uuid default null,
  p_value text default null,
  p_reason text default null,
  p_source text default 'operator'
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_workspace uuid;
  v_id uuid;
  v_value text;
begin
  if p_scope not in ('account','contact','email','domain') then raise exception 'invalid suppression scope'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'suppression reason required'; end if;

  if p_account_id is not null then select workspace_id into v_workspace from accounts where id=p_account_id; end if;
  if p_contact_id is not null then
    select workspace_id into v_workspace from contacts where id=p_contact_id and (p_account_id is null or account_id=p_account_id);
  end if;
  if v_workspace is null then raise exception 'workspace context required'; end if;
  if not can_manage_workspace(v_workspace) then raise exception 'workspace admin required'; end if;

  v_value := case when p_scope in ('email','domain') then lower(btrim(coalesce(p_value,''))) else null end;
  if p_scope in ('email','domain') and v_value='' then raise exception 'suppression value required'; end if;

  select id into v_id from suppression_entries
  where workspace_id=v_workspace and scope=p_scope and lifted_at is null
    and account_id is not distinct from (case when p_scope='account' then p_account_id else null end)
    and contact_id is not distinct from (case when p_scope='contact' then p_contact_id else null end)
    and normalized_value is not distinct from v_value
  limit 1;
  if v_id is not null then return v_id; end if;

  insert into suppression_entries(workspace_id,scope,account_id,contact_id,normalized_value,reason,source,created_by)
  values(v_workspace,p_scope,
    case when p_scope='account' then p_account_id else null end,
    case when p_scope='contact' then p_contact_id else null end,
    v_value,left(btrim(p_reason),500),left(coalesce(nullif(btrim(p_source),''),'operator'),100),auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function lift_suppression(p_suppression_id uuid,p_reason text)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare v_workspace uuid;
begin
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'lift reason required'; end if;
  select workspace_id into v_workspace from suppression_entries where id=p_suppression_id and lifted_at is null for update;
  if v_workspace is null then raise exception 'active suppression not found'; end if;
  if not can_manage_workspace(v_workspace) then raise exception 'workspace admin required'; end if;
  update suppression_entries set lifted_at=now(),lifted_by=auth.uid(),lift_reason=left(btrim(p_reason),500)
  where id=p_suppression_id and lifted_at is null;
end;
$$;

revoke all on function add_suppression(text,uuid,uuid,text,text,text) from public;
grant execute on function add_suppression(text,uuid,uuid,text,text,text) to authenticated;
revoke all on function lift_suppression(uuid,text) from public;
grant execute on function lift_suppression(uuid,text) to authenticated;
