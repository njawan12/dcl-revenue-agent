-- Keep the human suppression helper unchanged, while allowing the service-only
-- held-draft path to bind a policy receipt. Also normalize common country names
-- so provider data such as "United States" maps to the configured US policy key.

begin;

create or replace function public.bind_revision_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_account accounts%rowtype; v_contact contacts%rowtype; v_region text;
  v_basis jsonb; v_purpose text; v_source_ready boolean; v_suppressed boolean;
  v_domain text; v_email text; v_reasons text[] := '{}';
begin
  select a.* into v_account from outreach o join accounts a on a.id=o.account_id and a.workspace_id=o.workspace_id
  where o.id=new.outreach_id and o.workspace_id=new.workspace_id;
  select c.* into v_contact from outreach o join contacts c on c.id=o.contact_id and c.account_id=o.account_id and c.workspace_id=o.workspace_id
  where o.id=new.outreach_id and o.workspace_id=new.workspace_id;
  if v_account.id is null or v_contact.id is null then raise exception 'revision account/recipient scope mismatch'; end if;

  v_region:=upper(btrim(coalesce(v_account.country,'')));
  if v_region in ('UNITED STATES','UNITED STATES OF AMERICA','USA','U.S.','U.S.A.') then v_region:='US';
  elsif v_region='CANADA' then v_region:='CA';
  elsif v_region in ('UK','UNITED KINGDOM','GREAT BRITAIN') then v_region:='GB';
  end if;

  select outreach_rules->'regionPolicyBasis'->v_region into v_basis from workspace_sales_config where workspace_id=new.workspace_id;
  select purpose into v_purpose from data_governance_policies where workspace_id=new.workspace_id;

  if auth.role()='service_role' then
    v_domain:=lower(btrim(coalesce(v_account.domain,'')));
    v_email:=lower(btrim(coalesce(v_contact.email,'')));
    v_suppressed:=coalesce(v_account.suppressed,false) or exists(
      select 1 from suppression_entries s where s.workspace_id=new.workspace_id and s.lifted_at is null and (
        (s.scope='account' and s.account_id=v_account.id) or
        (s.scope='contact' and s.contact_id=v_contact.id) or
        (s.scope='email' and v_email<>'' and s.normalized_value=v_email) or
        (s.scope='domain' and v_domain<>'' and s.normalized_value=v_domain)
      )
    );
  else
    v_suppressed:=is_outreach_suppressed(new.workspace_id,v_account.id,v_contact.id);
  end if;

  -- Evidence can bind by immutable signal id (preferred) or exact source URL.
  -- Every evidence item in a reviewable revision must resolve to a source whose
  -- provider/license status has been explicitly verified for the workspace.
  v_source_ready:=jsonb_typeof(new.evidence_snapshot)='array' and jsonb_array_length(new.evidence_snapshot)>0
    and not exists(
      select 1 from jsonb_array_elements(new.evidence_snapshot) e where not exists(
        select 1 from signals s join source_provenance p on p.entity_id=s.id and p.workspace_id=s.workspace_id and p.entity_type='signal'
        where s.workspace_id=new.workspace_id and s.account_id=v_account.id
          and ((nullif(e->>'id','') is not null and s.id::text=e->>'id')
            or (nullif(e->>'sourceUrl','') is not null and s.source_url=e->>'sourceUrl'))
          and p.license_status='verified' and nullif(btrim(p.collection_purpose),'') is not null
      )
    );

  if v_suppressed then v_reasons:=array_append(v_reasons,'suppressed'); end if;
  if not coalesce(v_contact.email_verified,false) or nullif(btrim(v_contact.email),'') is null then v_reasons:=array_append(v_reasons,'professional_email_unverified'); end if;
  if v_region='' then v_reasons:=array_append(v_reasons,'jurisdiction_unknown');
  elsif v_region not in ('US','CA','GB','EU') then v_reasons:=array_append(v_reasons,'jurisdiction_policy_unconfigured'); end if;
  if coalesce(v_basis->>'status','unknown')<>'verified' or nullif(btrim(v_basis->>'reference'),'') is null then v_reasons:=array_append(v_reasons,'policy_basis_unverified'); end if;
  if nullif(btrim(v_purpose),'') is null then v_reasons:=array_append(v_reasons,'purpose_missing'); end if;
  if not coalesce(v_source_ready,false) then v_reasons:=array_append(v_reasons,'source_provenance_unverified'); end if;

  new.policy_receipt:=jsonb_build_object(
    'contractVersion','outreach-policy-v1',
    'decision',case when cardinality(v_reasons)=0 then 'eligible_for_human_review' else 'blocked' end,
    'region',nullif(v_region,''),
    'reasons',to_jsonb(v_reasons),
    'evaluatedInputs',jsonb_build_object(
      'suppressed',v_suppressed,
      'professionalEmailVerified',coalesce(v_contact.email_verified,false),
      'policyBasisStatus',coalesce(v_basis->>'status','unknown'),
      'purposePresent',nullif(btrim(v_purpose),'') is not null,
      'sourceProvenanceReady',coalesce(v_source_ready,false)
    )
  );
  return new;
end;
$$;

commit;
