# Launch Readiness

This launch readiness document summarizes current readiness, blockers, and launch plan items.

## Current Readiness Score

- Baseline readiness score: `72 / 100`
- Source: `docs/PRODUCTION_READINESS_SCORECARD.md`
- This score reflects the current state of authentication, security, testing, CI/CD, and deployment readiness after the latest baseline assessment.

## Remaining Blockers

- Supabase local/RLS integration harness is not fully validated.
- Browser E2E suite is not implemented; manual smoke validation is required.
- Role/tenant authorization and row-level security (RLS) require additional real-backend validation.
- Lint enforcement is not yet mandatory in CI.
- Observability and external monitoring provider integration are not connected.
- Stripe and billing workflows are not fully production hardened; use test credentials until billing enforcement is approved.

## Nice-to-Have Improvements

- Add browser E2E tests for critical user flows.
- Add a Supabase local test harness and RLS regression coverage.
- Enforce linting and coverage thresholds in CI.
- Add a secure server health endpoint for Netlify Functions.
- Add dedicated production monitoring and alerting providers.
- Expand AI fallback coverage across all copilot workflows.

## Manual QA Checklist

- [ ] Run `npm run build` and verify the production build completes.
- [ ] Run `npm run test:run` and verify all tests pass.
- [ ] Verify netlify function endpoints are reachable in the deployed environment.
- [ ] Verify the authentication flow and protected routes work for signed-in and signed-out users.
- [ ] Verify Supabase environment variables are configured and service role keys remain private.
- [ ] Verify Twilio staging/test mode behavior and safe SMS fallback.
- [ ] Verify OpenAI server-side configuration and AI fallback when `OPENAI_API_KEY` is missing.
- [ ] Verify Stripe test setup and that payment actions do not run against live data in validation.
- [ ] Verify no secrets are exposed in browser bundles, config files, or deployment logs.
- [ ] Validate critical workflows: dashboard, pipeline board, deal modal, conversation thread, AI copilot, notifications, and command palette.
- [ ] Validate manual rollback and deployment revert steps with the release owner.

## Rollback Plan

- If the release presents critical issues, revert the Netlify deploy to the previous stable deploy.
- Keep latest working build artifacts and environment config documented.
- If a rollback is needed, mark the release as blocked and update the release owner with the rollback reason.
- Confirm the previous deployment remains available and restore it through Netlify deploy history.
- Review logs for the failed deploy before retrying.

## Post-Launch Monitoring Checklist

- [ ] Confirm the deployment is live and the app is serving expected traffic.
- [ ] Confirm no errors appear in browser console or initial user-facing logs.
- [ ] Monitor Netlify deploy status and function invocation success rates.
- [ ] Monitor Supabase access and any unexpected authorization failures.
- [ ] Monitor AI fallback behavior for missing OpenAI provider responses.
- [ ] Monitor SMS inbound/outbound request handling for errors.
- [ ] Monitor billing/Stripe webhook receipts and checkout status if billing is active.
- [ ] Confirm no secret leakage appears in logs or deployment metadata.
