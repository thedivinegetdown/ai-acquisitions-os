# Deployment

This document defines the production deployment model for AI Acquisitions OS.

## Deployment Target

The supported production target is Netlify.

Required Netlify settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Functions bundler: `esbuild`

These settings are also captured in `netlify.toml`.

## Build Pipeline

The application is built with Vite. A production build must be reproducible from a clean checkout with:

```bash
npm ci
npm run build
```

The build emits static client assets to `dist` and bundles Netlify Functions from `netlify/functions`.

## CI/CD

GitHub Actions runs on pull requests and pushes to `main` or `master`.

Current required checks:

- `npm ci`
- `npm run test:run`
- `npm run build`

CI uses placeholder client-safe variables and does not require real Supabase, Twilio, OpenAI, or Stripe secrets.

## Environment Variables

Client variables must use the `VITE_` prefix:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_NETLIFY_FUNCTIONS_BASE`

Server-only variables must be configured in Netlify and must never be committed:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SMS_TEST_MODE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `APP_URL`

The full environment reference lives in `docs/ENVIRONMENT_VARIABLES.md`.

## Environment Strategy

Development:

- Uses local `.env` or `.env.local`.
- May omit server-only provider secrets if Netlify Functions are not being exercised.
- Should run `npm run dev` for local UI work.

Testing:

- Uses safe placeholder client variables.
- Must not require production provider secrets.
- Runs `npm run test:run` and `npm run build`.

Staging:

- Should use a separate Netlify site or branch deploy.
- Must use test-mode Twilio, OpenAI, Stripe, and Supabase credentials where available.
- `SMS_TEST_MODE` should remain enabled unless explicitly validating controlled SMS behavior.

Production:

- Must use production Netlify environment variables.
- Must confirm server-only values are not exposed in browser bundles or logs.
- Must have a rollback owner and rollback target identified before deploy.

## Deployment Verification

Before promoting a deployment:

- Run `npm run test:run`.
- Run `npm run build`.
- Confirm Netlify deploy succeeds.
- Confirm Netlify Functions are reachable.
- Confirm `/.netlify/functions/health-check` returns the expected readiness status.
- Smoke test authentication, dashboard, pipeline board, deal modal, conversation thread, AI fallback, notifications, and command palette.
- Confirm SMS, OpenAI, and Stripe are using the intended test or production mode.

## Rollback

The primary rollback mechanism is Netlify deploy rollback:

1. Identify the last known-good deploy in Netlify.
2. Restore that deploy from Netlify deploy history.
3. Confirm the application loads and critical workflows work.
4. Confirm function invocations return to expected behavior.
5. Document the failed deploy, commit SHA, failure symptoms, and rollback time.

Database or provider configuration changes must be reviewed separately before rollback because Netlify deploy rollback does not revert external state.
