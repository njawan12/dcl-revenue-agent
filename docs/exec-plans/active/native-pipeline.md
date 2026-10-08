# Native pipeline slice

Assumptions: one native pipeline record per account; currency/value, owners and CRM sync follow in later slices. Manual stages record operator decisions, never imply that this product sent a message. Existing admin mutation permissions are preserved.

Acceptance: workspace-backed Pipeline destination; stage and next action editable by owner/admin; viewer/member read-only; optimistic revision check; atomic immutable activity receipt; suppressed accounts cannot advance; held approvals do not change pipeline stage; Command Center surfaces due actions. Tests and production build pass before completion. Live authenticated DB/browser checks remain required for release.

Implemented: native stages and next actions, optimistic atomic save with immutable event receipts, suppression guard, due-action Command Center queue, truthful limited readiness count, real navigation. Unsupported navigation removed. Added locked dependencies and patched PostCSS override; CI uses npm ci. 39 tests pass. Local production build passed with the patched dependency. No external sending enabled. Migration 012 must be applied and exercised against an authenticated database before release. Currency/value, tasks beyond next action, ownership and CRM sync are outstanding.
