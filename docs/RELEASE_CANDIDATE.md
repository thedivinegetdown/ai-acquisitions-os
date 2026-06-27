# Release Candidate

This document defines the Release Candidate readiness posture for AI Acquisitions OS after PR-7A.

## Release Candidate Goal

Release Candidate status means the application is ready for final launch audit, staging validation, and production approval. It does not mean all future production improvements are complete.

## Required Automated Gates

The following commands must pass on the release candidate commit:

```bash
npm run lint
npm run test:run
npm run build
```

GitHub CI runs the same core gates with safe placeholder client environment variables.

## Current RC-Critical Coverage

- Production build validation.
- Unit and component regression tests.
- Netlify Function endpoint safety tests.
- Server-side health endpoint safety tests.
- Lint enforcement with environment-aware browser, test, and Netlify Function configuration.
- Version metadata prepared for `1.0.0`.
- Deployment, operations, release process, and production runbook documentation.

## Browser E2E Foundation

The repository has an `e2e` folder reserved for browser end-to-end tests. PR-7A does not add Playwright or Cypress because stable test auth and backend isolation are not yet available.

Before adding browser automation:

1. Define a deterministic test auth path.
2. Use test/staging Supabase data or mocked service responses.
3. Keep Twilio, OpenAI, Stripe, email, and calling providers in test mode or mocked.
4. Cover only launch-critical flows first.

Recommended first automated E2E flows:

- Sign-in and protected route behavior.
- Executive dashboard loads.
- Pipeline board renders deal cards.
- Deal modal opens from a selected deal.
- Conversation inbox and thread render.
- AI Copilot returns fallback-safe content.
- Command/search opens a matching record.

Until browser automation is added, these flows remain required manual smoke checks before production release.

## Lint Debt

`npm run lint` passes, but warnings remain from existing React hook and fast-refresh rules.

Remaining warning categories:

- Async loader functions referenced inside effects.
- Missing effect dependencies.
- Synchronous state updates inside effects.
- Locally declared render helper components.
- Files exporting both components and helper values.

These warnings should be addressed incrementally in PR-7B or later, with focused tests around affected workflows.

## RC Blocker Policy

Block Release Candidate promotion for:

- Build failure.
- Test failure.
- Lint errors.
- Health endpoint exposing secret values.
- Missing required production environment variables.
- Unsafe SMS, AI, Stripe, or Supabase behavior in staging.
- Authentication or protected route regression.

Warnings and documented operational gaps may proceed only with release owner approval.

## Current Status

AI Acquisitions OS is eligible for Release Candidate review after PR-7A, subject to final staging validation and approval before PR-7B.

