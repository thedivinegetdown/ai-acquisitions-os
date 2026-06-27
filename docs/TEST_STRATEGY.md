# Test Strategy

AI Acquisitions OS should optimize for confidence in critical business workflows, not raw coverage percentage.

## Philosophy

- Protect customer-facing workflows first.
- Keep tests close to stable architecture boundaries.
- Mock external systems by default.
- Prefer deterministic tests over broad brittle tests.
- Test business logic in services and repositories.
- Test UI through user-visible behavior.
- Add regression tests when production risk is discovered.

## Test Layers

### Service Tests

Service tests should cover business rules, validation, orchestration, provider routing, fallback behavior, and safe error handling.

Priority services:

- Authentication and authorization.
- AI gateway and providers.
- Offer calculation and strategy services.
- Conversation services.
- Workflow engine.
- Notification services.
- Repository layer.

### Component Tests

Component tests should cover important user interactions without duplicating implementation details.

Priority surfaces:

- Pipeline board.
- Seller workspace.
- Conversation hub and thread.
- AI copilot.
- Executive dashboard.
- Notification center.
- Search command center.
- Offer builder.
- Property intelligence.
- Transaction management.

### Integration Tests

Integration tests should cover realistic workflows across several boundaries. These should be added incrementally after the core service and component seams are stable.

Priority workflows:

- Seller login.
- Dashboard load.
- Open deal.
- View conversation.
- Generate AI summary.
- Generate follow-up draft.
- Save task.
- Open workflow.
- View notifications.
- Graceful failure states.

### Function Tests

Netlify Function tests should verify:

- Method validation.
- Body parsing.
- Required field validation.
- Safe error responses.
- No stack trace leakage.
- No secret leakage.
- Provider calls are mocked.

## Coverage Goals

Near-term goals:

- Critical service and repository paths have focused tests.
- Shared security helpers have regression coverage.
- Main workflow components have practical render/action tests.
- AI, SMS, billing, email, calling, and property integrations are mocked.

Future goals:

- Add coverage reporting.
- Set thresholds for critical service and repository folders.
- Add browser end-to-end coverage for the highest-risk workflows.
- Add Supabase local integration tests once schema and RLS migrations are production-ready.

## Mocking Strategy

Mocks should exist at stable boundaries:

- Provider clients for OpenAI, Twilio, Stripe, email, calling, and property APIs.
- Repository modules for Supabase data access.
- Netlify Function helpers for request/response behavior.
- Browser APIs in `src/test/setup.js`.

Avoid mocking internal implementation details when a service or repository boundary can be used instead.

## PR-5 Baseline

PR-5 expands the automated baseline from a small set of utility, AI, offer, and dashboard tests into a broader regression suite covering:

- Auth and authorization foundations.
- Repository behavior.
- Conversation composition.
- Workflow approval guards.
- Notification state transitions.
- AI provider request routing.
- Netlify security helper behavior.
- Representative critical UI surfaces.

This is a foundation, not a full enterprise QA program. The next quality milestone should add CI enforcement, endpoint-level Netlify Function tests, and end-to-end coverage for login-to-workflow paths.
