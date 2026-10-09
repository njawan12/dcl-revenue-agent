# Browser Acceptance Protocol

This protocol is the final product-quality gate before a private staging preview is treated as demo-ready. It does not authorize public deployment or outbound delivery.

## Viewports

Exercise every primary surface at:
- Desktop: 1440 × 900
- Tablet: 1024 × 768
- Mobile: 390 × 844

## Primary journey

1. Sign in and land on Daily Command Center.
2. Identify the highest-priority account without opening a table or secondary screen.
3. Open Opportunity Intelligence and explain, from the visible UI alone: why now, commercial thesis, Fit/Need/Intent, score movement, evidence receipts, buyer readiness and next best action.
4. Prepare a held draft only when evidence and a verified professional buyer are present.
5. Open Held Outbox and inspect the exact revision, recipient receipt, evidence, suppression state and region-policy receipt.
6. Approve the exact revision as Owner/Admin and verify that it remains held and nothing is sent.
7. Move the account in native Pipeline and confirm the change appears in the opportunity timeline.
8. Open Discovery, Accounts, Contacts and Settings and verify that each is a real, coherent product surface.

## Truth-state matrix

For each applicable primary surface exercise:
- populated success
- legitimate empty
- loading/navigation transition
- read failure
- partial dependency failure
- Viewer permission state
- Member operator state
- Admin/Owner review state
- suppressed account/contact
- unverified professional email
- unresolved region or unverified policy basis
- stale/older account without versioned scoring history

A failed or partial read must never be rendered as a factual zero, empty dataset, verified state or outreach-ready state.

## Keyboard and accessibility

- Complete primary navigation without a pointer.
- Focus indicator is visible on links, buttons, inputs and selects.
- Focus order follows visual/information hierarchy.
- No keyboard trap in navigation, forms or held-outbox review.
- Controls have programmatic labels; state is not communicated by color alone.
- Reduced-motion preference does not remove necessary state feedback.
- At 200% zoom, primary actions and evidence remain usable without horizontal page scrolling (intentional horizontal navigation rail excepted on narrow layouts).

## Visual acceptance

Reject the candidate if any signature surface looks like a generic admin template, spreadsheet-first CRM or unfinished component-library demo.

Check:
- typography hierarchy is obvious within five seconds
- one dominant decision/action per region
- consistent spacing rhythm and panel treatment
- long company names, domains, evidence titles and buyer roles wrap cleanly
- 0, 1, 10 and 50+ item density remains legible
- empty/error/partial states look intentional rather than broken
- no cheap gradients, decorative AI effects or unexplained badges
- evidence/provenance is inspectable without overwhelming the commercial narrative

## Safety acceptance

The browser journey must demonstrate all of these simultaneously:
- no external provider send action exists
- approval is revision-bound
- approval requires Owner/Admin
- verified professional email is required
- suppression blocks readiness/review
- region-policy receipt blocks unresolved/unverified policy
- approval leaves the item held
- Viewer cannot mutate commercial state

## Evidence to capture

For the private staging acceptance record, capture screenshots of Command Center, Opportunity Intelligence, Held Outbox and Pipeline at desktop and mobile widths, plus notes for any failure/permission cases exercised. Record browser, commit SHA, staging database identifier, role/workspace used and pass/fail findings.

## Exit criterion

Browser acceptance passes only when there are no critical navigation, truthfulness, permission, tenant-isolation, evidence, approval or responsive defects. Cosmetic defects may be accepted only when documented and they do not undermine the premium demo experience.
