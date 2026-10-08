-- Buyer/contact intelligence fields. Existing contacts remain valid.

alter table contacts add column if not exists provider text;
alter table contacts add column if not exists provider_person_id text;
alter table contacts add column if not exists full_name text;
alter table contacts add column if not exists seniority text;
alter table contacts add column if not exists departments text[] not null default '{}';
alter table contacts add column if not exists linkedin_url text;
alter table contacts add column if not exists buyer_score int check (buyer_score between 0 and 100);
alter table contacts add column if not exists buyer_reason text;
alter table contacts add column if not exists verification_status text;
alter table contacts add column if not exists verification_source text;
alter table contacts add column if not exists email_provider text;
alter table contacts add column if not exists last_verified_at timestamptz;
alter table contacts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table contacts add column if not exists updated_at timestamptz not null default now();

create unique index if not exists contacts_workspace_account_provider_person_key
  on contacts(workspace_id, account_id, provider, provider_person_id);

create index if not exists contacts_workspace_account_buyer_idx
  on contacts(workspace_id, account_id, is_primary_buyer desc, buyer_score desc);

create index if not exists contacts_verified_email_idx
  on contacts(workspace_id, account_id, email_verified, buyer_score desc)
  where email is not null;
