# Commercial Release Candidate

## Current objective
Turn Revenue Agent into a sellable, mobile-first sales operating system that combines hiring-led signal discovery with buyer research, message preparation, approval, shared data, analytics, team controls, and pipeline execution.

## Product promise
Find companies showing a real buying trigger, identify the right person, explain why the lead matters now, prepare a message for human approval, and keep the opportunity moving in one workspace.

## Current release gate
A feature is not considered complete because it exists technically. It must be usable, understandable, mobile-ready, visually coherent, permission-safe, and validated against the core journey.

### Signature journey
Home → Leads → Lead detail → People → Messages → Pipeline.

Supporting operating surfaces:
- Find leads
- Global Data
- Saved views
- Analytics
- Integrations
- Team
- Offer profiles
- Settings / suppression / governance

### Current architecture rules
- Hiring trigger is primary for the DCL offer profile.
- Offer profiles keep the engine industry-agnostic.
- Crustdata is the primary paid discovery, company, buyer and verified-email provider.
- Greenhouse and Lever are secondary hiring evidence sources.
- Anthropic is the drafting provider through a replaceable adapter.
- Human approval remains mandatory for commercial outreach.
- Autonomous sending remains disabled.
- Suppression, evidence, provenance, verified professional email, policy receipt, exact-revision approval and tenant isolation remain hard boundaries.
- CRM integrations must remain adapter-based and must not pretend to be connected before credentials/OAuth exist.

## Premium UX reset
The commercial UI is being benchmarked against Apollo, Clay, Common Room, Unify and iClosed for workflow clarity, information density, search/filter patterns, operating views, analytics and pipeline continuity. The product must remain distinct; benchmark patterns may be used, not copied branding or proprietary UI.

Required customer-facing language:
- Prefer Home, Leads, People, Messages, Pipeline, Find leads, Global Data, Analytics, Integrations, Team.
- Keep technical audit terms behind advanced/details surfaces unless required for safety.
- Every primary screen should answer what the user should do next.

### Mobile
- Mobile is a primary acceptance surface, not a shrunk desktop.
- Bottom navigation for the primary daily journey.
- No horizontal overflow in the signature journey.
- Primary CTA reachable without zooming or precision tapping.

## Operating layer
### Global Data
One workspace-scoped searchable source of truth for companies, people, messages and pipeline context.

### Saved views
Users can retain useful operating slices instead of rebuilding filters repeatedly.

### Analytics
Track the funnel from discovered/qualified lead → verified buyer → message ready/approved → pipeline stage, plus provider usage/cost visibility. Do not fabricate meetings, replies, attribution or revenue outcomes that are not actually captured.

### Team
Owner/Admin/Member/Viewer role model remains the initial commercial role system. No custom RBAC builder or multi-company billing in the current release.

### Integrations
Show honest states: connected, ready to configure, or planned. CRM contract supports HubSpot, Salesforce, Attio and Pipedrive adapters but a provider must not be shown as connected without a real configured connection.

## Current external blockers
- Live Crustdata endpoint/permission validation requires `CRUSTDATA_API_KEY` in the Revenue Agent Render service.
- Live Claude drafting requires `ANTHROPIC_API_KEY` in the Revenue Agent Render service.
- First 20 real DCL leads cannot be claimed until those provider credentials are configured and the controlled batch runs.
- Final jurisdiction-specific outreach policy/legal basis requires qualified review before production sending is enabled.

## Acceptance before calling sellable
- CI tests pass.
- Production build passes.
- Supabase migrations/RLS pass staging checks.
- Desktop, tablet and mobile core journey manually reviewed.
- No DCL hardcoding in the product shell.
- Plain-English user copy.
- No dead navigation.
- No fake connected integrations or fabricated data.
- No autonomous send.
- Real first controlled batch validated once provider keys exist.

## Explicit non-goals for current release
- Multi-company billing.
- Seat monetization.
- Custom enterprise RBAC builder.
- Scheduler product parity with iClosed.
- Fake inbox before a real messaging/reply channel exists.
- Dozens of shallow integrations.
