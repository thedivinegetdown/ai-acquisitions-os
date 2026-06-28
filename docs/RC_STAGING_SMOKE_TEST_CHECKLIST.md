# Release Candidate Staging Smoke Test Checklist

AI Acquisitions OS `v1.0.0-rc.1`

Use this checklist to validate the release candidate in staging before pushing the release candidate tag to GitHub or promoting to production.

Tester:

Environment:

Staging URL:

Date:

Commit / Tag:

Browser / Device:

## 1. Authentication

- [ ] Pass / [ ] Fail - Sign in succeeds with a valid staging user.
- [ ] Pass / [ ] Fail - Invalid credentials show a safe, understandable error.
- [ ] Pass / [ ] Fail - Sign out clears the active session and returns to the expected unauthenticated state.
- [ ] Pass / [ ] Fail - Session persists after refresh.
- [ ] Pass / [ ] Fail - Protected routes redirect or block access when signed out.

Notes:

## 2. Dashboard

- [ ] Pass / [ ] Fail - Dashboard loads without console errors.
- [ ] Pass / [ ] Fail - Metrics display expected values from staging data.
- [ ] Pass / [ ] Fail - Dashboard sections render without blank panels.
- [ ] Pass / [ ] Fail - Navigation between dashboard-related panels works.

Notes:

## 3. Pipeline Board

- [ ] Pass / [ ] Fail - Deals load on the pipeline board.
- [ ] Pass / [ ] Fail - Deal cards show key fields.
- [ ] Pass / [ ] Fail - Moving deals between stages works or fails safely if disabled by staging data.
- [ ] Pass / [ ] Fail - Opening a deal displays the deal modal/workspace.
- [ ] Pass / [ ] Fail - Refreshing preserves expected pipeline state.

Notes:

## 4. Seller Workspace

- [ ] Pass / [ ] Fail - Seller details load for a selected deal.
- [ ] Pass / [ ] Fail - Activity timeline renders.
- [ ] Pass / [ ] Fail - Intelligence panels render without blocking the page.
- [ ] Pass / [ ] Fail - Seller tasks load.
- [ ] Pass / [ ] Fail - Creating or updating tasks works, or staging limitations are clearly documented.

Notes:

## 5. Conversations

- [ ] Pass / [ ] Fail - Conversation inbox loads.
- [ ] Pass / [ ] Fail - Selecting a conversation opens the thread.
- [ ] Pass / [ ] Fail - Thread messages render in the expected order.
- [ ] Pass / [ ] Fail - Reply box is visible and usable.
- [ ] Pass / [ ] Fail - Empty or missing conversation states are handled safely.

Notes:

## 6. SMS

- [ ] Pass / [ ] Fail - Outbound SMS request uses staging/test-mode configuration.
- [ ] Pass / [ ] Fail - Outbound SMS returns success or safe test-mode response.
- [ ] Pass / [ ] Fail - Inbound SMS webhook is reachable in staging.
- [ ] Pass / [ ] Fail - Inbound SMS rejects invalid or unsupported methods safely.
- [ ] Pass / [ ] Fail - SMS logs are written or safe fallback behavior is confirmed.
- [ ] Pass / [ ] Fail - No live unintended SMS is sent during validation.

Notes:

## 7. AI Copilot

- [ ] Pass / [ ] Fail - Copilot chat accepts a prompt and returns a response or safe fallback.
- [ ] Pass / [ ] Fail - Seller summary renders.
- [ ] Pass / [ ] Fail - Deal analysis renders.
- [ ] Pass / [ ] Fail - Missing or unavailable OpenAI configuration triggers fallback behavior.
- [ ] Pass / [ ] Fail - AI responses do not expose secrets, raw stack traces, or unsafe provider errors.

Notes:

## 8. Offer System

- [ ] Pass / [ ] Fail - Offer readiness panel loads.
- [ ] Pass / [ ] Fail - Offer range displays expected calculations.
- [ ] Pass / [ ] Fail - Offer strategy renders recommendations.
- [ ] Pass / [ ] Fail - Missing deal data is handled with clear guidance.

Notes:

## 9. Property Intelligence

- [ ] Pass / [ ] Fail - Property intelligence panel loads.
- [ ] Pass / [ ] Fail - Manual or mock provider output renders.
- [ ] Pass / [ ] Fail - Property inputs can be edited.
- [ ] Pass / [ ] Fail - Missing provider configuration does not crash the workflow.

Notes:

## 10. Buyer CRM

- [ ] Pass / [ ] Fail - Buyer CRM / buyer board loads.
- [ ] Pass / [ ] Fail - Buyer records display expected fields.
- [ ] Pass / [ ] Fail - Buyer matching panel renders for a deal.
- [ ] Pass / [ ] Fail - Buyer disposition workflows render or fail safely.

Notes:

## 11. Transaction Management

- [ ] Pass / [ ] Fail - Transaction management panel loads.
- [ ] Pass / [ ] Fail - Transaction status and checklist data render.
- [ ] Pass / [ ] Fail - Document/contract preparation panels render.
- [ ] Pass / [ ] Fail - Missing transaction data shows a safe empty state.

Notes:

## 12. Notifications

- [ ] Pass / [ ] Fail - Notification center loads.
- [ ] Pass / [ ] Fail - Notifications show priority/status correctly.
- [ ] Pass / [ ] Fail - Opening a notification navigates to or identifies the related context.
- [ ] Pass / [ ] Fail - Dismiss/complete/snooze actions work or fail safely.

Notes:

## 13. Search / Command Center

- [ ] Pass / [ ] Fail - Search / command center opens.
- [ ] Pass / [ ] Fail - Searching by seller, address, phone, or task returns expected matches.
- [ ] Pass / [ ] Fail - Selecting a result opens the expected record/context.
- [ ] Pass / [ ] Fail - Empty searches and no-result states are handled clearly.

Notes:

## 14. Settings

- [ ] Pass / [ ] Fail - Organization settings load.
- [ ] Pass / [ ] Fail - Team roles panel loads.
- [ ] Pass / [ ] Fail - Billing/subscription panel loads.
- [ ] Pass / [ ] Fail - SaaS readiness panel loads.
- [ ] Pass / [ ] Fail - Settings changes are saved or staging limitations are documented.

Notes:

## 15. Error Handling

- [ ] Pass / [ ] Fail - Missing staging environment variables produce safe errors.
- [ ] Pass / [ ] Fail - API/function failures do not crash the full app.
- [ ] Pass / [ ] Fail - Browser console contains no unexpected errors during core workflows.
- [ ] Pass / [ ] Fail - User-facing errors are understandable and do not expose secrets.
- [ ] Pass / [ ] Fail - Netlify Function responses avoid stack traces and raw provider errors.

Notes:

## 16. Mobile Responsiveness

- [ ] Pass / [ ] Fail - App shell is usable on mobile viewport.
- [ ] Pass / [ ] Fail - Dashboard remains readable.
- [ ] Pass / [ ] Fail - Pipeline board remains usable or has an acceptable mobile fallback.
- [ ] Pass / [ ] Fail - Deal modal/workspace does not overflow unusably.
- [ ] Pass / [ ] Fail - Conversation thread and reply box remain usable.

Notes:

## 17. Performance Observations

- [ ] Pass / [ ] Fail - Initial page load is acceptable for staging.
- [ ] Pass / [ ] Fail - Dashboard and pipeline interactions feel responsive.
- [ ] Pass / [ ] Fail - Lazy-loaded panels resolve without excessive delay.
- [ ] Pass / [ ] Fail - No obvious memory or repeated-render issue appears during smoke testing.
- [ ] Pass / [ ] Fail - Network requests are reasonable for the tested workflows.

Notes:

## 18. Known Limitations

- [ ] Acknowledged - Browser E2E automation is not yet implemented.
- [ ] Acknowledged - Supabase RLS/tenant isolation still needs automated integration coverage.
- [ ] Acknowledged - Health endpoint checks environment presence, not provider connectivity.
- [ ] Acknowledged - Persistent production monitoring/alerting is not integrated.
- [ ] Acknowledged - Some React hook lint warnings remain as documented technical debt.
- [ ] Acknowledged - Staging SMS, Stripe, and provider modes must be manually verified before production promotion.

Notes:

## Final Staging Decision

- [ ] Approved for RC tag push.
- [ ] Approved with follow-up fixes.
- [ ] Blocked.

Blocking issues:

Follow-up issues:

Release owner approval:

QA / validator approval:

