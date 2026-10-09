# Change queue chronology and truthful urgency

Base: main `3796b97`; its CI passed. Existing activity/history implementation is present.

Assumptions: change materiality is decision support, not an outreach eligibility decision. Pipeline due dates are calendar dates using the queue's existing UTC day convention. Invalid/future observations must not manufacture urgency. Closed pipeline stages do not create due work.

Acceptance: invalid/future event times remain monitor-only; old evidence is described as old; today/overdue actions receive due credit, tomorrow does not; impossible calendar dates receive no due credit; won/lost history does not imply pending due work; evidence/buyer heuristics never claim full outreach eligibility. Preserve all tenant, approval, suppression, scoring and outbound boundaries. Regression tests and production build pass; final PR CI passes. Live staging/browser acceptance remains open.

Implemented: chronology validation, calendar-day due credit, closed-stage due exclusion, and evidence/buyer wording that does not imply outreach eligibility. Four regression cases added; full suite 73/73 passed. Local production build passed. No schema, tenant, permission, provider or send changes. Quality review: improves decision accuracy and explainability; existing conditional release score remains 87/100, with live staging/provider/browser gates still open.
