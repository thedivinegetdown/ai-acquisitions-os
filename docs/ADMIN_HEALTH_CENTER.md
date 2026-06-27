# Admin Health Center

## Purpose

The Admin Health Center gives operators a read-only snapshot of system readiness, integration configuration, operational warnings, and recommended admin actions.

## Location

The panel is rendered in the main application section stack near SaaS, settings, and billing foundation panels.

## What It Displays

- Overall system health
- Integration health
- Missing browser-visible environment variables
- Recent local system events
- Known warnings
- Recommended admin actions

## Integrations Displayed

- Supabase
- Twilio
- OpenAI
- Stripe
- Netlify Functions
- SMS logging
- AI fallback provider
- Build/deployment readiness

## Secret Handling

The panel never shows secret values.

For server-side integrations, the browser cannot verify secret presence safely. Those integrations are marked as `Unknown` with recommended admin actions to verify Netlify environment variables.

## Current Limitations

- No paid monitoring provider is connected.
- Server-side env readiness is not verified by a backend health endpoint yet.
- Runtime table access checks are not performed yet.
- Recent system events are local/in-memory only.
- Health status is advisory and does not block user workflows.

## Future Enhancements

- Secure Netlify health endpoint.
- Build metadata display.
- API timing dashboard.
- Error reporting integration.
- Uptime checks.
- Role-restricted admin access after permissions are enforced.
