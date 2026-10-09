# Release Readiness — Commercial Candidate

This document scores the repository against `docs/QUALITY_SCORE.md`. It is an engineering/product acceptance record, not a deployment authorization or legal-compliance claim.

## Current score: 87 / 100 — conditional candidate

No known hard fail is accepted as cleared solely by this score. Final release remains blocked on the verification gates below.

| Dimension | Score | Evidence / remaining gap |
| --- | ---: | --- |
| User value | 19/20 | Daily Command Center, narrative Opportunity Intelligence, evidence receipts, buyer readiness, next action, held outbox and native pipeline form a coherent operator journey. Live customer validation remains outstanding. |
| UX clarity | 18/20 | Signature surfaces are decision-oriented; primary secondary surfaces have explicit empty/error/partial states and real navigation. Final browser-level stale/loading/permission review remains. |
| Data quality & explainability | 15/15 | Deterministic versioned scoring receipts, evidence references, observed dates/confidence, change history and source provenance are persisted; missing reads are withheld rather than inferred. |
| Functional completeness | 12/15 | Durable discovery, buyer/proof/draft/approval/held-outbox/pipeline contracts exist and fail conservatively. Live database/provider/browser end-to-end execution has not yet been verified. |
| Security & tenant isolation | 10/10 | Workspace-scoped RLS/server checks, revision-bound approval, central suppression, immutable receipts, service-role worker leases and guarded governance actions are implemented/tested. |
| Reliability & testing | 8/10 | Recent CI and production builds are green through pipeline hardening; latest Settings acceptance commit must complete CI. Provider/live environment failure behavior still needs exercised validation. |
| Performance & polish | 5/10 | Responsive navigation, focus-visible/reduced-motion treatment and premium signature surfaces are implemented. Browser-level accessibility, visual regression and real-data density acceptance remain unverified. |

## Hard-fail review

- Cross-tenant exposure: no known open path; RLS/server boundaries and workspace-scoped contracts are present. Requires live DB verification before release.
- Invented person/email/company claim: product contracts prohibit invention; buyer/contact readiness requires persisted records and verified professional email.
- Unsupported proof/result claim: proof is revision-bound/approved and outreach does not silently insert proof claims.
- Automated commercial send: absent by design. Approved items remain held; autonomous send is disabled.
- Mock-dependent primary flow: primary Command Center and Opportunity surfaces are workspace-backed.
- Broken primary navigation: current primary routes resolve to real product surfaces; final browser click-through remains required.
- Unverified email treated as verified: readiness and policy gates require verified professional email.
- Opaque AI score: final scoring is deterministic/versioned with immutable receipts; AI is not authoritative for final score.

## Release blockers / verification gates

1. Apply migrations in an isolated staging Supabase project and exercise RLS with at least two workspaces and Viewer/Member/Admin/Owner roles.
2. Exercise durable discovery with real configured providers, including transient failure, retry, lease expiry and terminal failure; verify source/provider terms before production-scale collection.
3. Browser-test the complete signature journey at desktop/tablet/mobile widths with keyboard-only navigation, focus order, loading/error/partial/stale/permission states and realistic data density.
4. Validate jurisdiction-specific outreach policy with qualified policy/legal review before any delivery capability is enabled. Unknown/unverified policy must continue to block.
5. Validate workspace retention values and deletion procedure before production enforcement; current values are product-policy defaults, not legal advice.
6. Re-run full CI/production build on the final candidate head after all acceptance fixes.

## Release boundary

Do not deploy publicly or enable external/autonomous sending from this candidate. Human approval, suppression, verified-business-contact and region-policy gates remain mandatory even after later delivery adapters are introduced.
