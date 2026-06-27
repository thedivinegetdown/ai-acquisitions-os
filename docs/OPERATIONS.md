# Operations

This document describes how AI Acquisitions OS is operated after deployment.

## Current Operational Model

AI Acquisitions OS currently uses lightweight internal observability:

- Client-side sanitized logging through `src/services/logging`.
- In-memory monitoring events through `src/services/monitoring`.
- Browser-safe integration readiness through `src/services/observability`.
- Netlify deploy and function logs for server-side runtime behavior.
- Supabase, Twilio, OpenAI, and Stripe provider dashboards for external service status.

No paid external monitoring provider is currently integrated.

## Logging

Client logging uses a central logger that redacts likely secret values and truncates long strings.

Operational rules:

- Do not log raw request bodies containing secrets, tokens, payment data, or private messages.
- Use structured metadata for operational context.
- Keep debug logs development-only.
- Review Netlify Function logs during deploy validation and incident response.

## Monitoring

The current monitoring service records recent local events in memory. It is useful for runtime diagnostics during a browser session, but it is not persistent and does not alert operators.

Current monitored areas:

- Netlify Function client calls.
- User action events where explicitly recorded.
- Integration status labels.
- Deal data completeness health.

Recommended no-cost improvements:

- Add deployment metadata such as commit SHA and build timestamp.
- Use the PR-7A `health-check` Netlify Function for server-side environment readiness.
- Add endpoint-level smoke tests for critical functions.
- Add CI artifact or release notes capture for build output.

## Health Checks

Current health checks are browser-safe and do not inspect server-only secrets.

Current health categories:

- Supabase client configuration.
- Netlify Functions base path.
- Twilio readiness as server-side unknown.
- OpenAI readiness as server-side unknown.
- Stripe readiness as server-side unknown.
- SMS logging readiness.
- AI fallback provider availability.
- Build/deployment readiness.

Because the browser cannot safely inspect server-only secrets, Twilio, OpenAI, and Stripe remain `Unknown` in browser health views until verified through Netlify environment configuration or the server-side health endpoint.

## Error Reporting

Current error reporting is limited to:

- Browser console logs.
- Netlify Function logs.
- Safe service result errors returned to UI.
- Test failures in CI.

Production incidents should capture:

- User-visible symptom.
- Timestamp and timezone.
- Deploy ID or commit SHA.
- Browser console error, if available.
- Netlify Function log excerpt, with secrets redacted.
- Supabase/Twilio/OpenAI/Stripe dashboard status, if relevant.

## Recovery Strategy

Primary recovery actions:

- Roll back the Netlify deploy to the last known-good deploy.
- Re-enable provider test mode where applicable.
- Disable risky provider actions by removing or rotating affected server-side credentials.
- Restore expected environment variables from the documented Netlify configuration.
- Use rule-based AI fallback if OpenAI is degraded.

Data recovery and provider-side state recovery must be handled separately from application deploy rollback.

## Operational Ownership

Every production release should identify:

- Release owner.
- Rollback owner.
- QA owner.
- Environment owner.
- Incident contact.

The same person may hold multiple roles for small releases, but each role should be explicitly assigned before deployment.
