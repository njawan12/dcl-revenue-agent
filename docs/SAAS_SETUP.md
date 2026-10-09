# DCL Revenue Agent — SaaS / Private Staging Setup

This repository runs as a multi-tenant SaaS application with Digital Commerce Lab as the first workspace. This guide is operational setup, not deployment authorization or a legal-compliance claim.

## 1. Credential boundary

Never commit `.env`, `.env.local`, provider keys, Supabase service-role keys, mailbox credentials or access tokens. Use an isolated staging Supabase project and non-production provider credentials for acceptance. Do not seed unnecessary personal data.

The repository is currently publicly visible, so treat its full Git history as public and never place a secret in a commit even temporarily.

## 2. Supabase project and migrations

Create an isolated Supabase project and apply **every SQL migration in `supabase/migrations/` in numeric order through the current repository head**. Do not use the old 001–006 list as a complete schema; later migrations contain contact intelligence, revision-bound approvals, held-outbox guards, native pipeline, suppression, scoring history, durable jobs, governance/provenance and outreach-policy enforcement.

After applying migrations, record the migration head in the staging acceptance record. Browser/client access uses the publishable/anon key. `SUPABASE_SERVICE_ROLE_KEY` is server-only and reserved for trusted server/background operations.

## 3. Authentication

Enable Email + Password authentication in Supabase Auth.

For SSR confirmation, configure the Confirm signup email template to point at the server confirmation route using a token hash, for example:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Set Supabase Site URL to the private preview URL when one exists and add localhost/private preview URLs as appropriate in Redirect URLs.

## 4. Environment variables

Set deployment/staging variables in the environment rather than committing them:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional one-time claim of an already seeded workspace
BOOTSTRAP_WORKSPACE_ID=
BOOTSTRAP_OWNER_EMAIL=

# Background discovery / configured adapters
WORKSPACE_ID=
STORELEADS_API_KEY=
BUILTWITH_API_KEY=
OPENAI_API_KEY=
HUNTER_API_KEY=
PROSPEO_API_KEY=
OUTBOUND_PROVIDER_API_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` remains a compatibility fallback for older Supabase projects; new environments should prefer the publishable key.

`OUTBOUND_PROVIDER_API_KEY` must not be interpreted as permission to send. The commercial candidate has no autonomous/external sending path; approved revisions remain held.

## 5. First workspace

The historical DCL bootstrap migration seeds the internal workspace. To attach the first authenticated owner without hard-coding an identity:

1. Set `BOOTSTRAP_WORKSPACE_ID` to the seeded workspace UUID.
2. Set `BOOTSTRAP_OWNER_EMAIL` to the email allowed to claim it.
3. Sign up and confirm that account.
4. Use the onboarding claim path when offered.
5. Remove both bootstrap variables immediately after the one-time claim succeeds.

New SaaS tenants create their own workspace through onboarding; they do not use bootstrap variables.

## 6. Tenant and role acceptance

Before treating staging as valid, create two distinct test workspaces and exercise Viewer, Member, Admin and Owner. Follow `docs/acceptance/staging-validation.md` rather than assuming migration success proves isolation.

At minimum verify workspace isolation for accounts, contacts, signals, scoring receipts, pipeline events, outreach/revisions/approvals, suppression, provenance/governance and durable jobs. Verify Viewer cannot mutate, Member cannot approve, and Owner/Admin review remains exact-revision and policy gated.

## 7. Durable discovery

Discovery is a server/background-worker process. Configured staging providers may be used only after their source/API terms are verified for the intended test.

Exercise success, idempotent enqueue, transient retry, lease expiry/reclaim, stale-worker completion rejection and terminal failure. Do not claim a provider integration is validated merely because its adapter compiles.

## 8. Held-outbox safety

The staging journey must demonstrate:

- evidence required
- verified professional email required
- central suppression enforced
- unresolved/unverified region policy blocked by default
- Owner/Admin exact-revision approval required
- a newer revision invalidates prior approval state
- approved item remains held
- no provider send action is invoked

Product-policy eligibility means eligible for human review only; it is not a legal-compliance determination.

## 9. Private preview acceptance

Run:

```bash
npm ci
npm test
npm run build
npm run dev
```

Then execute `docs/acceptance/browser-acceptance.md` at desktop, tablet and mobile widths with realistic safe data. Capture the candidate SHA and pass/fail notes.

## 10. Deployment boundary

A private staging/preview environment is the next verification environment, not a public production launch. Do not enable autonomous outbound. Do not infer jurisdiction-specific legal permission from product policy. Retention/deletion defaults and provider/source terms must be validated before production enforcement or scale.
