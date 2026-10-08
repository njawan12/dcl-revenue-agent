-- Privacy-by-design governance controls. These are product controls, not a claim
-- of legal compliance in any jurisdiction.
create type data_subject_kind as enum ('account','contact','signal','storefront_finding','source_audit','outreach');
create type deletion_request_status as enum ('requested','approved','processing','completed','rejected');

create table data_governance_policies (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  default_retention_days int not null default 365 check (default_retention_days between 30 and 3650),
  contact_retention_days int not null default 365 check (contact_retention_days between 30 and 3650),
  evidence_retention_days int not null default 730 check (evidence_retention_days between 30 and 3650),
  purpose text not null default 'B2B commerce revenue intelligence and operator-approved outreach',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table source_provenance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity_type data_subject_kind not null,
  entity_id uuid not null,
  provider text not null,
  source_url text,
  source_class text not null check (source_class in ('public_business','licensed_provider','merchant_authorized','first_party','manual')),
  collection_purpose text not null,
  terms_reference text,
  license_status text not null default 'unverified' check (license_status in ('verified','unverified','restricted','prohibited')),
  observed_at timestamptz,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null
);

create table data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  subject_kind data_subject_kind not null,
  subject_id uuid not null,
  reason text not null,
  status deletion_request_status not null default 'requested',
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  outcome jsonb not null default '{}'::jsonb
);

create index source_provenance_entity_idx on source_provenance(workspace_id, entity_type, entity_id, recorded_at desc);
create index source_provenance_license_idx on source_provenance(workspace_id, license_status, recorded_at desc);
create index deletion_requests_workspace_idx on data_deletion_requests(workspace_id, status, requested_at desc);

alter table data_governance_policies enable row level security;
alter table source_provenance enable row level security;
alter table data_deletion_requests enable row level security;

create policy governance_read_member on data_governance_policies for select using (is_workspace_member(workspace_id));
create policy governance_manage_admin on data_governance_policies for all using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));
create policy provenance_read_member on source_provenance for select using (is_workspace_member(workspace_id));
create policy provenance_write_operator on source_provenance for insert with check (can_operate_workspace(workspace_id));
create policy deletion_read_member on data_deletion_requests for select using (is_workspace_member(workspace_id));
create policy deletion_request_operator on data_deletion_requests for insert with check (can_operate_workspace(workspace_id));
create policy deletion_review_admin on data_deletion_requests for update using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));

-- Provenance is append-only to tenant users. Service-role maintenance may apply
-- verified retention/deletion procedures after an approved request.
create or replace function prevent_source_provenance_mutation()
returns trigger language plpgsql as $$ begin raise exception 'source_provenance_is_append_only'; end; $$;
create trigger source_provenance_no_update before update on source_provenance for each row execute function prevent_source_provenance_mutation();

comment on table data_governance_policies is 'Workspace retention and purpose controls; values require policy/legal validation before production enforcement.';
comment on table source_provenance is 'Inspectable source/provider provenance including licensing verification state. Unverified does not mean permitted.';
comment on table data_deletion_requests is 'Auditable deletion workflow. Request creation does not itself destroy records.';
