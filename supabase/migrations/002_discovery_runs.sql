create type discovery_run_status as enum ('running','completed','partial','failed');

create table discovery_runs (
  id uuid primary key default gen_random_uuid(),
  status discovery_run_status not null default 'running',
  source_names text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  accounts_discovered int not null default 0,
  signals_discovered int not null default 0,
  error_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table discovery_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references discovery_runs(id) on delete cascade,
  account_domain text not null,
  source_name text not null,
  source_url text,
  observation_type text not null,
  verified boolean not null default false,
  confidence numeric(4,3) check (confidence between 0 and 1),
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

alter table accounts add column if not exists shopify_confidence numeric(4,3) check (shopify_confidence between 0 and 1);
alter table accounts add column if not exists shopify_verified_at timestamptz;
alter table accounts add column if not exists website_url text;
alter table accounts add column if not exists technology_tags text[] not null default '{}';
alter table accounts add column if not exists last_discovered_at timestamptz;

create index discovery_runs_started_idx on discovery_runs(started_at desc);
create index discovery_observations_run_idx on discovery_observations(run_id, observed_at desc);
create index discovery_observations_domain_idx on discovery_observations(account_domain, observed_at desc);
