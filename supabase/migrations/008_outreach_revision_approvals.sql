-- Revision-bound held outbox. Approval applies to exact immutable draft content.
-- Sending remains a separate explicit operation and is not implemented by this migration.

create table outreach_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  outreach_id uuid not null references outreach(id) on delete cascade,
  revision_number int not null check (revision_number > 0),
  subject text not null default '',
  body text not null,
  motion text,
  reason_to_contact text not null,
  evidence_snapshot jsonb not null default '[]'::jsonb,
  proof_snapshot jsonb not null default '[]'::jsonb,
  recipient_snapshot jsonb not null default '{}'::jsonb,
  compliance_snapshot jsonb not null default '{}'::jsonb,
  content_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (outreach_id, revision_number),
  unique (outreach_id, content_hash)
);

create table outreach_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  outreach_id uuid not null references outreach(id) on delete cascade,
  revision_id uuid not null references outreach_revisions(id) on delete cascade,
  decision text not null check (decision in ('approved','rejected')),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decision_note text,
  decided_at timestamptz not null default now()
);

alter table outreach add column current_revision_id uuid references outreach_revisions(id) on delete set null;
alter table outreach add column approved_revision_id uuid references outreach_revisions(id) on delete set null;
alter table outreach add column held_at timestamptz;

create index outreach_revisions_workspace_outreach_idx on outreach_revisions(workspace_id, outreach_id, revision_number desc);
create index outreach_approvals_workspace_outreach_idx on outreach_approvals(workspace_id, outreach_id, decided_at desc);

alter table outreach_revisions enable row level security;
alter table outreach_approvals enable row level security;

create policy outreach_revisions_tenant_select on outreach_revisions for select using (is_workspace_member(workspace_id));
create policy outreach_revisions_tenant_insert on outreach_revisions for insert with check (can_manage_workspace(workspace_id));
create policy outreach_revisions_tenant_update on outreach_revisions for update using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));
create policy outreach_revisions_tenant_delete on outreach_revisions for delete using (can_manage_workspace(workspace_id));

create policy outreach_approvals_tenant_select on outreach_approvals for select using (is_workspace_member(workspace_id));
create policy outreach_approvals_tenant_insert on outreach_approvals for insert with check (can_manage_workspace(workspace_id));
create policy outreach_approvals_tenant_update on outreach_approvals for update using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));
create policy outreach_approvals_tenant_delete on outreach_approvals for delete using (can_manage_workspace(workspace_id));

-- Prevent a cross-workspace revision from being attached to an outreach row.
create or replace function enforce_outreach_revision_workspace()
returns trigger
language plpgsql
as $$
declare
  revision_workspace uuid;
begin
  if new.current_revision_id is not null then
    select workspace_id into revision_workspace from outreach_revisions where id = new.current_revision_id;
    if revision_workspace is distinct from new.workspace_id then
      raise exception 'current revision workspace mismatch';
    end if;
  end if;
  if new.approved_revision_id is not null then
    select workspace_id into revision_workspace from outreach_revisions where id = new.approved_revision_id;
    if revision_workspace is distinct from new.workspace_id then
      raise exception 'approved revision workspace mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger outreach_revision_workspace_guard
before insert or update of workspace_id, current_revision_id, approved_revision_id on outreach
for each row execute function enforce_outreach_revision_workspace();
