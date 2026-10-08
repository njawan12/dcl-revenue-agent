-- Bind the conservative outreach-policy-v1 receipt to the database approval boundary.
-- This does not determine legal compliance and does not implement sending.

alter table outreach_revisions
  add column policy_receipt jsonb not null default '{}'::jsonb;

create or replace function validate_outreach_policy_receipt(receipt jsonb)
returns boolean
language sql
immutable
as $$
  select
    receipt->>'contractVersion' = 'outreach-policy-v1'
    and receipt->>'decision' = 'eligible_for_human_review'
    and nullif(receipt->>'region','') is not null
    and coalesce((receipt->'evaluatedInputs'->>'suppressed')::boolean, true) is false
    and coalesce((receipt->'evaluatedInputs'->>'professionalEmailVerified')::boolean, false) is true
    and receipt->'evaluatedInputs'->>'policyBasisStatus' = 'verified'
    and coalesce((receipt->'evaluatedInputs'->>'purposePresent')::boolean, false) is true
    and coalesce((receipt->'evaluatedInputs'->>'sourceProvenanceReady')::boolean, false) is true
    and jsonb_typeof(coalesce(receipt->'reasons','[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(receipt->'reasons','[]'::jsonb)) = 0;
$$;

create or replace function review_outreach_revision(
  p_outreach_id uuid,
  p_revision_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace uuid;
  v_current_revision uuid;
  v_revision outreach_revisions%rowtype;
  v_decision_id uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid review decision'; end if;

  select workspace_id, current_revision_id into v_workspace, v_current_revision
  from outreach where id = p_outreach_id for update;
  if v_workspace is null then raise exception 'outreach not found'; end if;
  if not can_manage_workspace(v_workspace) then raise exception 'workspace admin required'; end if;
  if v_current_revision is distinct from p_revision_id then raise exception 'stale outreach revision'; end if;

  select * into v_revision from outreach_revisions
  where id = p_revision_id and outreach_id = p_outreach_id and workspace_id = v_workspace;
  if not found then raise exception 'revision not found'; end if;
  if btrim(v_revision.body) = '' or btrim(v_revision.reason_to_contact) = '' then raise exception 'incomplete revision'; end if;
  if jsonb_array_length(v_revision.evidence_snapshot) = 0 then raise exception 'evidence required'; end if;
  if coalesce((v_revision.recipient_snapshot->>'emailVerified')::boolean, false) is not true then raise exception 'verified recipient required'; end if;
  if nullif(v_revision.recipient_snapshot->>'email','') is null then raise exception 'recipient email required'; end if;
  if coalesce((v_revision.compliance_snapshot->>'suppressed')::boolean, false) is true then raise exception 'suppressed outreach'; end if;
  if coalesce((v_revision.compliance_snapshot->>'humanApprovalRequired')::boolean, true) is not true then raise exception 'human approval boundary required'; end if;
  if coalesce((v_revision.compliance_snapshot->>'autonomousSendEnabled')::boolean, false) is not false then raise exception 'autonomous sending must remain disabled'; end if;

  -- Rejection is always allowed so reviewers can reject legacy/blocked drafts.
  -- Approval requires the exact immutable revision to carry a passing policy receipt.
  if p_decision = 'approved' and not validate_outreach_policy_receipt(v_revision.policy_receipt) then
    raise exception 'outreach policy receipt required';
  end if;

  insert into outreach_approvals(workspace_id,outreach_id,revision_id,decision,decided_by,decision_note)
  values(v_workspace,p_outreach_id,p_revision_id,p_decision,auth.uid(),nullif(btrim(left(coalesce(p_decision_note,''),1000)),''))
  returning id into v_decision_id;

  if p_decision = 'approved' then
    update outreach set status='approved', approved_revision_id=p_revision_id, approved_at=now(), approved_by=auth.uid()::text
    where id=p_outreach_id and workspace_id=v_workspace and current_revision_id=p_revision_id;
  else
    update outreach set status='paused', approved_revision_id=null, approved_at=null, approved_by=null
    where id=p_outreach_id and workspace_id=v_workspace and current_revision_id=p_revision_id;
  end if;

  if not found then raise exception 'outreach changed during review'; end if;
  return v_decision_id;
end;
$$;

comment on column outreach_revisions.policy_receipt is 'Versioned policy evaluation bound to this immutable revision; eligibility means human review only, never legal compliance or send permission.';
