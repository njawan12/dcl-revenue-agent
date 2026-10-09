# Live staging journey acceptance

Scope: existing Supabase asqvzlxvcbzfvngbymmr and Render srv-db4gohjl550s73bmv4a0 only. Never operate on lab-report. Outbound stays disabled.

Baseline main and preview: 3796b97891de8146189daccaf1cdd680fe5ab483; migrations through 026. Staging has zero Auth users at start.

Acceptance: correct Site URL/redirect allowlist; both token-hash and PKCE confirmation establish cookie sessions; signup/login/onboarding and workspace creation; two-tenant Owner/Admin/Member/Viewer read/write isolation; suppression, proof and policy gates; held approval without send; primary surfaces desktop/tablet/mobile; tests/build and remote CI green; preview deploy exact green commit.

Work:
- Fix observed callback coverage and redirect cookie loss, with behavioral regression tests.
- Run rollback-only live database acceptance with synthetic identities and fixtures.
- Inspect authenticated browser journey once staging dashboard/test-account access is available.
- Record evidence and unresolved access/provider gates honestly before deployment.

Dashboard Auth configuration is not exposed through connected Supabase tools. Dashboard currently requires user sign-in. Existing local checkout had unrelated changes; this checkout starts from remote main and leaves those changes untouched.

Progress: callback/session fixes implemented; suppression and approval defects reproduced and fixed; 58 rollback-only live checks pass; 75 unit tests/build pass. See docs/acceptance/staging-2026-10-09.md for scope and pending dashboard/browser/provider evidence. Authenticated browser journey remains pending user sign-in.
