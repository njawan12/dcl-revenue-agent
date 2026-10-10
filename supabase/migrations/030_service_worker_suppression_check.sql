-- Service workers have no auth.uid(), so the human-facing suppression helper
-- intentionally rejects them. Recheck the same central suppression ledger inside
-- the service-only held-draft boundary without weakening human RLS rules.

begin;

create or replace function public.create_system_held_outreach_revision(
  p_workspace_id uuid,
  p_offer_profile_id uuid,
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
  p_policy_receipt jsonb,
  p_content_hash text
)
returns table(outreach_id uuid, revision_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_workspace uuid;
  v_contact_workspace uuid;
  v_contact_account uuid;
  v_email_verified boolean;
  v_email text;
  v_domain text;
  v_account_suppressed boolean;
  v_profile_workspace uuid;
  v_outreach_id uuid;
  v_revision_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;

  select a.workspace_id, lower(btrim(a.domain)), coalesce(a.suppressed,false)
    into v_account_workspace, v_domain, v_account_suppressed
  from public.accounts a where a.id = p_account_id;
  if v_account_workspace is distinct from p_workspace_id then raise exception 'account_scope_mismatch'; end if;
  if v_account_suppressed then raise exception 'suppressed_account'; end if;

  select op.workspace_id into v_profile_workspace
  from public.offer_profiles op where op.id = p_offer_profile_id and op.active is true;
  if v_profile_workspace is distinct from p_workspace_id then raise exception 'offer_profile_scope_mismatch'; end if;

  select c.workspace_id, c.account_id, coalesce(c.email_verified,false), lower(btrim(c.email))
    into v_contact_workspace, v_contact_account, v_email_verified, v_email
  from public.contacts c where c.id = p_contact_id;
  if v_contact_workspace is distinct from p_workspace_id or v_contact_account is distinct from p_account_id then
    raise exception 'recipient_scope_mismatch';
  end if;
  if not v_email_verified or nullif(v_email,'') is null then raise exception 'verified_business_email_required'; end if;

  if exists (
    select 1 from public.suppression_entries s
    where s.workspace_id = p_workspace_id
      and s.lifted_at is null
      and (
        (s.scope='account' and s.account_id=p_account_id) or
        (s.scope='contact' and s.contact_id=p_contact_id) or
        (s.scope='email' and s.normalized_value=v_email) or
        (s.scope='domain' and s.normalized_value=v_domain)
      )
  ) then raise exception 'suppressed_outreach'; end if;

  if nullif(btrim(coalesce(p_reason_to_contact,'')),'') is null then raise exception 'missing_reason_to_contact'; end if;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'empty_body'; end if;
  if jsonb_typeof(coalesce(p_evidence_snapshot,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_evidence_snapshot,'[]'::jsonb)) = 0 then raise exception 'evidence_required'; end if;
  if coalesce((p_recipient_snapshot->>'emailVerified')::boolean,false) is not true then raise exception 'recipient_snapshot_unverified'; end if;
  if lower(coalesce(p_recipient_snapshot->>'email','')) <> v_email then raise exception 'recipient_snapshot_email_mismatch'; end if;
  if coalesce((p_compliance_snapshot->>'humanApprovalRequired')::boolean,true) is not true then raise exception 'human_approval_required'; end if;
  if coalesce((p_compliance_snapshot->>'autonomousSendEnabled')::boolean,false) is not false then raise exception 'autonomous_send_must_be_disabled'; end if;
  if coalesce((p_compliance_snapshot->>'suppressed')::boolean,false) is true then raise exception 'compliance_snapshot_suppressed'; end if;

  select o.id, o.current_revision_id into v_outreach_id, v_revision_id
  from public.outreach o
  join public.outreach_revisions r on r.id = o.current_revision_id
  where o.workspace_id = p_workspace_id
    and o.offer_profile_id = p_offer_profile_id
    and o.account_id = p_account_id
    and o.contact_id = p_contact_id
    and o.status in ('ready','approved')
    and r.content_hash = p_content_hash
  order by o.created_at desc limit 1;

  if v_outreach_id is not null then
    return query select v_outreach_id, v_revision_id;
    return;
  end if;

  insert into public.outreach(
    workspace_id, offer_profile_id, account_id, contact_id, status, subject, body, motion, held_at
  ) values (
    p_workspace_id, p_offer_profile_id, p_account_id, p_contact_id, 'ready', p_subject, p_body, p_motion, now()
  ) returning id into v_outreach_id;

  insert into public.outreach_revisions(
    workspace_id, offer_profile_id, outreach_id, revision_number, subject, body, motion,
    reason_to_contact, evidence_snapshot, proof_snapshot, recipient_snapshot,
    compliance_snapshot, policy_receipt, content_hash, created_by
  ) values (
    p_workspace_id, p_offer_profile_id, v_outreach_id, 1, coalesce(p_subject,''), p_body, p_motion,
    p_reason_to_contact, coalesce(p_evidence_snapshot,'[]'::jsonb), coalesce(p_proof_snapshot,'[]'::jsonb),
    coalesce(p_recipient_snapshot,'{}'::jsonb), coalesce(p_compliance_snapshot,'{}'::jsonb),
    coalesce(p_policy_receipt,'{}'::jsonb), p_content_hash, null
  ) returning id into v_revision_id;

  update public.outreach set current_revision_id = v_revision_id where id = v_outreach_id;
  return query select v_outreach_id, v_revision_id;
end;
$$;

revoke all on function public.create_system_held_outreach_revision(uuid,uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.create_system_held_outreach_revision(uuid,uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to service_role;

commit;
