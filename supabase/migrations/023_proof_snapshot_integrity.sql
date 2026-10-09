-- Approved proof is trusted only when the exact claim is bound to the immutable outreach revision.
-- Never trust caller-supplied proof_snapshot content by itself.
-- This migration does not send, schedule, or enqueue outbound communication.

begin;

create or replace function public.validate_approved_proof_snapshot(
  p_workspace_id uuid,
  p_proof_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_proof_id uuid;
  v_claim text;
begin
  if jsonb_typeof(coalesce(p_proof_snapshot, '[]'::jsonb)) <> 'array' then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_proof_snapshot, '[]'::jsonb)) loop
    begin
      v_proof_id := nullif(v_item->>'proofPointId', '')::uuid;
    exception when invalid_text_representation then
      return false;
    end;

    v_claim := nullif(btrim(v_item->>'approvedClaim'), '');
    if v_proof_id is null or v_claim is null then
      return false;
    end if;

    if not exists (
      select 1
      from public.proof_points p
      where p.id = v_proof_id
        and p.workspace_id = p_workspace_id
        and p.approved is true
        and p.approved_claim = v_claim
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.validate_approved_proof_snapshot(uuid, jsonb) from public;
revoke all on function public.validate_approved_proof_snapshot(uuid, jsonb) from anon;
revoke all on function public.validate_approved_proof_snapshot(uuid, jsonb) from authenticated;
grant execute on function public.validate_approved_proof_snapshot(uuid, jsonb) to service_role;

create or replace function public.guard_outreach_revision_proof_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_approved_proof_snapshot(new.workspace_id, new.proof_snapshot) then
    raise exception 'proof_snapshot_must_reference_exact_approved_workspace_claims';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_outreach_revision_proof_snapshot() from public;
revoke all on function public.guard_outreach_revision_proof_snapshot() from anon;
revoke all on function public.guard_outreach_revision_proof_snapshot() from authenticated;
grant execute on function public.guard_outreach_revision_proof_snapshot() to service_role;

drop trigger if exists outreach_revision_proof_snapshot_integrity on public.outreach_revisions;
create trigger outreach_revision_proof_snapshot_integrity
before insert or update of proof_snapshot, workspace_id on public.outreach_revisions
for each row execute function public.guard_outreach_revision_proof_snapshot();

comment on function public.validate_approved_proof_snapshot(uuid, jsonb) is
  'Validates that every proof snapshot item binds an exact approved claim from the same workspace. Empty proof arrays are valid; fabricated or stale proof is not.';

commit;
