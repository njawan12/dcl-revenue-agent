-- Harden held-outbox approval semantics at the database boundary.
-- Approval is valid only for the exact current revision. Creating a new revision
-- invalidates the legacy convenience approval pointer/status. Sending remains disabled.

create or replace function enforce_outreach_revision_workspace()
returns trigger
language plpgsql
as $$
declare
  revision_workspace uuid;
  revision_outreach uuid;
begin
  if new.current_revision_id is not null then
    select workspace_id, outreach_id into revision_workspace, revision_outreach
    from outreach_revisions where id = new.current_revision_id;
    if revision_workspace is distinct from new.workspace_id or revision_outreach is distinct from new.id then
      raise exception 'current revision does not belong to outreach/workspace';
    end if;
  end if;
  if new.approved_revision_id is not null then
    select workspace_id, outreach_id into revision_workspace, revision_outreach
    from outreach_revisions where id = new.approved_revision_id;
    if revision_workspace is distinct from new.workspace_id or revision_outreach is distinct from new.id then
      raise exception 'approved revision does not belong to outreach/workspace';
    end if;
    if new.current_revision_id is distinct from new.approved_revision_id then
      raise exception 'cannot approve a stale outreach revision';
    end if;
  end if;
  return new;
end;
$$;

create or replace function enforce_outreach_approval_binding()
returns trigger
language plpgsql
as $$
declare
  revision_workspace uuid;
  revision_outreach uuid;
  current_revision uuid;
begin
  select workspace_id, outreach_id into revision_workspace, revision_outreach
  from outreach_revisions where id = new.revision_id;
  if revision_workspace is distinct from new.workspace_id or revision_outreach is distinct from new.outreach_id then
    raise exception 'approval revision does not belong to outreach/workspace';
  end if;
  select current_revision_id into current_revision
  from outreach where id = new.outreach_id and workspace_id = new.workspace_id;
  if current_revision is null or current_revision is distinct from new.revision_id then
    raise exception 'approval requires the current outreach revision';
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_approval_binding_guard on outreach_approvals;
create trigger outreach_approval_binding_guard
before insert or update of workspace_id, outreach_id, revision_id on outreach_approvals
for each row execute function enforce_outreach_approval_binding();

create or replace function invalidate_outreach_approval_on_revision_change()
returns trigger
language plpgsql
as $$
begin
  if old.current_revision_id is distinct from new.current_revision_id then
    new.approved_revision_id := null;
    new.approved_by := null;
    new.approved_at := null;
    if new.status = 'approved' then new.status := 'ready'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_revision_invalidate_approval on outreach;
create trigger outreach_revision_invalidate_approval
before update of current_revision_id on outreach
for each row execute function invalidate_outreach_approval_on_revision_change();

-- Revisions are immutable evidence receipts. They may be inserted/read, never edited in place.
drop policy if exists outreach_revisions_tenant_update on outreach_revisions;
drop policy if exists outreach_revisions_tenant_delete on outreach_revisions;
