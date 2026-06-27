# Observability Plan

## Goal

Give AI Acquisitions OS an internal health and readiness layer before full SaaS launch, without adding paid monitoring providers or exposing secrets.

## Current Foundation

Epic 26 adds observability services under `src/services/observability`:

- `healthCheckService`: aggregates integration, usage, event, and readiness health.
- `integrationStatusService`: reports integration status labels and required environment variable names.
- `systemEventService`: exposes recent local monitoring/system events.
- `usageHealthService`: checks loaded deal data completeness.

The current implementation is browser-safe and does not inspect server-only secret values.

## Status Labels

The health center uses simple labels:

- Healthy
- Warning
- Error
- Not configured
- Unknown

Server-side-only integrations such as Twilio, OpenAI, and Stripe are marked `Unknown` from the browser unless a future secure server health endpoint is added.

## Covered Areas

- Supabase
- Twilio
- OpenAI
- Stripe
- Netlify Functions
- SMS logging
- AI fallback provider
- Build/deployment readiness
- Deal data completeness

## Security Rules

- Never display secret values.
- Display environment variable names only.
- Do not call paid monitoring providers yet.
- Do not change AI, SMS, Stripe, email, or calling behavior from health checks.
- Future server-side health endpoints should return boolean readiness only.

## Future Work

- Add a secure Netlify `health-check` function for server-side env readiness.
- Add Supabase table access smoke checks.
- Add Twilio test-mode verification.
- Add OpenAI fallback/provider availability checks.
- Add Stripe webhook readiness checks.
- Add deployment metadata such as commit SHA and build timestamp.
- Add external monitoring only after SaaS operational requirements are approved.
