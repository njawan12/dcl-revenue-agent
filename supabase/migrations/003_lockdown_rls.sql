alter table accounts enable row level security;
alter table signals enable row level security;
alter table storefront_findings enable row level security;
alter table contacts enable row level security;
alter table proof_points enable row level security;
alter table outreach enable row level security;
alter table source_audit enable row level security;
alter table discovery_runs enable row level security;
alter table discovery_observations enable row level security;

-- Intentionally no anon/authenticated policies yet.
-- The private M1 dashboard reads/writes through server-side service-role code only.
-- Authenticated policies will be introduced when DCL user authentication is implemented.
