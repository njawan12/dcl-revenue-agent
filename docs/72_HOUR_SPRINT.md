# 72-Hour Commercial Product Sprint

Goal: reach a credible, customer-presentable commerce revenue-intelligence product fast without sacrificing the hard quality constraints.

## Phase 1 — Product/UX lock (first block)
- audit existing customer-facing screens against UX principles
- create final information architecture
- define Daily Command Center, Opportunity Page, Account/Buyer views, Outreach Outbox, Pipeline and Integrations
- remove scaffold/mock assumptions from finished surfaces
- define design tokens/components and states
- document any architecture changes before coding

Exit gate: product/UX plan is reviewable before broad UI implementation.

## Phase 2 — Core commercial workflow
Deliver an end-to-end path:
1. discover/ingest account
2. qualify with explainable scores
3. inspect evidence
4. map buyer
5. verify professional email
6. create evidence-grounded first-touch draft
7. human approve/reject/edit
8. place in outbox/sequence state
9. track native pipeline state

No real autonomous sending required for this sprint.

## Phase 3 — Premium UX pass
- Daily Command Center becomes default home
- Opportunity detail becomes narrative/evidence-first
- accounts/contacts tables become secondary power-user surfaces
- comprehensive loading/empty/error/partial states
- keyboard/accessibility pass
- responsive review/triage views

## Phase 4 — Integration foundation
Define stable connector interfaces and implement at least one credible CRM integration path or integration-ready contract. Priorities:
1. HubSpot
2. Salesforce
3. Attio
4. Pipedrive

Native pipeline must remain usable without a CRM.

## Phase 5 — Quality gauntlet
- business logic tests
- tenant/RLS checks
- provider failure tests
- unsupported-claim tests
- build and lint/type checks
- manual product walkthrough against `QUALITY_SCORE.md`

Release candidate must score >=85/100 with zero hard fails.

## What not to do in 72 hours
- chase every possible provider integration
- autonomous high-volume sending
- billing perfection
- deep enterprise administration
- build generic features that do not improve the core commerce opportunity workflow

## Definition of sprint success
A new user can sign in, understand the product quickly, inspect a real commerce opportunity, trust why it was surfaced, identify a credible buyer, generate a grounded outreach draft, approve it, and manage the opportunity without needing another CRM for the basic workflow.
