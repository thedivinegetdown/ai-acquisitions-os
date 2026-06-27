# Release Regression Checklist

This checklist captures the highest-risk manual regression checks to run before a production release candidate.

## Authentication and Access

- [ ] Sign in with a known test user.
- [ ] Confirm protected routes redirect to login when signed out.
- [ ] Verify dashboard access after sign-in.

## Core Workflow Surfaces

- [ ] Dashboard loads and renders summary tiles.
- [ ] Pipeline Board loads with deal cards.
- [ ] Deal Modal opens and shows deal details.
- [ ] Seller Workspace opens with seller context.
- [ ] Conversation thread loads and displays messages.
- [ ] Reply box renders without auto-submitting.
- [ ] AI Copilot panel loads.
- [ ] AI fallback path shows a safe fallback response when AI is unavailable.
- [ ] Notification Center opens and lists notifications.
- [ ] Search/Command Center opens and accepts queries.

## Manual QA Validation Notes

For each workflow:
- Expected result: describe the visible success condition.
- Failure signs: note the exact UI or error symptoms.
- Required test data: identify the seed user, deal, or notification state.
- Mocking notes: note whether the workflow should use a mocked backend or stubbed service.
- External services not to call: do not call production Supabase, OpenAI, Twilio, Stripe, email, or property APIs.

## AI and Safety

- [ ] Confirm AI panels do not expose raw provider errors.
- [ ] Confirm fallback behavior is shown when `OPENAI_API_KEY` or AI configuration is missing.
- [ ] Confirm no secret material appears in UI error messages.

## Payment and SMS

- [ ] Confirm Stripe checkout/billing portal actions are not run against live production payment data.
- [ ] Confirm SMS-related UI or function calls use test mode or mocked requests.
- [ ] Confirm email compose validates recipients without sending live email if provider is not configured.

## Release Readiness

- [ ] `npm run build` passes.
- [ ] `npm run test:run` passes.
- [ ] No new failing critical workflows remain.
- [ ] No secrets are exposed in repository or logs.
