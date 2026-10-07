create extension if not exists pgcrypto;

create type opportunity_tier as enum ('reject','nurture','review','qualified','priority');
create type outreach_status as enum ('not_ready','ready','approved','sent','replied','paused','suppressed');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  domain text unique not null,
  name text not null,
  country text,
  industry text,
  employee_count int,
  shopify boolean default false,
  shopify_plus boolean default false,
  dtc boolean default false,
  fit_score int check (fit_score between 0 and 100),
  need_score int check (need_score between 0 and 100),
  intent_score int check (intent_score between 0 and 100),
  opportunity_score int check (opportunity_score between 0 and 100),
  tier opportunity_tier default 'review',
  commercial_thesis text,
  recommended_motion text,
  suppressed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  signal_type text not null,
  title text not null,
  source_url text not null,
  source_name text,
  observed_at timestamptz not null,
  confidence numeric(4,3) check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  fingerprint text unique,
  created_at timestamptz default now()
);

create table storefront_findings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  category text not null,
  severity numeric(4,3) check (severity between 0 and 1),
  title text not null,
  explanation text not null,
  evidence_url text,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  first_name text,
  last_name text,
  title text,
  email text,
  email_source text,
  email_verified boolean default false,
  email_confidence numeric(4,3),
  source_url text,
  is_primary_buyer boolean default false,
  created_at timestamptz default now()
);

create table proof_points (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  service_tags text[] not null default '{}',
  approved_claim text not null,
  evidence_reference text,
  approved boolean default false,
  created_at timestamptz default now()
);

create table outreach (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  status outreach_status default 'not_ready',
  subject text,
  body text,
  motion text,
  proof_point_id uuid references proof_points(id),
  approved_by text,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz default now()
);

create table source_audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  source_url text not null,
  captured_at timestamptz default now(),
  excerpt text,
  confidence numeric(4,3)
);

create index accounts_priority_idx on accounts(opportunity_score desc) where suppressed = false;
create index signals_account_idx on signals(account_id, observed_at desc);
create index contacts_account_idx on contacts(account_id, is_primary_buyer desc);
