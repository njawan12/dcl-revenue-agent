-- Versioned scoring history: preserve why an opportunity score changed without
-- turning model output into an untraceable mutable field.
create table if not exists scoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  scoring_contract_version text not null,
  fit_score int not null check (fit_score between 0 and 100),
  need_score int not null check (need_score between 0 and 100),
  intent_score int not null check (intent_score between 0 and 100),
  opportunity_score int not null check (opportunity_score between 0 and 100),
  tier opportunity_tier not null,
  evidence_confidence numeric(4,3) not null check (evidence_confidence between 0 and 1),
  inputs jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  config_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists scoring_snapshots_account_idx
  on scoring_snapshots(workspace_id, account_id, created_at desc);

alter table scoring_snapshots enable row level security;

create policy "workspace members read scoring history"
on scoring_snapshots for select
using (is_workspace_member(workspace_id));

-- Snapshots are append-only from tenant-facing access. Explicit retention/privacy
-- workflows may delete through a privileged reviewed path; ordinary workspace
-- policies intentionally expose no update/delete capability.
create policy "workspace operators append scoring history"
on scoring_snapshots for insert
with check (can_operate_workspace(workspace_id));

create or replace function prevent_scoring_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'scoring snapshots are immutable';
end;
$$;

drop trigger if exists scoring_snapshots_immutable on scoring_snapshots;
create trigger scoring_snapshots_immutable
before update on scoring_snapshots
for each row execute function prevent_scoring_snapshot_mutation();

comment on table scoring_snapshots is
'Append-only, workspace-scoped score history. Stores deterministic score inputs, evidence references, configuration and explanation so score changes remain inspectable.';
