# Environment Security

Environment variables define the security boundary between browser-safe configuration and server-only secrets.

## Client-Safe Variables

Only `VITE_*` variables are available to the browser.

Allowed client variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_NETLIFY_FUNCTIONS_BASE`

The Supabase anon key is not a secret, but it must be protected by RLS policies before production customer data is stored.

## Server-Only Secrets

These must remain in Netlify environment variables and must never be imported into client code:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PROPERTY_DATA_API_KEY`
- `EMAIL_API_KEY`
- `EMAIL_WEBHOOK_SECRET`
- `CALLING_API_KEY`
- `CALLING_WEBHOOK_SECRET`

## Local Development

- Use `.env.example` as the template.
- Do not commit `.env` or `.env.*` files.
- Do not paste secrets into issue comments, chat, screenshots, or docs.
- Rotate any key that may have been exposed.

## Immediate Action

The local workspace contains real-looking server-side secrets in `.env`.

Recommended action:

- Rotate the Supabase service role key if there is any chance the file was shared or committed.
- Rotate the Twilio auth token if there is any chance the file was shared or committed.
- Move production secrets into Netlify environment variables.
- Keep only development/test values locally.

## Production Deployment Rules

- `SMS_TEST_MODE=false` only after Twilio signatures, auth guards, and monitoring are ready.
- Stripe secret values should be test-mode until billing enforcement is approved.
- OpenAI keys should be scoped to this application where possible.
- Service-role keys should be used only inside server functions and webhook handlers.
