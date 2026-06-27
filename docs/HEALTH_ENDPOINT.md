# Health Endpoint

PR-7A adds a lightweight server-side health endpoint for operational readiness checks.

## Endpoint

```text
GET /.netlify/functions/health-check
```

The endpoint is implemented in:

```text
netlify/functions/health-check.js
```

## Purpose

The endpoint verifies whether required server-side environment variables are present without exposing secret values.

It checks configuration presence for:

- Supabase
- OpenAI
- Twilio
- Stripe

It does not call provider APIs, run database queries, send messages, create payments, or inspect secret values.

## Response

When all required server-side values are present, the endpoint returns HTTP `200`:

```json
{
  "success": true,
  "status": "ok",
  "configured": true,
  "checkedAt": "2026-06-27T00:00:00.000Z",
  "integrations": [
    {
      "name": "supabase",
      "configured": true,
      "missing": []
    }
  ]
}
```

When required values are missing, the endpoint returns HTTP `503`:

```json
{
  "success": true,
  "status": "degraded",
  "configured": false,
  "checkedAt": "2026-06-27T00:00:00.000Z",
  "integrations": [
    {
      "name": "supabase",
      "configured": false,
      "missing": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    }
  ]
}
```

Only environment variable names are returned. Values are never returned.

## Required Environment Variables

Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

OpenAI:

- `OPENAI_API_KEY`

Twilio:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Operational Use

Use this endpoint during staging and production validation to confirm server-side configuration has been populated.

Recommended checks:

- Call the endpoint after Netlify deploy.
- Confirm HTTP `200` before production approval.
- Treat HTTP `503` as a deployment readiness issue.
- Review missing variable names in Netlify environment settings.

## Security Notes

- The endpoint does not expose secret values.
- The endpoint should not be used as proof that providers are reachable.
- The endpoint should not send live SMS, OpenAI, Stripe, or Supabase traffic.
- Future provider-level health checks should remain safe, read-only, and non-billable where possible.
