# M1 Live Discovery Run

## Goal
Produce the first 50 real Shopify accounts, independently verify storefronts, calculate deterministic DCL scores, and review whether at least 70% are genuinely worth pursuing.

## Required external configuration

### 1. Candidate provider
Preferred: Store Leads

`STORELEADS_API_KEY=...`

Fallback: BuiltWith

`BUILTWITH_API_KEY=...`

The provider nominates candidates only. A provider match does **not** mark an account as verified Shopify.

### 2. Supabase

`NEXT_PUBLIC_SUPABASE_URL=...`
`SUPABASE_SERVICE_ROLE_KEY=...`

Apply migrations in `supabase/migrations/` before running discovery. Tables are RLS-protected and intentionally have no browser-access policies during M1.

## Optional discovery controls

`DISCOVERY_LIMIT=25`
`DISCOVERY_COUNTRIES=US,CA`
`DISCOVERY_SINCE=30 Days Ago`
`DISCOVERY_OTHER_TECHS=Klaviyo`

## Run

```bash
npm install
npm test
npm run build
npm run discover
```

## Pipeline

1. Fetch Shopify candidates from Store Leads (or BuiltWith fallback).
2. Canonicalize and deduplicate account domains.
3. Fetch each public storefront using redirect-safe SSRF protections and response caps.
4. Independently detect Shopify evidence.
5. Detect public commerce-tech markers.
6. Produce cautious storefront opportunity findings with confidence.
7. Generate Fit / Need / Intent / Opportunity scores deterministically.
8. Assign tier, sales motion and suggested buyer role.
9. Persist accounts, signals, raw observations and discovery-run metadata to Supabase.
10. Review in `/discover` and inspect qualified accounts before any outreach work begins.

## Acceptance gate

M1 is not complete until:

- 50 real accounts have been reviewed.
- At least 70% are judged genuinely worth DCL pursuing.
- False-positive Shopify detection is acceptably low.
- Storefront findings are useful enough to support a credible reason to contact.
- No sending/outreach automation is enabled.

If the 70% quality gate fails, tune discovery filters and scoring before proceeding to contact enrichment or outbound.
