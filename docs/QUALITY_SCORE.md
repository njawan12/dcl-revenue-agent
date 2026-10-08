# Product Quality Score

Every customer-facing milestone is scored before merge. Minimum release threshold: **85/100**. Any hard-fail item blocks release regardless of total.

## Scoring
### User value — 20
- solves a clear operator job
- reduces time/effort or improves decision quality
- output is actionable

### UX clarity — 20
- obvious hierarchy and next action
- minimal unnecessary clicks
- coherent loading/empty/error/partial states
- no dead or mock-only paths

### Data quality & explainability — 15
- provenance preserved
- dates/confidence shown when relevant
- no unsupported inference presented as fact
- scoring is explainable

### Functional completeness — 15
- happy path works end-to-end
- edge cases handled
- state transitions are consistent
- integrations fail safely

### Security & tenant isolation — 10
- tenant scope enforced
- secrets server-only
- privilege/role checks correct
- destructive actions guarded

### Reliability & testing — 10
- business-critical unit/integration tests
- CI green
- production build green
- provider failures contained

### Performance & polish — 10
- fast enough for interactive use
- polished visual states
- responsive behavior
- accessibility basics met

## Hard fails
- cross-tenant data exposure
- invented person/email/company claim
- unsupported case-study/result claim
- automated commercial send without required approval
- primary flow depends on mock data
- broken navigation in released surface
- unverified email treated as verified
- opaque AI score presented as authoritative

## Review question
Before merge, ask: **Would we confidently put this exact build in front of a paying agency owner competing against Apollo/Clay/Common Room?**

If the answer is no, it is not done.
