# QA Guide

This guide defines the minimum quality gate for production readiness without adding new product scope.

## Pre-Merge Checklist

- [ ] Relevant tests were added or updated for the changed behavior.
- [ ] External services are mocked in tests.
- [ ] No test requires real OpenAI, Twilio, Stripe, email, calling, property API, or production Supabase credentials.
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.
- [ ] User-facing behavior is preserved.
- [ ] Security-sensitive code avoids stack traces, secrets, and raw provider payloads in output.
- [ ] Persistence changes use repository/service boundaries.
- [ ] Documentation is updated when architecture, test commands, or release process changes.

## Regression Workflows

The following workflows are high-risk and should remain protected as the platform moves toward real customers:

- Seller authentication and protected route access.
- Dashboard loading.
- Deal opening from pipeline and search.
- Conversation inbox and thread loading.
- AI summary and follow-up draft generation.
- Task creation or update.
- Workflow approval state updates.
- Notification viewing, completion, and dismissal.
- Offer draft updates and offer calculation behavior.
- Repository reads and writes for deal-owned data.

## Manual Smoke Test

Use this checklist when a change touches broad UI flow or deployment configuration:

- Sign in with a test user.
- Confirm protected routes do not render app content while signed out.
- Load the executive dashboard.
- Open the pipeline board.
- Open a deal workspace.
- Search for a known seller or property.
- Open a conversation thread.
- Generate or preview AI-assisted text using mocked or non-production providers.
- View notification center state.
- Open workflow and offer surfaces for the selected deal.
- Sign out and verify app content is no longer accessible.

## Failure Handling

When tests fail:

- Reproduce with the smallest focused test command possible.
- Fix the behavior or the test expectation, not both blindly.
- Prefer service-level tests for business rules.
- Prefer component tests for visible behavior and user actions.
- Add regression coverage for any production-impacting defect.
- Do not skip tests unless the skipped risk is documented and approved.

## CI Recommendation

The release pipeline should block on:

- Dependency install.
- `npm run test:run`.
- `npm run build`.
- Future: linting once the existing lint baseline is production-ready.
- Future: coverage reporting for critical service and repository layers.
