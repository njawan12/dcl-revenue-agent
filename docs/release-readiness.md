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
| Security & tenant isolation | 10/10 | Workspace-scoped RLS/server checks, revision-bound approval, central suppression, immutable receipts, service-role worker leases and guarded governance actions are implemented/tested. Isolated staging confirms every public tenant table currently has RLS enabled; the two-workspace role matrix still requires execution. |
| Reliability & testing | 8/10 | Isolated staging has every repository migration through `020_security_definer_hardening` applied. GitHub currently reports no status checks on the latest candidate head, so CI is not claimed green for that head. Provider/live environment failure behavior still needs exercised validation. |
| Performance & polish | 5/10 | Responsive navigation, focus-visible/reduced-motion treatment and premium signature surfaces are implemented. Browser-level accessibility, visual regression and real-data density acceptance remain unverified. |

## Live staging verification record

Verified against the isolated Revenue Agent staging project (project identifier intentionally non-secret):

- candidate repository head inspected: `0f493312609c8d573e8aaf3efba0a60d5acc8cc5`;
- migrations `001_initial` through `020_security_definer_hardening` are present in staging migration history, including the staging-discovered pipeline suppression arity fix and function-execution hardening;
- all current public tenant/application tables report row-level security enabled;
- this verification does **not** substitute for authenticated two-workspace isolation tests, role-boundary tests, provider execution, browser acceptance, or legal/policy review;
- no public deployment or outbound delivery is authorized by this record.

## Hard-fail review

- Cross-tenant exposure: no known open path; RLS/server boundaries and workspace-scoped contracts are present. Requires live authenticated two-workspace verification before release.
- Invented person/email/company claim: product contracts prohibit invention; buyer/contact readiness requires persisted records and verified professional email.
- Unsupported proof/result claim: proof is revision-bound/approved and outreach does not silently insert proof claims.
- Automated commercial send: absent by design. Approved items remain held; autonomous send is disabled.
- Mock-dependent primary flow: primary Command Center and Opportunity surfaces are workspace-backed.
- Broken primary navigation: current primary routes resolve to real product surfaces; final browser click-through remains required.
- Unverified email treated as verified: readiness and policy gates require verified professional email.
- Opaque AI score: final scoring is deterministic/versioned with immutable receipts; AI is not authoritative for final score.

## Release blockers / verification gates

1. **Partially verified:** migrations are applied in isolated staging and all current public tenant/application tables report RLS enabled. Still execute authenticated RLS with at least two workspaces and Viewer/Member/Admin/Owner roles.
2. Exercise durable discovery with real configured providers, including transient failure, retry, lease expiry and terminal failure; verify source/provider terms before production-scale collection.
3. Browser-test the complete signature journey at desktop/tablet/mobile widths with keyboard-only navigation, focus order, loading/error/partial/stale/permission states and realistic data density.
4. Validate jurisdiction-specific outreach policy with qualified policy/legal review before any delivery capability is enabled. Unknown/unverified policy must continue to block.
5. Validate workspace retention values and deletion procedure before production enforcement; current values are product-policy defaults, not legal advice.
6. Re-run full CI/production build on the final candidate head after all acceptance fixes.

## Release boundary

Do not deploy publicly or enable external/autonomous sending from this candidate. Human approval, suppression, verified-business-contact and region-policy gates remain mandatory even after later delivery adapters are introduced.
