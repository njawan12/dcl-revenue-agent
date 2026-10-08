# Codex Kickoff — Commercial Product Rebuild

Use this as the first major Codex task after reading `AGENTS.md`.

## Task
Audit the current product against the commercial product constitution and create an implementation plan for a customer-presentable revenue-intelligence SaaS within the 72-hour sprint.

Read these first:
- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/UX_PRINCIPLES.md`
- `docs/QUALITY_SCORE.md`
- `docs/72_HOUR_SPRINT.md`
- `docs/COMPETITIVE_LANDSCAPE.md`
- existing architecture/security/setup/milestone docs

Do not begin broad UI implementation until the audit and execution plan are written.

## Required audit
1. Inventory every current route and major workflow.
2. Identify which screens are scaffolding/mock/internal quality versus commercially presentable.
3. Identify dead navigation, mock data and incomplete states.
4. Identify tenant/security/data-provenance risks.
5. Compare the current information architecture to the required Daily Command Center / Opportunities / Accounts / Buyer Maps / Outreach / Pipeline / Integrations model.
6. Identify what should be reused, refactored or removed.
7. Produce a specific 72-hour build plan with parallelizable workstreams, dependencies and acceptance tests.

## Design direction
Do not create a generic Apollo clone or a giant spreadsheet-first dashboard.

The primary experience is a Daily Command Center that answers `what should I do today?`.

The signature account/opportunity experience must clearly show:
- why now;
- commercial thesis;
- Fit / Need / Intent / Opportunity scores;
- score explanation;
- evidence receipts;
- signal/change timeline;
- storefront/commerce findings;
- buyer map;
- verified contact status;
- recommended sales motion;
- approved proof/case-study relevance;
- next action / outreach state;
- CRM/native pipeline context.

## Technical constraints
- preserve multi-tenant RLS and server-only secret model;
- maintain provider adapters rather than coupling core logic to vendors;
- retain deterministic scoring and validation guardrails;
- no autonomous commercial sending in this sprint;
- no invented facts/contacts/results;
- production build and tests must remain green;
- new major customer-facing workflows require tests and intentional loading/empty/error states.

## Deliverables before implementation
Create/update an execution plan under `docs/exec-plans/active/` containing:
- current-state audit;
- target IA and route map;
- component/design-system plan;
- data/API dependencies;
- prioritized implementation sequence;
- parallel workstreams suitable for separate Codex tasks;
- acceptance criteria mapped to `QUALITY_SCORE.md`;
- explicit non-goals for the sprint.

Then implement only after the plan is internally consistent. Work in small reviewable commits/PRs and keep the plan updated as discoveries change the approach.
