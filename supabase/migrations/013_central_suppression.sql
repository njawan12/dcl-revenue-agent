-- Central suppression contract for commercial outreach.
-- Suppression is workspace-scoped, auditable, and checked against live data both
-- when a held draft is created and when its exact revision is approved.
-- This migration does not add any send/provider capability.

create table suppression_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scope text not null check (scope in ('account','contact','email','domain')),
  account_id uuid references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  normalized_value text,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  source text not null default 'operator' check (length(source) <= 100),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id),
  lift_reason text,
  check (
    (scope='account' and account_id is not null and contact_id is null and normalized_value is null) or
    (scope='contact' and contact_id is not null and normalized_value is null) or
    (scope in ('email','domain') and normalized_value is not null and length(btrim(normalized_value)) > 0)
  )
);

create index suppression_entries_active_account on suppression_entries(workspace_id,account_id) where lifted_at is null;
create index suppression_entries_active_contact on suppression_entries(workspace_id,contact_id) where lifted_at is null;
create index suppression_entries_active_value on suppression_entries(workspace_id,scope,normalized_value) where lifted_at is null;

alter table suppression_entries enable row level security;
create policy suppression_entries_read on suppression_entries for select using (is_workspace_member(workspace_id));
-- Suppression mutation is intentionally routed through reviewed RPCs later; no broad direct write policy.

create or replace function is_outreach_suppressed(p_workspace_id uuid,p_account_id uuid,p_contact_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_domain text;
  v_email text;
  v_account_suppressed boolean;
begin
  if not is_workspace_member(p_workspace_id) then raise exception 'workspace access required'; end if;

  select lower(btrim(a.domain)),coalesce(a.suppressed,false)
    into v_domain,v_account_suppressed
  from accounts a where a.id=p_account_id and a.workspace_id=p_workspace_id;
  if not found then return true; end if;
  if v_account_suppressed then return true; end if;

  if p_contact_id is not null then
    select lower(btrim(c.email)) into v_email
    from contacts c where c.id=p_contact_id and c.account_id=p_account_id and c.workspace_id=p_workspace_id;
    if not found then return true; end if;
  end if;

  return exists (
    select 1 from suppression_entries s
    where s.workspace_id=p_workspace_id and s.lifted_at is null and (
      (s.scope='account' and s.account_id=p_account_id) or
      (s.scope='contact' and s.contact_id=p_contact_id) or
      (s.scope='email' and v_email is not null and s.normalized_value=v_email) or
      (s.scope='domain' and v_domain is not null and s.normalized_value=v_domain)
    )
  );
end;
$$;
revoke all on function is_outreach_suppressed(uuid,uuid,uuid) from public;
grant execute on function is_outreach_suppressed(uuid,uuid,uuid) to authenticated;

create or replace function create_held_outreach_revision(
  p_account_id uuid,p_contact_id uuid,p_subject text,p_body text,p_motion text,
  p_reason_to_contact text,p_evidence_snapshot jsonb,p_proof_snapshot jsonb,
  p_recipient_snapshot jsonb,p_compliance_snapshot jsonb,p_content_hash text
)
returns table(outreach_id uuid, revision_id uuid)
language plpgsql security invoker set search_path=public as $$
declare
  v_workspace_id uuid; v_outreach_id uuid; v_revision_id uuid;
  v_contact_workspace uuid; v_contact_account uuid; v_email_verified boolean; v_email text;
begin
  select a.workspace_id into v_workspace_id from accounts a where a.id=p_account_id;
  if v_workspace_id is null or not can_manage_workspace(v_workspace_id) then raise exception 'account_not_manageable'; end if;

  select c.workspace_id,c.account_id,c.email_verified,lower(btrim(c.email))
    into v_contact_workspace,v_contact_account,v_email_verified,v_email
  from contacts c where c.id=p_contact_id;
  if v_contact_workspace is distinct from v_workspace_id or v_contact_account is distinct from p_account_id then raise exception 'recipient_scope_mismatch'; end if;
  if not coalesce(v_email_verified,false) or v_email is null then raise exception 'unverified_recipient'; end if;
  if is_outreach_suppressed(v_workspace_id,p_account_id,p_contact_id) then raise exception 'suppressed_recipient'; end if;
  if nullif(btrim(p_reason_to_contact),'') is null then raise exception 'missing_reason_to_contact'; end if;
  if nullif(btrim(p_body),'') is null then raise exception 'empty_body'; end if;
  if jsonb_array_length(coalesce(p_evidence_snapshot,'[]'::jsonb))=0 then raise exception 'missing_evidence'; end if;

  insert into outreach(workspace_id,account_id,contact_id,status,subject,body,motion,held_at)
  values(v_workspace_id,p_account_id,p_contact_id,'ready',p_subject,p_body,p_motion,now()) returning id into v_outreach_id;
  insert into outreach_revisions(workspace_id,outreach_id,revision_number,subject,body,motion,reason_to_contact,evidence_snapshot,proof_snapshot,recipient_snapshot,compliance_snapshot,content_hash,created_by)
  values(v_workspace_id,v_outreach_id,1,p_subject,p_body,p_motion,p_reason_to_contact,coalesce(p_evidence_snapshot,'[]'::jsonb),coalesce(p_proof_snapshot,'[]'::jsonb),coalesce(p_recipient_snapshot,'{}'::jsonb),coalesce(p_compliance_snapshot,'{}'::jsonb),p_content_hash,auth.uid())
  returning id into v_revision_id;
  update outreach set current_revision_id=v_revision_id where id=v_outreach_id;
  return query select v_outreach_id,v_revision_id;
end;
$$;

create or replace function review_outreach_revision(p_outreach_id uuid,p_revision_id uuid,p_decision text,p_decision_note text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_workspace uuid; v_current_revision uuid; v_account uuid; v_contact uuid;
  v_revision outreach_revisions%rowtype; v_decision_id uuid; v_email_verified boolean;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid review decision'; end if;
  select workspace_id,current_revision_id,account_id,contact_id into v_workspace,v_current_revision,v_account,v_contact
  from outreach where id=p_outreach_id for update;
  if v_workspace is null then raise exception 'outreach not found'; end if;
  if not can_manage_workspace(v_workspace) then raise exception 'workspace admin required'; end if;
  if v_current_revision is distinct from p_revision_id then raise exception 'stale outreach revision'; end if;

  select * into v_revision from outreach_revisions where id=p_revision_id and outreach_id=p_outreach_id and workspace_id=v_workspace;
  if not found then raise exception 'revision not found'; end if;
  if btrim(v_revision.body)='' or btrim(v_revision.reason_to_contact)='' then raise exception 'incomplete revision'; end if;
  if jsonb_array_length(v_revision.evidence_snapshot)=0 then raise exception 'evidence required'; end if;

  select email_verified into v_email_verified from contacts
  where id=v_contact and account_id=v_account and workspace_id=v_workspace;
  if not found or not coalesce(v_email_verified,false) then raise exception 'verified recipient required'; end if;
  if is_outreach_suppressed(v_workspace,v_account,v_contact) then raise exception 'suppressed outreach'; end if;
  if coalesce((v_revision.compliance_snapshot->>'humanApprovalRequired')::boolean,true) is not true then raise exception 'human approval boundary required'; end if;
  if coalesce((v_revision.compliance_snapshot->>'autonomousSendEnabled')::boolean,false) is not false then raise exception 'autonomous sending must remain disabled'; end if;

  insert into outreach_approvals(workspace_id,outreach_id,revision_id,decision,decided_by,decision_note)
  values(v_workspace,p_outreach_id,p_revision_id,p_decision,auth.uid(),nullif(btrim(left(coalesce(p_decision_note,''),1000)),'')) returning id into v_decision_id;
  if p_decision='approved' then
    update outreach set status='approved',approved_revision_id=p_revision_id,approved_at=now(),approved_by=auth.uid()::text
    where id=p_outreach_id and workspace_id=v_workspace and current_revision_id=p_revision_id;
  else
    update outreach set status='paused',approved_revision_id=null,approved_at=null,approved_by=null
    where id=p_outreach_id and workspace_id=v_workspace and current_revision_id=p_revision_id;
  end if;
  if not found then raise exception 'outreach changed during review'; end if;
  return v_decision_id;
end;
$$;
