# Commerce Revenue Agent — SaaS Setup

This repository is designed to run as a multi-tenant SaaS application with Digital Commerce Lab as the first workspace.

## 1. Repository visibility

Before adding any real credentials, make this GitHub repository **private**. Never commit `.env`, `.env.local`, provider keys, Supabase service-role keys, SMTP credentials, or outbound mailbox credentials.

## 2. Supabase project

Create a Supabase project and apply migrations in order:

1. `001_initial.sql`
2. `002_discovery_runs.sql`
3. `003_lockdown_rls.sql`
4. `004_multitenant_productization.sql`
5. `005_bootstrap_dcl_workspace.sql`
6. `006_workspace_onboarding.sql`

The multi-tenant migrations enable RLS and workspace isolation. Browser/client access must use the publishable/anon key. The service-role key is server-only and is reserved for trusted background discovery workers and the one-time pre-provisioned workspace claim.

## 3. Authentication

Enable Email + Password authentication in Supabase Auth.

Hosted Supabase projects normally require email confirmation. For SSR confirmation, configure the Confirm signup email template to point at the server confirmation route using a token hash, for example:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Set Supabase **Site URL** to the production app URL and add localhost / preview URLs as appropriate in Redirect URLs.

## 4. Environment variables

Set these in the deployment platform rather than committing them:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://your-product-domain.com

# Optional one-time claim of an already seeded workspace
BOOTSTRAP_WORKSPACE_ID=
BOOTSTRAP_OWNER_EMAIL=

# Background discovery
WORKSPACE_ID=
STORELEADS_API_KEY=
BUILTWITH_API_KEY=
OPENAI_API_KEY=
HUNTER_API_KEY=
PROSPEO_API_KEY=
OUTBOUND_PROVIDER_API_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is supported as a temporary fallback while migrating older Supabase projects, but new environments should prefer the publishable key.

## 5. First customer / pre-provisioned workspace

Migration `005_bootstrap_dcl_workspace.sql` seeds the internal Digital Commerce Lab workspace and backfills pre-commercial records into it.

To attach the first authenticated owner without hard-coding an identity in the repository:

1. Set `BOOTSTRAP_WORKSPACE_ID` to the seeded workspace UUID.
2. Set `BOOTSTRAP_OWNER_EMAIL` to the email that is allowed to claim it.
3. Sign up / confirm that account.
4. The onboarding screen will offer **Claim existing workspace** when the authenticated email matches.
5. `/bootstrap` inserts the caller as owner using a server-only admin client.

The claim is deliberately one-time: it is rejected once the target workspace has any member. After the claim succeeds, remove `BOOTSTRAP_WORKSPACE_ID` and `BOOTSTRAP_OWNER_EMAIL` from the deployment environment.

New SaaS customers do not use bootstrap variables. They create their own workspace from `/onboarding`. The `create_workspace_with_owner` RPC atomically creates:

- workspace
- owner membership
- starter sales/ICP configuration

This avoids a first-workspace RLS deadlock.

## 6. Tenant safety model

- Every commercial data record is scoped to `workspace_id`.
- RLS validates membership on client/server-user queries.
- Owners/admins may change workspace configuration.
- Members/viewers cannot alter sales configuration.
- Active-workspace cookies are never trusted alone; membership is revalidated before use.
- The discovery dashboard uses the authenticated user's Supabase client, not the service-role client.
- Background discovery workers may use the service role, but must always receive an explicit workspace ID.
- Pre-provisioned workspace bootstrap is disabled unless both bootstrap environment variables are present, requires an authenticated matching email and refuses already-claimed workspaces.

## 7. Live discovery

Live discovery remains a server/background-worker process. Set `WORKSPACE_ID` to the target workspace and run:

```bash
npm run discover
```

Store Leads is preferred when `STORELEADS_API_KEY` is present. BuiltWith is the fallback.

Do not enable automated outbound until the workspace has passed its lead-quality validation gate.

## 8. Deployment

Recommended initial deployment:

- Vercel: Next.js web application
- Supabase: Postgres, Auth and RLS
- Separate scheduled/background runner: discovery, enrichment and later follow-up jobs

Keep provider/service-role secrets in server-only environment variables. Never expose them with the `NEXT_PUBLIC_` prefix.
