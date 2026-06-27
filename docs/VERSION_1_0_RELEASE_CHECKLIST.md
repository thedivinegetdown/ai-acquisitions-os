# Version 1.0 Release Checklist

## Automated Gates

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm run lint` passes.
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.
- [ ] CI passes on the release commit.

## Versioning

- [ ] `package.json` version is `1.0.0`.
- [ ] `package-lock.json` version is `1.0.0`.
- [ ] Release Candidate tag is created as `v1.0.0-rc.1`.
- [ ] Final production tag is planned as `v1.0.0`.

## Environment

- [ ] `VITE_SUPABASE_URL` configured.
- [ ] `VITE_SUPABASE_ANON_KEY` configured.
- [ ] `VITE_NETLIFY_FUNCTIONS_BASE` configured or default accepted.
- [ ] `SUPABASE_URL` configured in Netlify.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured in Netlify.
- [ ] `OPENAI_API_KEY` configured or AI fallback launch accepted.
- [ ] Twilio credentials configured or SMS test mode accepted.
- [ ] Stripe credentials configured for intended test/production mode.
- [ ] Server-only secrets are not committed or exposed in client bundles.

## Health And Operations

- [ ] `/.netlify/functions/health-check` returns expected readiness status.
- [ ] Netlify Functions are reachable.
- [ ] Rollback target is identified in Netlify deploy history.
- [ ] Release owner assigned.
- [ ] Rollback owner assigned.
- [ ] Incident contact assigned.

## Manual Smoke Tests

- [ ] App shell loads.
- [ ] Sign-in works with a known test user.
- [ ] Protected route behavior works when signed out.
- [ ] Executive dashboard renders.
- [ ] Pipeline board renders deal cards.
- [ ] Deal modal opens.
- [ ] Conversation inbox and thread load.
- [ ] AI Copilot returns provider or fallback-safe output.
- [ ] Notification center renders.
- [ ] Command/search opens a matching record.
- [ ] SMS behavior is safe for the selected release mode.
- [ ] Stripe behavior is safe for the selected release mode.

## Approval

- [ ] Architecture, security, testing, deployment, and operations findings reviewed.
- [ ] Technical debt register accepted by release owner.
- [ ] Production readiness report accepted.
- [ ] Final go/no-go decision recorded.

