-- Outreach state without enabling autonomous sending.

create table if not exists outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','approved','active','paused','stopped','completed')),
  motion text,
  stop_reason text,
  next_step_index int not null default 0,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_sequences_one_open_per_contact
  on outreach_sequences(workspace_id, account_id, contact_id)
  where status in ('draft','awaiting_approval','approved','active','paused');

alter table outreach add column if not exists sequence_id uuid references outreach_sequences(id) on delete cascade;
alter table outreach add column if not exists step_index int not null default 0;
alter table outreach add column if not exists message_type text not null default 'first_touch' check (message_type in ('first_touch','follow_up','reply'));
alter table outreach add column if not exists scheduled_for timestamptz;
alter table outreach add column if not exists evidence_refs jsonb not null default '[]'::jsonb;
alter table outreach add column if not exists proof_point_ids uuid[] not null default '{}';
alter table outreach add column if not exists model_provider text;
alter table outreach add column if not exists model_name text;
alter table outreach add column if not exists model_response_id text;
alter table outreach add column if not exists generation_metadata jsonb not null default '{}'::jsonb;
alter table outreach add column if not exists updated_at timestamptz not null default now();

create table if not exists suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  email text,
  reason text not null check (reason in ('unsubscribe','hard_bounce','spam_complaint','do_not_contact','claimed_email','manual','other')),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists suppressions_workspace_email_key
  on suppressions(workspace_id, lower(email)) where email is not null;

create index if not exists outreach_sequences_workspace_idx on outreach_sequences(workspace_id, status, next_action_at);
create index if not exists outreach_sequence_steps_idx on outreach(sequence_id, step_index);

alter table outreach_sequences enable row level security;
alter table suppressions enable row level security;

create policy outreach_sequences_member_read on outreach_sequences
  for select using (is_workspace_member(workspace_id));
create policy outreach_sequences_manage_write on outreach_sequences
  for all using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));

create policy suppressions_member_read on suppressions
  for select using (is_workspace_member(workspace_id));
create policy suppressions_manage_write on suppressions
  for all using (can_manage_workspace(workspace_id)) with check (can_manage_workspace(workspace_id));
