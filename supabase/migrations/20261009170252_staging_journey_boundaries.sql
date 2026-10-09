-- Invoker RPCs need matching RLS. Integrity triggers preserve suppression history.
create policy suppression_admin_insert on public.suppression_entries for insert to authenticated
with check (can_manage_workspace(workspace_id) and created_by=auth.uid() and lifted_at is null and lifted_by is null and lift_reason is null);
create policy suppression_admin_lift on public.suppression_entries for update to authenticated
using (can_manage_workspace(workspace_id) and lifted_at is null)
with check (can_manage_workspace(workspace_id) and lifted_by=auth.uid() and lifted_at is not null and nullif(btrim(lift_reason),'') is not null);

create function public.guard_suppression_history() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.account_id is not null and not exists(select 1 from accounts where id=new.account_id and workspace_id=new.workspace_id) then raise exception 'suppression account scope mismatch'; end if;
    if new.contact_id is not null and not exists(select 1 from contacts where id=new.contact_id and workspace_id=new.workspace_id) then raise exception 'suppression contact scope mismatch'; end if;
  else
    if (new.id,new.workspace_id,new.scope,new.account_id,new.contact_id,new.normalized_value,new.reason,new.source,new.created_by,new.created_at)
       is distinct from (old.id,old.workspace_id,old.scope,old.account_id,old.contact_id,old.normalized_value,old.reason,old.source,old.created_by,old.created_at)
       or old.lifted_at is not null then raise exception 'suppression history is immutable'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.guard_suppression_history() from public,anon,authenticated;
create trigger suppression_history_guard before insert or update on public.suppression_entries for each row execute function public.guard_suppression_history();

-- Derive receipts from stored workspace policy and provenance, never caller assertions.
create function public.bind_revision_policy() returns trigger language plpgsql set search_path=public as $$
declare
  v_account accounts%rowtype; v_contact contacts%rowtype; v_region text;
  v_basis jsonb; v_purpose text; v_source_ready boolean; v_suppressed boolean;
  v_reasons text[] := '{}';
begin
  select a.* into v_account from outreach o join accounts a on a.id=o.account_id and a.workspace_id=o.workspace_id
  where o.id=new.outreach_id and o.workspace_id=new.workspace_id;
  select c.* into v_contact from outreach o join contacts c on c.id=o.contact_id and c.account_id=o.account_id and c.workspace_id=o.workspace_id
  where o.id=new.outreach_id and o.workspace_id=new.workspace_id;
  if v_account.id is null or v_contact.id is null then raise exception 'revision account/recipient scope mismatch'; end if;
  v_region:=upper(btrim(coalesce(v_account.country,'')));
  if v_region='UK' then v_region:='GB'; end if;
  select outreach_rules->'regionPolicyBasis'->v_region into v_basis from workspace_sales_config where workspace_id=new.workspace_id;
  select purpose into v_purpose from data_governance_policies where workspace_id=new.workspace_id;
  v_suppressed:=is_outreach_suppressed(new.workspace_id,v_account.id,v_contact.id);
  v_source_ready:=jsonb_typeof(new.evidence_snapshot)='array' and jsonb_array_length(new.evidence_snapshot)>0
    and not exists(select 1 from jsonb_array_elements(new.evidence_snapshot) e where not exists(
      select 1 from signals s join source_provenance p on p.entity_id=s.id and p.workspace_id=s.workspace_id and p.entity_type='signal'
      where s.id::text=e->>'id' and s.workspace_id=new.workspace_id and s.account_id=v_account.id
        and p.license_status='verified' and nullif(btrim(p.collection_purpose),'') is not null));
  if v_suppressed then v_reasons:=array_append(v_reasons,'suppressed'); end if;
  if not coalesce(v_contact.email_verified,false) or nullif(btrim(v_contact.email),'') is null then v_reasons:=array_append(v_reasons,'professional_email_unverified'); end if;
  if v_region='' then v_reasons:=array_append(v_reasons,'jurisdiction_unknown');
  elsif v_region not in ('US','CA','GB','EU') then v_reasons:=array_append(v_reasons,'jurisdiction_policy_unconfigured'); end if;
  if coalesce(v_basis->>'status','unknown')<>'verified' or nullif(btrim(v_basis->>'reference'),'') is null then v_reasons:=array_append(v_reasons,'policy_basis_unverified'); end if;
  if nullif(btrim(v_purpose),'') is null then v_reasons:=array_append(v_reasons,'purpose_missing'); end if;
  if not coalesce(v_source_ready,false) then v_reasons:=array_append(v_reasons,'source_provenance_unverified'); end if;
  new.policy_receipt:=jsonb_build_object('contractVersion','outreach-policy-v1','decision',case when cardinality(v_reasons)=0 then 'eligible_for_human_review' else 'blocked' end,
    'region',nullif(v_region,''),'reasons',to_jsonb(v_reasons),'evaluatedInputs',jsonb_build_object('suppressed',v_suppressed,'professionalEmailVerified',coalesce(v_contact.email_verified,false),
    'policyBasisStatus',coalesce(v_basis->>'status','unknown'),'purposePresent',nullif(btrim(v_purpose),'') is not null,'sourceProvenanceReady',coalesce(v_source_ready,false)));
  return new;
end; $$;
revoke all on function public.bind_revision_policy() from public,anon,authenticated;
create trigger outreach_revision_policy_binding before insert on public.outreach_revisions for each row execute function public.bind_revision_policy();

-- Also covers direct approval INSERT: reject stale receipts and live suppression.
create or replace function public.enforce_outreach_approval_binding() returns trigger language plpgsql set search_path=public as $$
declare v_outreach outreach%rowtype; v_revision outreach_revisions%rowtype; v_contact contacts%rowtype; v_proof jsonb;
begin
  if new.decided_by is distinct from auth.uid() or not can_manage_workspace(new.workspace_id) then raise exception 'workspace admin required'; end if;
  select * into v_outreach from outreach where id=new.outreach_id and workspace_id=new.workspace_id for update;
  select * into v_revision from outreach_revisions where id=new.revision_id and workspace_id=new.workspace_id and outreach_id=new.outreach_id;
  if v_outreach.id is null or v_revision.id is null or v_outreach.current_revision_id is distinct from new.revision_id then raise exception 'approval requires current workspace revision'; end if;
  if new.decision='rejected' then return new; end if;
  if is_outreach_suppressed(new.workspace_id,v_outreach.account_id,v_outreach.contact_id) then raise exception 'suppressed outreach'; end if;
  select * into v_contact from contacts where id=v_outreach.contact_id and workspace_id=new.workspace_id and account_id=v_outreach.account_id;
  if v_contact.id is null or not coalesce(v_contact.email_verified,false) or lower(btrim(v_contact.email)) is distinct from lower(btrim(v_revision.recipient_snapshot->>'email'))
    or coalesce((v_revision.recipient_snapshot->>'emailVerified')::boolean,false) is not true then raise exception 'verified current recipient required'; end if;
  if nullif(btrim(v_revision.body),'') is null or nullif(btrim(v_revision.reason_to_contact),'') is null or jsonb_array_length(v_revision.evidence_snapshot)=0 then raise exception 'evidence and complete revision required'; end if;
  if coalesce((v_revision.compliance_snapshot->>'humanApprovalRequired')::boolean,false) is not true or coalesce((v_revision.compliance_snapshot->>'autonomousSendEnabled')::boolean,true) is not false then raise exception 'held human approval boundary required'; end if;
  if not coalesce(validate_outreach_policy_receipt(v_revision.policy_receipt),false) then raise exception 'outreach policy receipt required'; end if;
  -- Re-evaluate stored policy/provenance when reviewing an older held draft.
  if not exists(select 1 from accounts a join workspace_sales_config c on c.workspace_id=a.workspace_id
    join data_governance_policies g on g.workspace_id=a.workspace_id
    where a.id=v_outreach.account_id and a.workspace_id=new.workspace_id
      and upper(a.country)=v_revision.policy_receipt->>'region'
      and c.outreach_rules->'regionPolicyBasis'->upper(a.country)->>'status'='verified'
      and nullif(btrim(c.outreach_rules->'regionPolicyBasis'->upper(a.country)->>'reference'),'') is not null
      and nullif(btrim(g.purpose),'') is not null) then raise exception 'current workspace policy required'; end if;
  if exists(select 1 from jsonb_array_elements(v_revision.evidence_snapshot) e where not exists(
    select 1 from signals s join source_provenance p on p.entity_id=s.id and p.workspace_id=s.workspace_id and p.entity_type='signal'
    where s.id::text=e->>'id' and s.workspace_id=new.workspace_id and s.account_id=v_outreach.account_id and p.license_status='verified')) then raise exception 'current source provenance required'; end if;
  for v_proof in select value from jsonb_array_elements(v_revision.proof_snapshot) loop
    if not exists(select 1 from proof_points where id::text=v_proof->>'proofPointId' and workspace_id=new.workspace_id and approved and approved_claim=v_proof->>'approvedClaim') then raise exception 'approved proof changed'; end if;
  end loop;
  return new;
end; $$;

-- Review RPC delegates all approval eligibility to the shared INSERT trigger.
create or replace function public.review_outreach_revision(p_outreach_id uuid,p_revision_id uuid,p_decision text,p_decision_note text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_workspace uuid; v_current uuid; v_decision uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid review decision'; end if;
  select workspace_id,current_revision_id into v_workspace,v_current from outreach where id=p_outreach_id for update;
  if v_workspace is null or not can_manage_workspace(v_workspace) then raise exception 'workspace admin required'; end if;
  if v_current is distinct from p_revision_id then raise exception 'stale outreach revision'; end if;
  insert into outreach_approvals(workspace_id,outreach_id,revision_id,decision,decided_by,decision_note)
  values(v_workspace,p_outreach_id,p_revision_id,p_decision,auth.uid(),nullif(btrim(left(coalesce(p_decision_note,''),1000)),'')) returning id into v_decision;
  update outreach set status=case when p_decision='approved' then 'approved'::outreach_status else 'paused'::outreach_status end,
    approved_revision_id=case when p_decision='approved' then p_revision_id else null end,
    approved_at=case when p_decision='approved' then now() else null end,
    approved_by=case when p_decision='approved' then auth.uid()::text else null end
  where id=p_outreach_id and workspace_id=v_workspace and current_revision_id=p_revision_id;
  if not found then raise exception 'outreach changed during review'; end if;
  return v_decision;
end; $$;

create function public.guard_held_outreach_state() returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='sent' or new.sent_at is not null or new.provider_message_id is not null then raise exception 'outbound sending disabled'; end if;
  if new.status='approved' or new.approved_revision_id is not null then
    if not can_manage_workspace(new.workspace_id) or new.status<>'approved' or new.current_revision_id is distinct from new.approved_revision_id
      or not exists(select 1 from outreach_approvals where workspace_id=new.workspace_id and outreach_id=new.id and revision_id=new.current_revision_id and decision='approved' and decided_by::text=new.approved_by)
      then raise exception 'exact owner/admin approval required'; end if;
    if is_outreach_suppressed(new.workspace_id,new.account_id,new.contact_id) then raise exception 'suppressed outreach'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.guard_held_outreach_state() from public,anon,authenticated;
create trigger outreach_state_guard before insert or update on public.outreach for each row execute function public.guard_held_outreach_state();
