# Commercial Release Candidate

## Mission
Ship a commercially credible, premium commerce revenue intelligence product for agencies and ecommerce service companies. DCL is customer #1, not a hard-coded tenant.

## Current audit
Primary Command Center and Opportunity surfaces are workspace-backed rather than mock-backed. Revision-bound approval, held outbox, central suppression, native pipeline, change intelligence, immutable scoring receipts, score-movement explanation, persistent leased discovery execution, replaceable CRM sync contracts, auditable data-governance/provenance foundations, and a deny-by-default versioned outreach-policy receipt are implemented. The exact policy receipt is bound to approval at the database boundary and surfaced in Held Outbox. Command Center, Opportunity, Accounts, Contacts, Pipeline and Settings use explicit partial/error states rather than silently treating failed reads as zero/empty intelligence. An evidence-based repository scorecard records 87/100, above the documented 85 threshold, with environmental verification still open. Private-preview browser and staging acceptance protocols now define those remaining gates. CI and production build are green through the current staging-readiness documentation. Live database/provider/browser validation remains a release risk and must not be implied by CI alone.

## Product decisions
- Initial motion: Shopify/DTC agencies and ecommerce service companies; services remain workspace configuration.
- Roles: Owner/Admin may approve outreach; Member may research/edit/draft and operate pipeline; Viewer is read-only. Enforce server-side.
- Outbound boundary: draft -> needs_review -> approved -> held. No external send in this release candidate.
- Native CRM: accounts, contacts, opportunities, stage, owner, value, notes, tasks, next action, timeline, outreach/meeting state, won/lost and suppression.
- CRM adapters: versioned replaceable contracts for HubSpot, Salesforce, Attio and Pipedrive; never fake live integrations.
- Scoring: deterministic, versioned and auditable. AI may extract/classify evidence but may not invent final scores.
- Evidence confidence considers source reliability, freshness, corroboration and direct observation vs inference.
- Proof library: only explicitly approved claims may enter outreach; never fabricate metrics, relationships or outcomes.
- Jurisdiction policy: rules are conservative, versioned policy gates. They express product eligibility for review, never a claim of legal compliance.

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
9. Region-aware outreach policy is deny-by-default for unknown/unvalidated jurisdictions and must run before held-outbox eligibility.

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
- [x] close material tenant-reference/authorization gaps discovered so far;
- [x] define revision-bound approval + held outbox contracts;
- [x] central suppression enforcement;
- [x] versioned evidence/scoring schema and immutable score receipts;
- [x] durable job contract with workspace isolation, idempotency, leases, bounded retries and inspectable terminal failures;
- [x] leased discovery worker execution with closed job types and no outbound action.

### P1 — real commerce intelligence
- [x] replace primary-screen mock dependencies with workspace-backed read models;
- [x] evidence receipts and score explanation;
- [x] commerce/storefront findings and signal history;
- [x] explicit partial/error states on signature intelligence and account/buyer/pipeline surfaces; stale-state acceptance remains part of final browser validation.

### P2 — buyer, proof and approval
- [x] buyer map/contact verification model;
- [x] approved proof library contract;
- [x] evidence-grounded draft generation contract;
- [x] edit/review/approval with audit history.

### P3 — held outbox and native pipeline
- [x] held-only outbound queue;
- [x] native pipeline, next action and activity timeline;
- [x] CRM adapter contracts with deterministic idempotency and explicit two-sided conflict semantics.

### P4 — governance, policy and premium acceptance
- [x] workspace retention/purpose policy foundation;
- [x] append-only provider/source provenance with explicit licensing verification state;
- [x] auditable deletion-request workflow without unguarded destructive action;
- [x] versioned region-aware outreach eligibility policy, deny-by-default when legal basis/policy is unresolved;
- [x] wire policy decision into held-outbox eligibility and audit receipt;
- [x] signature Command Center/Opportunity truthfulness and partial-state hardening;
- [x] Accounts/Contacts/Pipeline secondary-surface resilience pass;
- [x] Settings/governance truthful partial-state and policy presentation pass;
- [x] primary navigation route/anchor audit;
- [x] private-preview browser acceptance protocol;
- [x] isolated staging/RLS/provider acceptance protocol;
- [~] execute live private-preview database/provider/browser acceptance when isolated infrastructure is connected.

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
- Live database/provider/browser flows have not yet been verified in an isolated staging environment.
- Provider data licensing/source terms require verification before production collection at scale; unverified sources must remain visibly unverified.
- Jurisdiction-specific outreach rules require counsel/policy validation before enabling delivery; unknown policy must block rather than guess.
- Retention values are product defaults and require policy/legal validation before production enforcement.
- Final browser-level accessibility/stale-state/customer-demo acceptance requires the private preview environment.

## Next implementation slice
The repository-only commercial candidate is now at the private-preview verification boundary. Once isolated staging infrastructure is connected, apply every migration through current head, validate two-workspace RLS and Viewer/Member/Admin/Owner boundaries, seed realistic safe business data, execute durable discovery failure/retry cases, then run the full desktop/tablet/mobile browser protocol. Fix any observed defects before declaring demo readiness. Do not deploy publicly or enable sending.
