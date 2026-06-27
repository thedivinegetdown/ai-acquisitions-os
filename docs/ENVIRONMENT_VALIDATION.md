# Environment Validation

This document lists the environment variables and deployment validation steps required for launch.

## Required Frontend Environment Variables

These variables must be prefixed with `VITE_` and are safe for client use.

- `VITE_SUPABASE_URL` - Supabase project URL for the browser client.
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key for public client operations.
- `VITE_NETLIFY_FUNCTIONS_BASE` - Optional base path for Netlify Functions. Defaults to `/.netlify/functions`.

## Required Server-Only Environment Variables

These variables must remain private and only exist in Netlify environment configuration.

### Supabase
- `SUPABASE_URL` - Server-side Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for privileged server operations.
- `SUPABASE_ANON_KEY` - Optional server-side fallback anon key; do not expose to client.

### Twilio
- `TWILIO_ACCOUNT_SID` - Twilio account SID.
- `TWILIO_AUTH_TOKEN` - Twilio auth token.
- `TWILIO_PHONE_NUMBER` - Twilio outbound phone number.
- `TWILIO_PHONE` - Legacy local fallback phone number; prefer `TWILIO_PHONE_NUMBER` for production.
- `SMS_TEST_MODE` - `true` or `false` to control test-mode behavior.

### OpenAI
- `OPENAI_API_KEY` - Server-side OpenAI API key.
- `OPENAI_MODEL` - Optional OpenAI model override for Netlify Functions.

### Stripe
- `STRIPE_SECRET_KEY` - Server-side Stripe secret key for test/payment requests.
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret.
- `STRIPE_PRICE_STARTER` - Stripe price ID for the Starter plan.
- `STRIPE_PRICE_GROWTH` - Stripe price ID for the Growth plan.
- `STRIPE_PRICE_PRO` - Stripe price ID for the Pro plan.
- `STRIPE_PRICE_ENTERPRISE` - Optional Stripe price ID for the Enterprise plan.

### Netlify / App
- `APP_URL` - Optional canonical app URL for hosted Stripe return URLs and links.

## Optional Environment Variables

These values are optional and may be used for local testing or future provider integrations.

- `PROPERTY_DATA_PROVIDER`
- `PROPERTY_DATA_API_KEY`
- `PROPERTY_DATA_API_BASE_URL`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_WEBHOOK_SECRET`
- `CALLING_PROVIDER`
- `CALLING_API_KEY`
- `CALLING_ACCOUNT_ID`
- `CALLING_WEBHOOK_SECRET`

## Local Development Setup

1. Copy `.env.example` to `.env.local` or `.env` as a local template.
2. Set client variables prefixed with `VITE_`.
3. Set required server-side values only if local Netlify Functions or local test servers need them.
4. Start the app with `npm run dev`.
5. Verify local app startup logs do not expose secrets.
6. Confirm the browser can access `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for public data queries.

> Note: Do not commit `.env.local`, `.env`, or any files containing real credentials.

## Netlify Deployment Setup

1. Ensure Netlify is connected to the repository.
2. Configure Netlify build settings to run `npm install` and `npm run build`.
3. Add required environment variables in Netlify site settings.
4. Verify Netlify Functions are deployed from `netlify/functions`.
5. Confirm `APP_URL` is set for hosted Stripe return URLs if billing is enabled.
6. Confirm server-only keys are not exposed to the client or in build artifacts.

## Test / Staging Setup

1. Use separate Netlify site or branch deploy for staging.
2. Configure staging environment variables with test-mode values.
3. Verify Twilio and Stripe use test credentials whenever possible.
4. Verify OpenAI staging keys are set if AI testing is required.
5. Run `npm run build` in the staging environment and verify it succeeds.
6. Run `npm run test:run` in staging or locally against staging-like configuration.

## Production Setup

1. Confirm production Netlify environment variables are set correctly and private.
2. Confirm `SMS_TEST_MODE` is set to the expected value for the chosen release stage.
3. Confirm Stripe keys are production or test keys as intended for the launch stage.
4. Confirm OpenAI keys are scoped to the production app and not stored in source control.
5. Confirm `SUPABASE_SERVICE_ROLE_KEY` is never present in frontend code.
6. Validate deployment by running production build and smoke tests.

## Validation Checklist

- [ ] Required frontend variables are configured.
- [ ] Required server-only variables are configured and private.
- [ ] Optional variables are documented and not required for launch.
- [ ] Local development works with the template environment.
- [ ] Netlify deployment settings match this document.
- [ ] Test/staging environment uses isolated test credentials.
- [ ] Production environment has a rollback-ready configuration.
