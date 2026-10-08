# Commercial Release Candidate

## Mission
Ship a commercially credible, premium commerce revenue intelligence product for agencies and ecommerce service companies. DCL is customer #1, not a hard-coded tenant.

## Current audit
The current repository has a sound product constitution and passing baseline, but customer-facing primary surfaces still contain sample/mock data and table-first scaffolding. Primary workflows are incomplete and must not be presented as live intelligence until their provenance and tenant boundaries are real.

## Product decisions
- Initial motion: Shopify/DTC agencies and ecommerce service companies; services remain workspace configuration.
- Roles: Owner/Admin may approve outreach; Member may research/edit/draft; Viewer is read-only. Enforce server-side.
- Outbound boundary: draft -> needs_review -> approved -> held. No external send in this release candidate.
- Native CRM: accounts, contacts, opportunities, stage, owner, value, notes, tasks, next action, timeline, outreach/meeting state, won/lost and suppression.
- CRM adapters: HubSpot first contract, then Salesforce, Attio and Pipedrive; never fake live integrations.
- Scoring: deterministic, versioned and auditable. AI may extract/classify evidence but may not invent final scores.
- Evidence confidence considers source reliability, freshness, corroboration and direct observation vs inference.
- Proof library: only explicitly approved claims may enter outreach; never fabricate metrics, relationships or outcomes.

## Signature journey
Daily Command Center -> Opportunity -> Why now/commercial thesis -> score explanation -> evidence receipts -> commerce findings -> signal timeline -> buyer map -> verified professional contact -> recommended motion -> approved proof -> evidence-grounded draft -> human review -> approval -> held outbox -> native pipeline/next action.

## Architecture constraints
1. Preserve Next.js/Supabase and replaceable provider adapters unless a documented ADR justifies change.
2. Every user-facing tenant object carries and enforces workspace ownership. RLS/server authorization is a hard constraint.
3. Persist evidence and score revisions; recommendations must remain explainable after source data changes.
4. Long-running discovery/enrichment uses durable jobs with idempotency/retry semantics rather than request-bound work.
5. Approval is revision-bound: changing approved copy invalidates approval.
6. Suppression/unsubscribe is enforced centrally and cannot be bypassed by provider adapters.
7. Core scoring, evidence, history and workflow remain vendor-independent.
8. ICP, services, scoring weights, providers, CRM adapters, proof rules, workflow states and presentation copy are configuration-driven where commercially sensible.

## UX direction
### Daily Command Center
The default home answers: what should I do today? Prioritize a short ranked decision queue, changes since last review, drafts/replies requiring action and pipeline movement. Avoid dashboard vanity metrics and database-table storytelling.

### Opportunity
First viewport: account identity + commerce context, Opportunity Score with explanation affordance, one-sentence Why Now, recommended service/motion, buyer readiness and one clear next action. Progressive disclosure below for evidence, score factors, timeline, storefront findings, stack, buyers, outreach and pipeline history.

### Visual bar
Premium modern B2B SaaS: strong typography, generous spacing, restrained semantic color, refined panels, deliberate density and polished interaction states. No generic AI gradients/glows, placeholder component-library feel or excessive cards. Design loading, empty, partial, stale, permission and error states intentionally. Keyboard and responsive review flows are required.

## Legal/compliance product constraints
Design conservatively for privacy and outreach compliance without claiming universal legal compliance. Include data minimization, purpose limitation, retention/deletion controls, auditability, suppression/unsubscribe, professional/business-contact boundaries, region-aware outreach policy hooks and provenance/licensing metadata for providers and sources. Track issues requiring jurisdiction-specific legal interpretation (including CAN-SPAM, CASL, GDPR/UK PECR and CCPA/CPRA) rather than encoding guesses. No autonomous outbound.

## Execution order
### P0 — security and contracts
- close tenant-reference/authorization gaps;
- define revision-bound approval + held outbox contracts;
- central suppression enforcement;
- versioned evidence/scoring schema;
- durable job contract.

### P1 — real commerce intelligence
- replace primary-screen mock dependencies with workspace-backed read models;
- evidence receipts and score explanation;
- commerce/storefront findings and signal history;
- explicit partial/stale states.

### P2 — buyer, proof and approval
- buyer map/contact verification model;
- approved proof library;
- evidence-grounded draft generation contract;
- edit/review/approval with audit history.

### P3 — held outbox and native pipeline
- held-only outbound queue;
- native pipeline, tasks, next action and activity timeline;
- CRM adapter contracts with idempotency/conflict semantics.

### P4 — premium UX and acceptance hardening
UX quality is continuous, but final hardening includes responsive/keyboard passes, loading/empty/error/permission/stale states, dead-nav removal and customer-demo polish.

## Acceptance gates
- `docs/QUALITY_SCORE.md` >= 85/100 and no hard fail.
- No primary customer-facing surface labels fabricated/sample information as real intelligence.
- Every consequential recommendation has inspectable provenance.
- Tenant isolation and authorization are tested server-side.
- Approved content cannot mutate without invalidating approval.
- Suppressed contacts cannot enter held outbox.
- No path can externally send.
- Primary navigation has no dead/mock-only destinations.
- Critical states are designed, not browser/default fallbacks.
- Automated tests and production build pass.
- Live DB/provider/browser validation remains explicitly unverified until actually exercised.

## Current risks
- Primary home currently imports `lib/mock-data`; this is incompatible with a commercial release unless unmistakably isolated as demo/sample mode.
- Live database/provider/browser flows have not yet been verified.
- Provider data licensing/source terms require verification before production collection at scale.
- Jurisdiction-specific outreach rules require counsel/policy validation before enabling delivery.

## Next implementation slice
Start with security/data contracts and workspace-backed Command Center read model. Do not cosmetically polish mock primary screens and call them finished; premium UX must sit on truthful states and real contracts.
