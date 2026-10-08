-- Bootstrap the internal DCL workspace so existing data is never orphaned.
-- User membership is added later through authenticated onboarding/admin tooling.

insert into workspaces (id, name, slug, plan_key, branding, settings)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Digital Commerce Lab',
  'dcl',
  'internal',
  '{"productName":"DCL Revenue Agent"}'::jsonb,
  '{"mode":"internal","humanApprovalRequired":true}'::jsonb
)
on conflict (slug) do nothing;

insert into workspace_sales_config (
  workspace_id,
  services,
  target_countries,
  target_industries,
  fit_weights,
  need_weights,
  intent_weights,
  exclusion_rules,
  buyer_role_rules,
  sales_motion_rules,
  outreach_rules
)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '["shopify-development","shopify-plus","cro","ux-ui","analytics","klaviyo-retention","subscriptions","b2b","qa","performance","dedicated-capacity"]'::jsonb,
  array['US','CA'],
  array['beauty','wellness','supplements','apparel','food-beverage','fitness','pet','home'],
  '{"shopify":25,"shopifyPlus":10,"targetCountry":10,"dtc":15,"employeeBand":15,"targetIndustry":15,"agencyCapacity":10}'::jsonb,
  '{"cro":18,"performance":14,"mobileUx":14,"pdp":14,"subscription":12,"analytics":12,"retention":10,"qa":6}'::jsonb,
  '{"recentJob":28,"newEcommerceLeader":20,"replatform":20,"fundingOrAcquisition":12,"multipleEcommerceHires":10,"majorLaunch":10}'::jsonb,
  '["agency","freelancer","tiny-hobby-store","obvious-dropshipper"]'::jsonb,
  '{"default":["VP Ecommerce","Head of Ecommerce","Director Ecommerce","Head of Digital","VP Digital","Founder"]}'::jsonb,
  '{"hiring_long_open":"bridge-while-hiring","hiring":"extend-internal-team","new_leader_plus_need":"growth-partner","strong_storefront_need":"specialist-gap","default":"research-first"}'::jsonb,
  '{"requireReasonToContact":true,"requireVerifiedEmail":true,"requireHumanApproval":true}'::jsonb
)
on conflict (workspace_id) do nothing;

update accounts set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update signals set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update storefront_findings set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update contacts set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update proof_points set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update outreach set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update source_audit set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update discovery_runs set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;
update discovery_observations set workspace_id = '11111111-1111-4111-8111-111111111111'::uuid where workspace_id is null;

alter table accounts alter column workspace_id set not null;
alter table signals alter column workspace_id set not null;
alter table storefront_findings alter column workspace_id set not null;
alter table contacts alter column workspace_id set not null;
alter table proof_points alter column workspace_id set not null;
alter table outreach alter column workspace_id set not null;
alter table source_audit alter column workspace_id set not null;
alter table discovery_runs alter column workspace_id set not null;
alter table discovery_observations alter column workspace_id set not null;
