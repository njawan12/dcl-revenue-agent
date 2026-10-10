-- Product data-purpose default for the DCL workspace. This is an operational
-- governance setting, not a legal-compliance determination. Retention and
-- jurisdiction policy still require owner/legal validation before sending.

begin;

insert into public.data_governance_policies(
  workspace_id, default_retention_days, contact_retention_days,
  evidence_retention_days, purpose, updated_by, updated_at
)
values(
  '11111111-1111-4111-8111-111111111111'::uuid,
  365, 365, 730,
  'Research recent public business hiring signals, prioritize potential B2B service opportunities, and prepare evidence-backed outreach drafts for human review.',
  null, now()
)
on conflict (workspace_id) do update set
  purpose=excluded.purpose,
  updated_at=now();

commit;
