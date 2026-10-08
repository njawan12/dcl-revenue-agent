-- Align operator permissions with the commercial role contract:
-- Owner/Admin: configure + approve. Member: research/edit/draft/pipeline. Viewer: read-only.
-- Outreach approval remains separately admin-gated. No send capability is introduced.

create or replace function can_operate_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','member')
  );
$$;

revoke all on function can_operate_workspace(uuid) from public;
grant execute on function can_operate_workspace(uuid) to authenticated;

create or replace function update_native_pipeline(p_workspace_id uuid,p_account_id uuid,p_expected_revision integer,p_stage text,p_next_action text,p_due date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_account accounts%rowtype; v_revision integer;
begin
  if not can_operate_workspace(p_workspace_id) then raise exception 'workspace operator required'; end if;
  select * into v_account from accounts where id=p_account_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'account not found'; end if;
  if v_account.pipeline_revision is distinct from p_expected_revision then raise exception 'pipeline changed; refresh before saving'; end if;
  if p_stage is null or p_stage not in ('new','qualified','ready','contacted','engaged','meeting','opportunity','proposal','won','lost') then raise exception 'invalid pipeline stage'; end if;
  if is_outreach_suppressed(p_workspace_id,p_account_id,null,null) and p_stage not in ('new','lost') then
    raise exception 'suppressed account cannot advance';
  end if;
  if length(coalesce(p_next_action,'')) > 1000 then raise exception 'next action too long'; end if;
  if p_due is not null and btrim(coalesce(p_next_action,'')) = '' then raise exception 'due date requires next action'; end if;
  v_revision := v_account.pipeline_revision + 1;
  update accounts set pipeline_stage=p_stage,next_action=btrim(coalesce(p_next_action,'')),next_action_due=p_due,pipeline_revision=v_revision,updated_at=now()
  where id=p_account_id and workspace_id=p_workspace_id;
  insert into pipeline_events(workspace_id,account_id,previous_stage,stage,next_action,next_action_due,revision,recorded_by)
  values(p_workspace_id,p_account_id,v_account.pipeline_stage,p_stage,btrim(coalesce(p_next_action,'')),p_due,v_revision,auth.uid());
  return v_revision;
end;
$$;

-- Held-draft creation is an operator action. Approval remains owner/admin only in
-- review_outreach_revision. The underlying function retains all evidence,
-- recipient, tenant and suppression checks defined by the latest migration.
create or replace function operator_can_prepare_outreach(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select can_operate_workspace(target_workspace)
$$;
revoke all on function operator_can_prepare_outreach(uuid) from public;
grant execute on function operator_can_prepare_outreach(uuid) to authenticated;
