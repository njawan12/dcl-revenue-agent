# Commerce Revenue Agent

Commerce-specific revenue intelligence for Shopify agencies, CRO teams, retention agencies, ecommerce consultancies and Shopify ecosystem service providers.

Digital Commerce Lab is customer #1 and the internal design partner. The product underneath is multi-tenant and commercially configurable.

## What it does

- discovers Shopify and Shopify Plus prospects beyond job postings
- verifies storefront/platform evidence independently
- detects storefront, technology, hiring, leadership and growth signals
- calculates explainable Fit / Need / Intent / Opportunity scores
- recommends a buyer role and sales motion
- maintains source provenance and confidence
- requires a real reason-to-contact before outreach
- supports verified-contact and human-approval guardrails
- isolates every customer's accounts, signals, contacts, proof and outreach by workspace

## Current milestone

M1C — SaaS authentication and workspace onboarding.

Implemented foundations include:

- Next.js dashboard
- Supabase/Postgres persistence
- Supabase Auth SSR session handling
- multi-tenant workspaces and memberships
- tenant-safe RLS
- configurable services, ICP and scoring rules
- workspace switching
- workspace onboarding
- commerce discovery adapters (Store Leads preferred, BuiltWith fallback)
- Lever and Greenhouse hiring signals
- Shopify storefront verification
- deterministic scoring/qualification
- discovery run history
- provider usage metering
- automated tests and CI

## Local development

1. Make the repository private before configuring production credentials.
2. Copy `.env.example` to `.env.local`.
3. Configure Supabase and apply migrations. See `docs/SAAS_SETUP.md`.
4. Run `npm install`.
5. Run `npm run dev`.

## Commands

```bash
npm test
npm run build
npm run discover
```

## Product gates

Discovery quality is validated before automated outbound is enabled. The initial DCL gate is 50 real Shopify accounts with at least 70% judged genuinely worth pursuing.

## Roadmap

M1 Discovery + SaaS foundation → M2 buyer/contact intelligence → M3 outreach/follow-up → M4 learning/optimization → commercial billing/usage plans.
