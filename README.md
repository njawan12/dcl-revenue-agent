# DCL Revenue Agent

Commerce-specific revenue intelligence for Shopify agencies, CRO teams, retention agencies, ecommerce consultancies and Shopify ecosystem service providers.

Digital Commerce Lab is customer #1 and the internal design partner. The product underneath is multi-tenant and commercially configurable.

## Product promise

The operating question is not “how many leads do we have?” It is: **who should we pursue now, why, who owns the problem, what changed, what evidence supports it, and what should the operator do next?**

The current product includes:

- Daily Command Center for ranked decisions, recent material changes and follow-up work
- narrative Opportunity Intelligence with Why Now, commercial thesis and next best action
- inspectable evidence receipts and signal timeline
- deterministic, versioned Fit / Need / Intent / Opportunity scoring receipts
- buyer mapping and verified-professional-contact readiness
- durable commerce discovery with leased worker execution and provider/source provenance
- revision-bound outreach drafting and Owner/Admin human approval
- deny-by-default region-policy receipt before eligibility for human review
- central account/contact/email/domain suppression
- Held Outbox: approved messages remain held; there is no autonomous/external send path
- native pipeline with auditable stage and next-action history
- configurable ICP, services, scoring, proof, governance and replaceable CRM/provider contracts
- workspace-scoped multi-tenant RLS and server-side authorization boundaries

## Current milestone

**Commercial release candidate — conditional acceptance.**

The repository has crossed the documented engineering/product score threshold, but it is not authorized for public production launch. See:

- `docs/release-readiness.md`
- `docs/acceptance/browser-acceptance.md`
- `docs/acceptance/staging-validation.md`
- `docs/exec-plans/active/commercial-release-candidate.md`

Remaining gates are intentionally environmental: isolated staging database/RLS validation, configured-provider execution/failure testing, realistic browser/accessibility acceptance, retention/deletion-policy validation and qualified review of jurisdiction-specific outreach policy before any future delivery capability.

## Safety boundary

Commercial outreach requires evidence, a verified professional contact, suppression clearance, a passing versioned product-policy receipt and explicit Owner/Admin approval of the exact current revision. Approval only moves an item into the Held Outbox. **No external or autonomous sending is enabled.**

Product policy is not presented as a legal-compliance determination. Unknown or unverified jurisdiction/policy state blocks review eligibility by default.

## Local / private staging setup

1. Keep credentials out of Git and use an isolated development/staging environment.
2. Copy `.env.example` to `.env.local`.
3. Configure Supabase and apply migrations; see `docs/SAAS_SETUP.md`.
4. Install dependencies with `npm ci`.
5. Run `npm test` and `npm run build`.
6. Run locally with `npm run dev`.
7. Before treating a private preview as demo-ready, execute both acceptance protocols under `docs/acceptance/`.

## Commands

```bash
npm test
npm run build
npm run dev
npm run discover
```

## Release boundary

Do not enable autonomous outbound or infer legal permission from product-policy eligibility. Do not claim live database/provider/browser verification until those environments have actually been exercised. The initial DCL quality gate for any future autonomous-delivery consideration remains 50 real Shopify accounts with at least 70% judged genuinely worth pursuing, in addition to all security, policy and approval gates.
