# Commerce Revenue Agent — Codex Operating Contract

This repository is a commercial SaaS product, not a prototype. Digital Commerce Lab is the first customer, but product decisions must remain multi-tenant and commercially sellable.

## Read first
Before implementation, read:
- `docs/PRODUCT.md`
- `docs/UX_PRINCIPLES.md`
- `docs/QUALITY_SCORE.md`
- `docs/72_HOUR_SPRINT.md`
- existing architecture/security/milestone docs

## Product mission
Build the best commerce-specific revenue intelligence product for agencies and ecommerce service companies. The product must answer: **Which ecommerce companies should I pursue now, why, who should I contact, what should I say, and what changed?**

## Non-negotiables
1. Do not build a generic Apollo/Clay clone.
2. Evidence before automation: every material recommendation must be explainable by source, observed date, confidence, and scoring impact.
3. Commerce depth is the moat: storefront, Shopify/Shopify Plus, apps, CRO, subscriptions, retention, analytics, hiring, leadership and growth signals.
4. User experience must feel premium, fast, calm and obvious. Avoid dense spreadsheet-first UI as the default experience.
5. The primary UX is an opportunity command center, not a database table.
6. Human approval remains required for commercial outreach until product quality gates explicitly change.
7. Never invent people, emails, company facts, results, case-study claims, signal dates or relationship history.
8. Tenant isolation, RLS and server-only secrets are hard constraints.
9. External vendors are replaceable adapters. Core scoring, commerce intelligence, history, evidence and workflow belong to this product.
10. Build for HubSpot/Salesforce/Attio/Pipedrive integration and also provide a useful native pipeline.

## Engineering process
- For any task touching more than a few files, first create/update an execution plan under `docs/exec-plans/active/`.
- State assumptions and acceptance criteria before large implementation changes.
- Reuse existing architecture unless there is a documented reason to change it.
- Add tests for business-critical behavior and regressions.
- Run tests and production build before proposing completion.
- Do not weaken tests merely to make CI green; fix the product logic.
- Flag security, data-quality, cost, compliance and UX risks immediately.

## UI standard
- Optimize for `time to useful decision`, not feature density.
- Daily Command Center: surface what deserves attention today.
- Opportunity: show why now, opportunity thesis, scores, evidence, buyer map and recommended action.
- Progressive disclosure: summary first, deep evidence on demand.
- Every score should be explainable.
- Every AI output should show provenance where relevant.
- Loading, empty, error and partial-data states must be intentionally designed.
- Responsive and keyboard-accessible behavior is required.
- No placeholder-quality visual design in finished product surfaces.

## Definition of done
A feature is not done because it compiles. It is done when:
- user value is clear;
- UX is coherent with the product principles;
- data provenance is preserved;
- tenant/security constraints are correct;
- failure/empty states exist;
- tests pass;
- production build passes;
- no obvious dead navigation or mock-only paths remain;
- the result could be shown to a paying customer without apology.
