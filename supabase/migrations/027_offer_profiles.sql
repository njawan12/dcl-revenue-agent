-- Industry-agnostic offer profiles. A workspace can add additional offers without code changes.
-- Profiles define hiring triggers, fit guardrails, buyer priorities, messaging, and usage caps.

begin;

create table if not exists public.offer_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_key text not null,
  name text not null,
  active boolean not null default true,
  priority integer not null default 100,
  lookback_days integer not null default 14 check (lookback_days between 1 and 90),
  target_job_titles text[] not null default '{}',
  target_countries text[] not null default '{}',
  country_aliases jsonb not null default '{}'::jsonb,
  employee_min integer,
  employee_max integer,
  excluded_industries text[] not null default '{}',
  buyer_roles text[] not null default '{}',
  offer jsonb not null default '{}'::jsonb,
  email_config jsonb not null default '{}'::jsonb,
  caps jsonb not null default '{}'::jsonb,
  scoring_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_key),
  check (employee_min is null or employee_min >= 1),
  check (employee_max is null or employee_max >= 1),
  check (employee_min is null or employee_max is null or employee_min <= employee_max)
);

alter table public.offer_profiles enable row level security;

drop policy if exists offer_profiles_select_member on public.offer_profiles;
create policy offer_profiles_select_member on public.offer_profiles
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists offer_profiles_manage_admin on public.offer_profiles;
create policy offer_profiles_manage_admin on public.offer_profiles
  for all to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

alter table public.discovery_runs add column if not exists offer_profile_id uuid references public.offer_profiles(id) on delete set null;
alter table public.signals add column if not exists offer_profile_id uuid references public.offer_profiles(id) on delete set null;
alter table public.scoring_snapshots add column if not exists offer_profile_id uuid references public.offer_profiles(id) on delete set null;
alter table public.outreach add column if not exists offer_profile_id uuid references public.offer_profiles(id) on delete set null;
alter table public.outreach_revisions add column if not exists offer_profile_id uuid references public.offer_profiles(id) on delete set null;
alter table public.provider_usage add column if not exists offer_profile_id uuid references public.offer_profiles(id) on delete set null;

create table if not exists public.profile_account_matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  offer_profile_id uuid not null references public.offer_profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  primary_job_signal_id uuid references public.signals(id) on delete set null,
  fit_score integer,
  need_score integer,
  intent_score integer,
  opportunity_score integer,
  tier text not null default 'review',
  evidence_confidence numeric(4,3) check (evidence_confidence between 0 and 1),
  suggested_buyer_role text,
  recommended_motion text,
  qualification_reason text,
  scoring_receipt jsonb not null default '{}'::jsonb,
  latest_trigger_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_profile_id, account_id),
  check (fit_score is null or fit_score between 0 and 100),
  check (need_score is null or need_score between 0 and 100),
  check (intent_score is null or intent_score between 0 and 100),
  check (opportunity_score is null or opportunity_score between 0 and 100)
);

alter table public.profile_account_matches enable row level security;

drop policy if exists profile_matches_select_member on public.profile_account_matches;
create policy profile_matches_select_member on public.profile_account_matches
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists profile_matches_insert_operator on public.profile_account_matches;
create policy profile_matches_insert_operator on public.profile_account_matches
  for insert to authenticated
  with check (public.can_operate_workspace(workspace_id));

drop policy if exists profile_matches_update_operator on public.profile_account_matches;
create policy profile_matches_update_operator on public.profile_account_matches
  for update to authenticated
  using (public.can_operate_workspace(workspace_id))
  with check (public.can_operate_workspace(workspace_id));

drop policy if exists profile_matches_delete_admin on public.profile_account_matches;
create policy profile_matches_delete_admin on public.profile_account_matches
  for delete to authenticated
  using (public.can_manage_workspace(workspace_id));

create index if not exists offer_profiles_workspace_active_idx
  on public.offer_profiles(workspace_id, active, priority, created_at);
create index if not exists profile_matches_workspace_score_idx
  on public.profile_account_matches(workspace_id, offer_profile_id, opportunity_score desc nulls last, updated_at desc);
create index if not exists discovery_runs_profile_idx
  on public.discovery_runs(workspace_id, offer_profile_id, started_at desc);
create index if not exists signals_profile_idx
  on public.signals(workspace_id, offer_profile_id, observed_at desc);

-- DCL profile #1: hiring is the primary trigger. Storefront/technology signals are secondary evidence only.
insert into public.offer_profiles (
  workspace_id, profile_key, name, active, priority, lookback_days,
  target_job_titles, target_countries, country_aliases,
  employee_min, employee_max, excluded_industries, buyer_roles,
  offer, email_config, caps, scoring_config
)
select
  w.id,
  'dcl-shopify-ecommerce-hiring',
  'DCL · Shopify & Ecommerce Hiring',
  true,
  10,
  14,
  array[
    'Shopify Developer','Shopify Engineer','Shopify Plus Developer','Liquid Developer',
    'Ecommerce Developer','E-commerce Developer','Shopify Web Developer',
    'Frontend Shopify Developer','Front End Shopify Developer','Ecommerce Engineer'
  ]::text[],
  array['United States','Canada']::text[],
  '{"United States":["USA","United States","United States of America","US","U.S."],"Canada":["Canada","CA"]}'::jsonb,
  20,
  5000,
  array['staffing','recruiting','recruiter','agency','agencies']::text[],
  array['VP/Head of Ecommerce','Director of Ecommerce','Director of Digital','VP/Head of Digital','CTO / VP Engineering','Head of Retention / Lifecycle']::text[],
  jsonb_build_object(
    'name','Digital Commerce Lab ecommerce execution alternative',
    'summary','Offer DCL as a flexible ecommerce development and growth partner when a brand is hiring for Shopify or ecommerce engineering capacity.',
    'services',jsonb_build_array('Shopify development','CRO and experimentation','UI/UX','CRM and retention','Analytics and QA'),
    'positioning','Instead of waiting to fill a full-time ecommerce development role, DCL can operate as an experienced extension of the ecommerce team.',
    'cta','Offer to share the specific storefront and hiring observations behind the outreach.'
  ),
  jsonb_build_object(
    'tone','human, concise, specific, commercially credible, no hype',
    'maxWords',130,
    'subjectStyle','plain and relevant; no clickbait',
    'template','Hi {{first_name}},\n\nI noticed {{company}} is hiring for {{job_title}}. {{evidence_sentence}}\n\nDCL works as an extension of ecommerce teams across Shopify development and CRO, so there may be a faster option than waiting for another full-time hire.\n\nHappy to send over the specific things we noticed if useful.\n\nNouman',
    'rules',jsonb_build_array('Never invent a company fact','Never invent a result or case-study claim','Reference the observed job as the primary reason to contact','Use storefront evidence only when actually observed','Do not claim legal compliance')
  ),
  jsonb_build_object(
    'jobsPerRun',25,
    'contactsPerRun',25,
    'leadsPerDay',25,
    'leadsPerWeek',100,
    'creditsPerRun',60,
    'creditsPerDay',60,
    'creditsPerWeek',250
  ),
  jsonb_build_object(
    'requireHiringTrigger',true,
    'maxJobAgeDays',14,
    'hiringPrimary',true,
    'storefrontSecondary',true
  )
from public.workspaces w
where w.id = '11111111-1111-4111-8111-111111111111'::uuid
on conflict (workspace_id, profile_key) do update set
  name = excluded.name,
  active = excluded.active,
  priority = excluded.priority,
  lookback_days = excluded.lookback_days,
  target_job_titles = excluded.target_job_titles,
  target_countries = excluded.target_countries,
  country_aliases = excluded.country_aliases,
  employee_min = excluded.employee_min,
  employee_max = excluded.employee_max,
  excluded_industries = excluded.excluded_industries,
  buyer_roles = excluded.buyer_roles,
  offer = excluded.offer,
  email_config = excluded.email_config,
  caps = excluded.caps,
  scoring_config = excluded.scoring_config,
  updated_at = now();

commit;
