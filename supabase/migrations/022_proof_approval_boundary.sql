-- Approved proof is a privileged publishing boundary.
-- Members may create and refine unapproved proof drafts, but only Owner/Admin
-- may approve a claim or mutate a claim that is already approved.

begin;

create or replace function public.guard_proof_approval_boundary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role/backend maintenance is allowed; authenticated users remain
  -- constrained by the role contract below.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.approved, false) and not public.can_manage_workspace(new.workspace_id) then
      raise exception 'Only workspace Owner/Admin may approve proof claims';
    end if;
    return new;
  end if;

  -- Moving an approved claim across workspaces is never an operator edit.
  if old.workspace_id is distinct from new.workspace_id then
    raise exception 'Proof claims cannot be moved between workspaces';
  end if;

  -- Approval, revocation, or any mutation of already-approved proof requires
  -- Owner/Admin. This prevents an operator from editing trusted copy in place.
  if old.approved
     or new.approved
     or old.approved is distinct from new.approved then
    if not public.can_manage_workspace(old.workspace_id) then
      raise exception 'Only workspace Owner/Admin may approve or modify approved proof claims';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_proof_approval_boundary() from public;
revoke all on function public.guard_proof_approval_boundary() from anon;
revoke all on function public.guard_proof_approval_boundary() from authenticated;
grant execute on function public.guard_proof_approval_boundary() to service_role;

drop trigger if exists proof_points_approval_boundary on public.proof_points;
create trigger proof_points_approval_boundary
before insert or update on public.proof_points
for each row execute function public.guard_proof_approval_boundary();

commit;
