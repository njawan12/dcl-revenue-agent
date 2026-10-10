-- Tighten DCL defaults without changing the generic offer-profile contract.
-- Avoid the ambiguous country alias "CA" (which can mean California) and keep
-- the configured primary-market values explicit.

begin;

update public.offer_profiles
set country_aliases = '{"United States":["USA","United States","United States of America","US","U.S."],"Canada":["Canada"]}'::jsonb,
    caps = coalesce(caps,'{}'::jsonb) || '{"jobsPerRun":25,"contactsPerRun":25}'::jsonb,
    scoring_config = coalesce(scoring_config,'{}'::jsonb) || '{"requireHiringTrigger":true,"maxJobAgeDays":14,"hiringPrimary":true,"storefrontSecondary":true}'::jsonb,
    updated_at = now()
where profile_key = 'dcl-shopify-ecommerce-hiring';

commit;
