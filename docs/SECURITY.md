# Security

Production Readiness Sprint PR-3 performed a security hardening pass across frontend boundaries, Netlify Functions, Supabase usage, OpenAI, Twilio, Stripe, email foundation, and environment variables.

## Current Security Posture

Implemented:

- Supabase Auth-protected React shell.
- Session persistence and refresh through Supabase Auth.
- Repository boundary for client Supabase data access.
- Shared Netlify Function security helpers.
- Consistent JSON response format for major JSON APIs.
- Safer server-side logging with secret redaction.
- Bounded prompt/body validation for AI, SMS, email, and Stripe request paths.
- Stripe webhook signature verification with timestamp tolerance.
- `.env.example` template and broader env-file ignore rules.

Not fully implemented yet:

- Supabase RLS policies.
- Server-side Supabase JWT verification for user-triggered Netlify Functions.
- Role-based permission enforcement.
- Rate limiting.
- Twilio inbound webhook signature enforcement.
- External monitoring/alerting.

## High-Risk Findings

- Local `.env` contains server-side secrets. Treat any copied or shared local env file as sensitive. Rotate credentials if exposure is possible.
- Netlify Functions are still callable without authenticated user JWT checks.
- Service-role Supabase keys are used in server functions and bypass RLS by design.
- RLS policies and tenant-scoped schema are not yet versioned.
- Inbound SMS does not enforce Twilio signature validation yet.

## Authentication

The frontend is protected by `AuthProvider` and `ProtectedRoute`.

Verified behavior:

- Session bootstrap happens before the app shell renders.
- Expired sessions attempt refresh.
- Sign-out revokes the current Supabase session.
- Unauthorized users see the sign-in/reset foundation instead of the CRM.

Remaining work:

- Add password recovery completion screen.
- Forward Supabase access tokens to Netlify Functions.
- Validate JWTs server-side before user-triggered actions.

## Authorization

Role and permission helpers exist, but full enforcement is intentionally deferred.

Future enforcement points:

- Deal reads and updates.
- SMS sending.
- Billing actions.
- Team and settings administration.
- Document access.
- Workflow approvals.
- Lead import.
- Buyer management.

Do not rely on client-side role checks for security. Enforce permissions through RLS and server-side authorization.

## Logging

Server functions now use shared sanitized logging helpers for hardened functions.

Rules:

- Never log secrets, full auth headers, API keys, raw provider payloads, or raw message bodies.
- Prefer presence flags, IDs, status codes, and content lengths.
- Log provider errors as sanitized code/status/type metadata.
- Avoid stack traces in API responses.

Residual debt:

- Some client components still use `console.error` for local diagnostics. Replace with `logger` opportunistically as those components are touched.

## External Providers

OpenAI:

- API key remains server-side.
- Prompt size is bounded.
- Provider errors return safe messages.

Twilio:

- Outbound SMS is server-side.
- Message body length is bounded.
- Test mode remains supported.
- Inbound SMS needs signature enforcement before production traffic.

Stripe:

- Secret key remains server-side.
- Webhook signature verification is present.
- Webhook persistence and entitlement enforcement are not active yet.

Email, Calling, Property APIs:

- Provider foundations are not live production integrations yet.
- Future provider secrets must remain server-side.
