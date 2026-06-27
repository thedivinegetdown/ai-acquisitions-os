# API Security

AI Acquisitions OS uses Netlify Functions as the server boundary for external providers and privileged operations.

## Shared Function Security Utilities

Shared helpers live in:

`netlify/functions/_shared/security.cjs`

They provide:

- JSON responses
- OPTIONS handling
- POST method enforcement
- Safe JSON body parsing
- Basic email and phone validation
- Bounded string handling
- Sanitized server logging
- Secret-like value redaction

OpenAI functions also use:

`netlify/functions/_shared/ai.cjs`

## Hardened Functions

Updated in PR-3:

- `ai-chat.js`
- `ai-analysis.js`
- `ai-summary.js`
- `send-email.js`
- `send-sms.cjs`
- `inbound-v2.cjs`
- `create-checkout-session.js`
- `create-billing-portal-session.js`
- `stripe-webhook.js`

## Response Format

JSON APIs should return:

```json
{
  "success": true
}
```

or:

```json
{
  "success": false,
  "error": "Safe user-facing error."
}
```

Do not return stack traces, provider raw payloads, secrets, or implementation details.
- Endpoint tests should verify missing environment variables, invalid HTTP methods, safe response shapes, and no stack trace leakage.

## Validation Rules

Every function should:

- Enforce expected HTTP method.
- Parse and validate request body.
- Validate required fields.
- Bound text payload lengths.
- Return safe errors.
- Catch unexpected exceptions.
- Log sanitized diagnostic metadata only.

## Remaining API Risks

- User-triggered functions do not yet require authenticated Supabase JWTs.
- There is no per-user or per-IP rate limiting.
- CORS is permissive while deployment origins are still being finalized.
- Outbound SMS and Stripe checkout should require authorization once server-side JWT verification is available.
- Inbound webhooks should enforce provider signatures before production traffic.

## PR-4 Recommended API Work

- Add `requireAuthenticatedUser(event)` helper for Netlify Functions.
- Forward Supabase access tokens from `callNetlifyFunction`.
- Verify JWTs server-side with Supabase.
- Add permission-aware function guards.
- Add basic rate-limit hooks for AI, SMS, and billing endpoints.
- Restrict CORS to known production origins.
