-- Atomic held-outbox write contract.
-- This function creates a draft container and its exact immutable revision together.
-- It does not send, schedule, enqueue, or call an outbound provider.

-- Revision content may be read and deleted under existing tenant policies, but never edited in place.
drop policy if exists outreach_revisions_tenant_update on outreach_revisions;
drop policy if exists outreach_approvals_tenant_update on outreach_approvals;

create or replace function create_held_outreach_revision(
  p_account_id uuid,
  p_contact_id uuid,
  p_subject text,
  p_body text,
  p_motion text,
  p_reason_to_contact text,
  p_evidence_snapshot jsonb,
  p_proof_snapshot jsonb,
  p_recipient_snapshot jsonb,
  p_compliance_snapshot jsonb,
  p_content_hash text
)
returns table(outreach_id uuid, revision_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_outreach_id uuid;
  v_revision_id uuid;
  v_contact_workspace uuid;
  v_contact_account uuid;
  v_email_verified boolean;
  v_suppressed boolean;
begin
  select a.workspace_id, a.suppressed
    into v_workspace_id, v_suppressed
  from accounts a
  where a.id = p_account_id;

  if v_workspace_id is null or not can_manage_workspace(v_workspace_id) then
    raise exception 'account_not_manageable';
  end if;
  if coalesce(v_suppressed, false) then
    raise exception 'suppressed_account';
  end if;

  select c.workspace_id, c.account_id, c.email_verified
    into v_contact_workspace, v_contact_account, v_email_verified
  from contacts c
  where c.id = p_contact_id;

  if v_contact_workspace is distinct from v_workspace_id or v_contact_account is distinct from p_account_id then
    raise exception 'recipient_scope_mismatch';
  end if;
  if not coalesce(v_email_verified, false) then
    raise exception 'unverified_recipient';
  end if;
  if nullif(trim(p_reason_to_contact), '') is null then
    raise exception 'missing_reason_to_contact';
  end if;
  if nullif(trim(p_body), '') is null then
    raise exception 'empty_body';
  end if;
  if jsonb_array_length(coalesce(p_evidence_snapshot, '[]'::jsonb)) = 0 then
    raise exception 'missing_evidence';
  end if;

  insert into outreach (workspace_id, account_id, contact_id, status, subject, body, motion, held_at)
  values (v_workspace_id, p_account_id, p_contact_id, 'ready', p_subject, p_body, p_motion, now())
  returning id into v_outreach_id;

  insert into outreach_revisions (
    workspace_id, outreach_id, revision_number, subject, body, motion,
    reason_to_contact, evidence_snapshot, proof_snapshot, recipient_snapshot,
    compliance_snapshot, content_hash, created_by
  ) values (
    v_workspace_id, v_outreach_id, 1, p_subject, p_body, p_motion,
    p_reason_to_contact, coalesce(p_evidence_snapshot, '[]'::jsonb),
    coalesce(p_proof_snapshot, '[]'::jsonb), coalesce(p_recipient_snapshot, '{}'::jsonb),
    coalesce(p_compliance_snapshot, '{}'::jsonb), p_content_hash, auth.uid()
  ) returning id into v_revision_id;

  update outreach set current_revision_id = v_revision_id where id = v_outreach_id;

  return query select v_outreach_id, v_revision_id;
end;
$$;
