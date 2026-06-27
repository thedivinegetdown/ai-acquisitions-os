# E2E Test Plan

## Current Status

- No browser E2E framework is currently installed in the repository.
- The project uses Vitest for unit and component tests.
- Playwright or Cypress configuration files are not present.
- This plan is intentionally preparatory: it defines workflows, manual QA checks, and a future safe E2E path without adding brittle browser automation today.

## Objective

Prepare the codebase and documentation for future browser end-to-end tests while preserving existing functionality and avoiding live external service calls.

## Highest-Risk Workflows

1. User signs in
2. Dashboard loads
3. Pipeline Board loads
4. Deal Modal opens
5. Seller Workspace opens
6. Conversation thread loads
7. Reply box renders without sending automatically
8. AI Copilot loads
9. AI fallback works
10. Notification Center opens
11. Search/Command Center opens

## Manual QA Checklist by Workflow

### 1. User signs in

- Expected result: sign-in form accepts credentials and redirects to dashboard.
- Failure signs: sign-in form hangs, shows generic error, or stays on login page.
- Required test data: a known test user account.
- Mocking notes: use a test environment or mocked auth service when available.
- External services not to call: production Supabase, OpenAI, Twilio, Stripe.

### 2. Dashboard loads

- Expected result: dashboard panels render and summary counts appear.
- Failure signs: blank screen, loading spinner never resolves, or console auth errors.
- Required test data: test user with dashboard access and sample deals.
- Mocking notes: stub API responses or use seeded test dataset.
- External services not to call: live Supabase, production analytics, OpenAI.

### 3. Pipeline Board loads

- Expected result: board layout appears and deal cards are visible.
- Failure signs: board does not render, drag/drop fails, or missing lanes.
- Required test data: one or more active deals assigned to the test user.
- Mocking notes: mock repository reads if the test harness is not available.
- External services not to call: live Supabase, property APIs.

### 4. Deal Modal opens

- Expected result: selecting a deal opens the modal and displays deal details.
- Failure signs: modal fails to open, shows loading errors, or missing detail fields.
- Required test data: an active deal with associated metadata.
- Mocking notes: use local deal seed data or API stub.
- External services not to call: live Supabase, billing services.

### 5. Seller Workspace opens

- Expected result: seller workspace loads with profile, deals, and actions.
- Failure signs: workspace content is incomplete, broken navigation, or auth leaks.
- Required test data: a seller account and at least one associated deal.
- Mocking notes: stub service-level repository reads.
- External services not to call: live Supabase, Twilio, Stripe, OpenAI.

### 6. Conversation thread loads

- Expected result: conversation history appears and messages are readable.
- Failure signs: thread does not load, errors on message render, or missing sender info.
- Required test data: conversation thread with inbound/outbound messages.
- Mocking notes: handle message repository reads with deterministic fixtures.
- External services not to call: Twilio, OpenAI, email providers.

### 7. Reply box renders without sending automatically

- Expected result: reply editor is visible and user can type without submitting.
- Failure signs: reply box auto-sends, is disabled, or contains validation errors on load.
- Required test data: open conversation thread and reply-capable user state.
- Mocking notes: ensure submit action is not triggered by default.
- External services not to call: Twilio, Supabase write unless explicitly testing save behavior.

### 8. AI Copilot loads

- Expected result: AI Copilot component appears and can render suggested prompts or summaries.
- Failure signs: AI panel fails to render, shows provider errors, or blocks page load.
- Required test data: a demo conversation or deal context for the copilot.
- Mocking notes: use a local stub or fixture for AI responses.
- External services not to call: OpenAI, external AI providers.

### 9. AI fallback works

- Expected result: when AI config is unavailable, the fallback behavior appears safely.
- Failure signs: unhandled errors, raw provider messages, or crashes.
- Required test data: a scenario with missing AI configuration or test mode.
- Mocking notes: simulate missing `OPENAI_API_KEY` or provider failure.
- External services not to call: real OpenAI or external AI APIs.

### 10. Notification Center opens

- Expected result: notifications list is visible and actions are accessible.
- Failure signs: empty state misrenders, notifications fail to load, or stale state.
- Required test data: active notifications for the test user.
- Mocking notes: stub notification service responses or seed local data.
- External services not to call: live Supabase or external alerts provider.

### 11. Search/Command Center opens

- Expected result: search input is available and suggestions are shown.
- Failure signs: search UI does not open, input is disabled, or no results render.
- Required test data: searchable records in the test environment.
- Mocking notes: use static search fixtures or mocked repository responses.
- External services not to call: external property APIs, live search providers.

## E2E Framework Decision

- No Playwright or Cypress dependency is installed.
- No stable test auth/mocks are currently available for browser automation.
- Therefore, the current approach is planning and documentation only.

## Future Steps

1. Add Playwright or an equivalent E2E framework once a stable test auth path exists.
2. Build a dedicated staging fixture layer for test users and sample workspace data.
3. Mock external services at the browser boundary where possible.
4. Start with a small smoke suite for the highest-risk workflows.
