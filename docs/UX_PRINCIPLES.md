# UX Principles

## Standard
The product must be competitive with modern GTM platforms while feeling simpler and more decisive. It should not look or behave like an internal admin panel.

## Core principle
Optimize for **time to useful decision**.

The user should understand within seconds:
- what deserves attention;
- why it matters;
- what changed;
- who to contact;
- what action to take next.

## Information architecture
Primary navigation should converge on a small number of jobs:
1. Command Center
2. Opportunities
3. Accounts
4. Contacts / Buyer Maps
5. Outreach
6. Pipeline
7. Signals / Research
8. Integrations
9. Settings / Knowledge

Avoid creating a nav item for every database table.

## Daily Command Center
This is the default landing experience.

Prioritize:
- new high-priority opportunities;
- opportunity score changes;
- new signals on existing accounts;
- warm reactivations;
- drafts awaiting approval;
- follow-ups due;
- replies needing action;
- meetings/opportunities created.

The page should answer "what should I do today?" rather than "what data exists?"

## Opportunity Page
The first viewport should include:
- account identity and commerce context;
- Opportunity Score with explainability affordance;
- one-sentence `Why now`;
- recommended service/motion;
- primary buyer status;
- next action.

Below that, use progressive disclosure for:
- evidence receipts;
- scores and contributing factors;
- signal timeline;
- storefront findings;
- technology stack;
- buyer candidates;
- outreach sequence;
- CRM/pipeline history.

## Evidence UX
Every consequential claim should be inspectable.
Evidence display should include where available:
- source;
- observed date;
- confidence;
- what was observed;
- how it affected qualification.

Do not overwhelm users with evidence until they request detail.

## Visual design
- Premium B2B SaaS, not flashy AI gimmicks.
- Strong hierarchy and spacing.
- Clear typography.
- Restrained use of color; color must communicate state or priority.
- Avoid excessive cards, gradients, glows and decorative AI motifs.
- Tables are allowed for scanning large result sets but are not the primary storytelling surface.
- Use consistent status chips, score presentation and action patterns.
- Design skeleton/loading, empty, error, stale and partial-data states.

## Interaction design
- Common actions should require at most one or two intentional clicks.
- Batch actions should exist where they save meaningful operator time.
- Never hide why an action is disabled.
- Expensive/provider-consuming actions should disclose cost/credit implications when meaningful.
- Destructive/suppression actions require clear confirmation.
- AI draft regeneration must retain auditability and not silently replace approved content.

## AI UX
AI should behave like an analyst/copilot, not a chatbot pasted into a sidebar.

Useful interactions:
- "Why is this account ranked highly?"
- "What changed?"
- "Find similar accounts."
- "Show beauty brands with subscription friction and recent ecommerce hiring."
- "What evidence supports this draft?"

AI answers should link back to product objects and evidence.

## Accessibility and responsiveness
- Keyboard-friendly primary workflows.
- Visible focus states.
- Semantic controls and labels.
- WCAG-aware contrast.
- Desktop-first for operator density, but usable on tablet/mobile for reviewing/reply triage.

## Quality bar
Do not merge a customer-facing screen if it still feels like scaffolding, mock data, placeholder UX or a developer admin console.
