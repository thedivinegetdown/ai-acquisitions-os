# Release Checklist

This release checklist is intended for a final launch candidate review before deploying to production.

## Build and Test Validation

- [ ] `npm run build` passes successfully.
- [ ] `npm run test:run` passes successfully.
- [ ] No new build warnings or errors exist in the deployment logs.
- [ ] No exposed secrets or credential values appear in commit history, config files, or logs.

## Authentication and Access

- [ ] Sign in with a known test user and verify the session is created.
- [ ] Confirm protected routes redirect to login when signed out.
- [ ] Confirm authenticated users can access dashboard and protected product areas.
- [ ] Confirm sign-out returns the user to the expected landing or login screen.

## Environment and Integrations

- [ ] Frontend environment variables are present and correctly scoped (`VITE_*` for client).
- [ ] Server-side Netlify environment variables are configured for Supabase, Twilio, OpenAI, and Stripe.
- [ ] Supabase environment is verified and the service role key is not exposed in client bundles.
- [ ] Twilio test credentials are verified and SMS outbound logic is safe in test mode.
- [ ] OpenAI environment is verified and AI fallback behavior is confirmed when the key is missing.
- [ ] Stripe test environment is verified and checkout/billing portal actions are using test keys.
- [ ] Netlify Functions are deployed and reachable from the app.

## API and Function Safety

- [ ] Confirm Netlify Functions return safe error responses when required variables are missing.
- [ ] Confirm inbound SMS endpoint rejects non-POST methods safely.
- [ ] Confirm outbound SMS endpoint handles missing Twilio or Supabase config without crashing.
- [ ] Confirm AI endpoints handle provider failures and return fallback-safe values.
- [ ] Confirm no stack traces or raw provider secrets flow back to the browser.

## Critical Workflow Validation

- [ ] Dashboard loads and renders summary cards.
- [ ] Pipeline board loads deal cards and selection controls.
- [ ] Deal modal opens and displays deal details.
- [ ] Conversation thread loads and reply input is functional.
- [ ] AI Copilot panel loads and shows fallback content if AI is unavailable.
- [ ] Notification center loads and can open warning items.
- [ ] Search/Command palette opens and can filter commands.
- [ ] Billing and Stripe actions are not executed against live production data in test/staging.

## Manual QA Notes

For each validated workflow, capture:

- Expected success result.
- Failure symptoms or errors.
- Test data used.
- Whether external services were mocked or in test mode.

## Launch Approval

- [ ] Release candidate is approved by the product and engineering lead.
- [ ] All critical blockers have been resolved, or a documented mitigation is in place.
- [ ] Rollback plan is reviewed and understood.
- [ ] Post-launch monitoring signals are identified and ready.
