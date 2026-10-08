-- Durable internal work queue for discovery/enrichment. This is deliberately
-- provider-agnostic and cannot represent an external-send action.
create type durable_job_status as enum ('queued','running','retry_wait','succeeded','failed','cancelled');

create table durable_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  job_type text not null check (job_type in ('discovery','storefront_observation','buyer_research','contact_enrichment')),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status durable_job_status not null default 'queued',
  attempt_count int not null default 0 check (attempt_count >= 0),
  max_attempts int not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  result jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(workspace_id, job_type, idempotency_key),
  check ((status = 'running') = (lease_token is not null and lease_expires_at is not null)),
  check (job_type not like '%send%' and job_type not like '%outreach%')
);

create index durable_jobs_claim_idx on durable_jobs(status, available_at, lease_expires_at);
create index durable_jobs_workspace_idx on durable_jobs(workspace_id, created_at desc);

alter table durable_jobs enable row level security;
create policy "workspace members read durable jobs" on durable_jobs for select using (is_workspace_member(workspace_id));
create policy "workspace operators enqueue durable jobs" on durable_jobs for insert with check (can_operate_workspace(workspace_id));

-- Tenant users can enqueue and inspect. Claim/complete transitions are server-worker
-- functions only; ordinary tenant RLS intentionally exposes no update policy.
create or replace function claim_durable_job(p_worker uuid, p_lease_seconds int default 120)
returns setof durable_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then raise exception 'invalid_lease_seconds'; end if;

  select id into claimed_id from durable_jobs
  where attempt_count < max_attempts
    and available_at <= now()
    and (status in ('queued','retry_wait') or (status='running' and lease_expires_at < now()))
  order by available_at asc, created_at asc
  for update skip locked limit 1;

  if claimed_id is null then return; end if;

  return query update durable_jobs
  set status='running', attempt_count=attempt_count+1, lease_token=p_worker,
      lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
      started_at=coalesce(started_at,now()), updated_at=now()
  where id=claimed_id returning *;
end;
$$;

create or replace function complete_durable_job(p_job_id uuid, p_lease_token uuid, p_result jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  update durable_jobs set status='succeeded', result=coalesce(p_result,'{}'::jsonb),
    lease_token=null, lease_expires_at=null, finished_at=now(), updated_at=now()
  where id=p_job_id and status='running' and lease_token=p_lease_token and lease_expires_at >= now();
  if not found then raise exception 'job_lease_invalid_or_expired'; end if;
end;
$$;

create or replace function fail_durable_job(p_job_id uuid, p_lease_token uuid, p_error_code text, p_error_message text, p_retry_delay_seconds int default 60)
returns void language plpgsql security definer set search_path=public as $$
declare current_attempt int; allowed_attempts int;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select attempt_count,max_attempts into current_attempt,allowed_attempts from durable_jobs
    where id=p_job_id and status='running' and lease_token=p_lease_token and lease_expires_at >= now() for update;
  if not found then raise exception 'job_lease_invalid_or_expired'; end if;

  update durable_jobs set
    status=case when current_attempt >= allowed_attempts then 'failed'::durable_job_status else 'retry_wait'::durable_job_status end,
    available_at=case when current_attempt >= allowed_attempts then available_at else now()+make_interval(secs=>greatest(30,least(p_retry_delay_seconds,3600))) end,
    last_error_code=left(coalesce(p_error_code,'unknown'),120),
    last_error_message=left(coalesce(p_error_message,'Unknown worker failure'),2000),
    lease_token=null, lease_expires_at=null,
    finished_at=case when current_attempt >= allowed_attempts then now() else null end,
    updated_at=now()
  where id=p_job_id;
end;
$$;

comment on table durable_jobs is 'Workspace-scoped durable internal jobs with idempotency, bounded retries and expiring leases. External outreach/send is intentionally excluded.';
