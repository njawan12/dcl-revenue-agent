-- Every persisted signal receives an inspectable source-provenance receipt.
-- Crustdata is treated as a licensed provider only after the worker has verified
-- endpoint access. Public/free sources remain unverified until their usage terms
-- are explicitly reviewed; this is intentionally conservative.

begin;

create or replace function public.record_signal_provenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class text;
  v_license text;
  v_terms text;
  v_purpose text;
begin
  if new.source_name = 'crustdata-job-search' then
    v_class := 'licensed_provider';
    v_license := 'verified';
    v_terms := 'Crustdata API account/endpoint access verified at run time; provider terms govern permitted use.';
  elsif new.source_name like 'greenhouse:%' then
    v_class := 'public_business';
    v_license := 'unverified';
    v_terms := 'Greenhouse public job-board API; terms/policy review pending.';
  elsif new.source_name like 'lever:%' then
    v_class := 'public_business';
    v_license := 'unverified';
    v_terms := 'Lever public postings API; terms/policy review pending.';
  elsif new.source_name like 'storefront%' then
    v_class := 'public_business';
    v_license := 'unverified';
    v_terms := 'Public company storefront observation; usage-policy review pending.';
  else
    v_class := 'public_business';
    v_license := 'unverified';
    v_terms := 'Source terms not yet classified.';
  end if;

  select purpose into v_purpose from public.data_governance_policies where workspace_id=new.workspace_id;
  v_purpose := coalesce(nullif(btrim(v_purpose),''), 'B2B business research and human-reviewed outreach preparation');

  if not exists (
    select 1 from public.source_provenance p
    where p.workspace_id=new.workspace_id
      and p.entity_type='signal'
      and p.entity_id=new.id
      and p.provider=coalesce(new.source_name,'unknown')
      and coalesce(p.source_url,'')=coalesce(new.source_url,'')
  ) then
    insert into public.source_provenance(
      workspace_id, entity_type, entity_id, provider, source_url,
      source_class, collection_purpose, terms_reference, license_status,
      observed_at, recorded_by
    ) values (
      new.workspace_id, 'signal', new.id, coalesce(new.source_name,'unknown'), new.source_url,
      v_class, v_purpose, v_terms, v_license,
      new.observed_at, null
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_signal_provenance() from public, anon, authenticated;
grant execute on function public.record_signal_provenance() to service_role;

drop trigger if exists signal_provenance_receipt on public.signals;
create trigger signal_provenance_receipt
after insert on public.signals
for each row execute function public.record_signal_provenance();

commit;
