# Security Checklist

## Completed In PR-3

- [x] Shared Netlify Function security helpers added.
- [x] AI functions use bounded prompt validation and safe errors.
- [x] SMS send function uses bounded body validation and sanitized logging.
- [x] Email foundation validates recipient, subject, and body.
- [x] Stripe checkout and portal functions validate request bodies.
- [x] Stripe webhook signature age tolerance added.
- [x] Client validation helpers added for common input checks.
- [x] Environment ignore rules expanded.
- [x] Safe `.env.example` added.
- [x] Security documentation added.
- [x] Production build verified.

## Required Before Real Customers

- [ ] Rotate any exposed local secrets.
- [ ] Add Supabase JWT verification to Netlify Functions.
- [ ] Forward Supabase access tokens from client API calls.
- [ ] Add RLS migrations for tenant-owned tables.
- [ ] Add organization membership schema.
- [ ] Enforce role permissions server-side.
- [ ] Restrict CORS to approved production origins.
- [ ] Add rate limiting for AI, SMS, billing, and import endpoints.
- [ ] Enforce Twilio inbound webhook signature validation.
- [ ] Add audit logging for high-risk writes.
- [ ] Add external monitoring and alerting.

## Ongoing Rules

- No secrets in client code.
- No raw provider payloads in logs.
- No stack traces in API responses.
- No service-role key usage outside server-only code.
- No permission enforcement based only on client-side checks.
- No destructive database operations without explicit migration and rollback plans.
