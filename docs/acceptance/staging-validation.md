# Private Staging Validation

This is the verification sequence required before calling the commercial candidate demo-ready. It is intentionally private and does not authorize public launch or autonomous outbound.

## Environment boundary

Use an isolated staging Supabase project and non-production provider credentials. Do not reuse production customer data. Seed only synthetic or explicitly authorized business data needed to exercise the product.

Required configuration is server-side only. Never commit Supabase service-role keys, provider API keys, email credentials or secrets to the repository.

## Database and tenant isolation

Apply all migrations in order. Create two workspaces with distinct test accounts and users covering Viewer, Member, Admin and Owner.

Verify:
- workspace A cannot read or mutate workspace B accounts, contacts, signals, scoring receipts, pipeline events, outreach revisions, approvals, suppressions, provenance, governance or durable jobs
- Viewer cannot operate or approve
- Member can perform allowed research/pipeline operations but cannot approve outreach
- Admin/Owner can review according to the approval contract
- immutable scoring/evidence/provenance receipts reject tenant mutation
- cross-workspace revision/approval attachment is rejected

## Durable discovery

With configured staging providers, exercise one successful discovery job plus:
- duplicate/idempotent enqueue
- transient provider failure and bounded retry
- lease expiry/reclaim
- stale worker completion rejection
- terminal retry exhaustion
- unsupported/send-like job rejection

Confirm results contain summarized, purpose-limited business intelligence rather than raw provider payload dumps. Confirm source/provider provenance and usage are recorded.

## Outreach safety

Exercise a held draft with synthetic/authorized business contact data. Verify independently at UI and database boundaries:
- no evidence → blocked
- unverified professional email → blocked
- suppression → blocked
- unresolved region → blocked
- unverified policy basis → blocked
- passing product-policy receipt → eligible for human review only
- approval of an older revision after a new revision exists → rejected
- approved exact revision remains held
- no provider send is invoked

## Governance

Verify retention values and collection purpose are visible as product-policy configuration, not legal claims. Create a deletion request and verify it is auditable and non-destructive until explicitly reviewed. Verify source provenance preserves provider/source class, purpose, terms reference and licensing-verification state.

## Release record

Record:
- candidate commit SHA
- migration version/head
- staging project identifier (non-secret)
- provider adapters exercised
- roles/workspaces exercised
- pass/fail notes
- unresolved policy/legal questions

Do not place secrets, access tokens, personal credentials or unnecessary personal data in the acceptance record.
