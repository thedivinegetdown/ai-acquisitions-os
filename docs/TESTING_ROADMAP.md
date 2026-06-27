# Testing Roadmap

This roadmap defines the next phases for QA and release confidence after PR-5.

## Phase 1: CI Build/Test Enforcement

Goals:
- Block merge on build and test success.
- Ensure CI uses safe placeholder environment variables only.
- Add explicit `npm run test:run` and `npm run build` gating.

Actions:
- Confirm CI fails fast when tests or build fail.
- Add smoke-level gating for critical workflows if supported by current test stack.
- Document safe CI environment variable requirements clearly.

## Phase 2: Endpoint-Level Netlify Function Tests

Goals:
- Cover all Netlify Functions with focused request/response tests.
- Validate method guard behavior, input validation, safe error handling, and secret hygiene.

Actions:
- Add tests for each function endpoint, not just shared helpers.
- Mock external providers in function-level tests.
- Verify `success/error` conventions, invalid method handling, missing environment variable behavior, and no stack trace leakage.
- Add regression coverage for billing, AI, SMS, email, and auth-related function behavior.

## Phase 3: Playwright E2E Tests

Goals:
- Add browser-level coverage for login-to-workflow paths.
- Protect critical product surfaces with realistic end-to-end flow tests.

Actions:
- Define core E2E workflows: sign-in, dashboard load, open deal, conversation thread, AI fallback, and transaction review.
- Use browser automation for user interactions and visual regression smoke testing.
- Run E2E tests against a stable staging-like environment.

## Phase 4: Supabase Local / RLS Integration Tests

Goals:
- Validate Supabase integration and row-level security behavior in a local test harness.
- Protect tenant-scoped data access and authorization rules.

Actions:
- Introduce a local Supabase test harness or lightweight emulator.
- Add tests for authenticated data access, policy enforcement, and repo-level queries.
- Cover service-role function paths separately from client-side anon access.

## Phase 5: Coverage Thresholds

Goals:
- Enforce minimum coverage for critical service, repository, and workflow areas.
- Prevent regressions in safety-critical code.

Actions:
- Set coverage thresholds for folders such as `src/services`, `src/test`, `src/features`, and `netlify/functions`.
- Use CI failure on threshold regressions.
- Review thresholds periodically as test maturity improves.

## Phase 6: Release Regression Suite

Goals:
- Maintain a stable regression suite for production candidate releases.
- Provide fast feedback on regressions in critical workflows.

Actions:
- Define a release regression suite for top-priority user journeys.
- Keep the suite lean and deterministic.
- Run release regression tests before every production deployment.

## Release Blocker Checklist

Before a release candidate is approved, verify:

- [ ] Build passes.
- [ ] Tests pass.
- [ ] Authentication is verified for test users.
- [ ] AI fallback is verified when server-side AI is unavailable.
- [ ] SMS behavior is verified in test mode.
- [ ] Stripe test mode is verified with placeholder payment flows.
- [ ] No exposed secrets are present in code or logs.
- [ ] No failing critical workflows remain.
