# Browser acceptance — Revenue Agent

## Release viewports
- Desktop: 1440 × 900
- Tablet: 1024 × 768
- Mobile: 390 × 844

## Signature journey
Home → Leads → Lead detail → People → Messages → Pipeline.

Supporting destinations: Find leads, Global Data, Analytics, Integrations, Team, Offer profiles, Settings.

## UX acceptance
- Product shell says Revenue Agent, not DCL.
- Primary customer language is plain English: why now, who to contact, next step, message, pipeline.
- Technical audit language stays behind advanced/details surfaces unless necessary to explain a block.
- No generic admin-dashboard feel, placeholder cards, dead navigation or fake connection states.
- Each primary screen exposes one clear next action.
- Empty, partial, loading/read-failure and permission-limited states do not imply data that was not loaded.

## Mobile acceptance
- Fixed bottom navigation uses five daily destinations: Home, Leads, Messages, Pipeline, More.
- People remains reachable from More on mobile and remains a desktop primary destination.
- No horizontal page overflow at 390px.
- Cards and forms stack without clipped actions.
- Primary CTA remains reachable without zooming or precision tapping.
- Safe-area bottom padding is respected.
- No desktop sidebar squeezed into the phone viewport.

## Accessibility
- Keyboard-only navigation works for all primary actions.
- Visible focus state.
- Semantic links/buttons/forms.
- Status is not communicated by color alone.
- Content remains usable at 200% zoom.
- Reduced-motion preference is respected where motion is introduced.

## Auth journey
- Sign in.
- Create account uses a distinct form with email, password and confirmation.
- Forgot-password request gives a generic non-enumerating confirmation.
- Email callback supports token-hash and PKCE-code flows.
- Recovery routes to a dedicated new-password screen.
- Protected routes redirect unauthenticated users to login.

## Data and role states
Validate Owner/Admin/Member/Viewer behavior.
- Viewer is read-only.
- Member can research/work permitted operational surfaces.
- Owner/Admin manage offers, team, policy and approval.
- Team directory emails are visible only to Owner/Admin.
- Saved views remain workspace scoped; private views are owner-only unless shared.

## Safety acceptance
- No outbound sending path is enabled.
- Draft requires a verified professional business email.
- Suppression is enforced before draft/approval.
- Exact revision approval is preserved.
- Evidence/provenance remains inspectable.
- Approval does not mean send.
- Integrations page never labels an unconfigured provider as connected.

## Live-data acceptance
Once `CRUSTDATA_API_KEY` and `ANTHROPIC_API_KEY` exist in Revenue Agent staging:
1. Verify Crustdata account endpoints and Contact Enrich permission.
2. Run one controlled DCL offer-profile batch under 25 jobs / 25 contacts.
3. Confirm actual provider credits used are persisted.
4. Inspect first 20 real opportunities for job URL, fit reason, decision maker, verified work email and draft.
5. Confirm every draft remains held and sending remains disabled.
