-- Native operator pipeline. No sending or provider side effects.
alter table accounts add column pipeline_stage text not null default 'new'
  check (pipeline_stage in ('new','qualified','ready','contacted','engaged','meeting','opportunity','proposal','won','lost'));
alter table accounts add column next_action text not null default '' check (length(next_action) <= 1000);
alter table accounts add column next_action_due date;
alter table accounts add column pipeline_revision integer not null default 0;

create table pipeline_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  previous_stage text not null,
  stage text not null,
  next_action text not null,
  next_action_due date,
  revision integer not null,
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);
alter table pipeline_events enable row level security;
create policy pipeline_events_read on pipeline_events for select using (is_workspace_member(workspace_id));
create index pipeline_events_account on pipeline_events(workspace_id,account_id,recorded_at desc);
create index accounts_next_action on accounts(workspace_id,next_action_due) where suppressed = false;

-- Direct authenticated writes cannot bypass the revision/audit contract.
create function guard_pipeline_fields() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and TG_OP = 'INSERT' then
    if new.pipeline_stage <> 'new' or new.next_action <> '' or new.next_action_due is not null or new.pipeline_revision <> 0 then
      raise exception 'pipeline fields must start at defaults';
    end if;
    return new;
  end if;
  if current_user in ('authenticated','anon') and
     (new.pipeline_stage,new.next_action,new.next_action_due,new.pipeline_revision)
     is distinct from (old.pipeline_stage,old.next_action,old.next_action_due,old.pipeline_revision) then
    raise exception 'use update_native_pipeline';
  end if;
  return new;
end;
$$;
create trigger accounts_pipeline_guard before insert or update on accounts
for each row execute function guard_pipeline_fields();

create function update_native_pipeline(p_workspace_id uuid,p_account_id uuid,p_expected_revision integer,p_stage text,p_next_action text,p_due date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_account accounts%rowtype; v_revision integer;
begin
  if not can_manage_workspace(p_workspace_id) then raise exception 'workspace admin required'; end if;
  select * into v_account from accounts where id=p_account_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'account not found'; end if;
  if v_account.pipeline_revision is distinct from p_expected_revision then raise exception 'pipeline changed; refresh before saving'; end if;
  if p_stage is null or p_stage not in ('new','qualified','ready','contacted','engaged','meeting','opportunity','proposal','won','lost') then raise exception 'invalid pipeline stage'; end if;
  if coalesce(v_account.suppressed,false) and p_stage <> 'lost' then raise exception 'suppressed account cannot advance'; end if;
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
revoke all on function update_native_pipeline(uuid,uuid,integer,text,text,date) from public;
grant execute on function update_native_pipeline(uuid,uuid,integer,text,text,date) to authenticated;
