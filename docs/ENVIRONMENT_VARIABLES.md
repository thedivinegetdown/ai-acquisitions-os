# Environment Variables

## Client Variables

These are available to the Vite client and must be prefixed with `VITE_`.

- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key for browser access.
- `VITE_NETLIFY_FUNCTIONS_BASE`: optional Netlify Functions base path. Defaults to `/.netlify/functions`.

## Server Variables

These must remain server-side in Netlify environment variables.

### Supabase

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key for server-side writes and webhook handlers.
- `SUPABASE_ANON_KEY`: optional fallback for server-side Supabase initialization.

### Twilio

- `TWILIO_ACCOUNT_SID`: Twilio account SID.
- `TWILIO_AUTH_TOKEN`: Twilio auth token.
- `TWILIO_PHONE_NUMBER`: outbound Twilio phone number.
- `TWILIO_PHONE`: legacy local fallback for outbound Twilio phone number. Prefer `TWILIO_PHONE_NUMBER` in production.
- `SMS_TEST_MODE`: `true` or `false`.

### OpenAI

- `OPENAI_API_KEY`: server-side OpenAI API key.
- `OPENAI_MODEL`: optional model override for Netlify AI functions.

### Stripe

- `STRIPE_SECRET_KEY`: server-side Stripe test secret key. Never expose this to client code.
- `STRIPE_WEBHOOK_SECRET`: server-side Stripe webhook signing secret.
- `STRIPE_PRICE_STARTER`: Stripe test price ID for the Starter plan.
- `STRIPE_PRICE_GROWTH`: Stripe test price ID for the Growth plan.
- `STRIPE_PRICE_PRO`: Stripe test price ID for the Pro plan.
- `STRIPE_PRICE_ENTERPRISE`: optional Stripe test price ID for the Enterprise plan.

### Property Data

No live property data provider is required yet.

Future provider variables should remain server-side only, for example:

- `PROPERTY_DATA_PROVIDER`: optional selected provider identifier.
- `PROPERTY_DATA_API_KEY`: future provider API key.
- `PROPERTY_DATA_API_BASE_URL`: future provider API base URL.

### Email

No live email provider is required yet.

Future provider variables should remain server-side only, for example:

- `EMAIL_PROVIDER`: optional selected email provider identifier.
- `EMAIL_API_KEY`: future email provider API key.
- `EMAIL_FROM_ADDRESS`: future default sender email address.
- `EMAIL_WEBHOOK_SECRET`: future email provider webhook signing secret.

### Calling

No live calling provider is required yet.

Future provider variables should remain server-side only, for example:

- `CALLING_PROVIDER`: optional selected calling provider identifier.
- `CALLING_API_KEY`: future calling provider API key.
- `CALLING_ACCOUNT_ID`: future calling provider account ID.
- `CALLING_WEBHOOK_SECRET`: future calling provider webhook signing secret.

### Netlify

- Netlify provides runtime function context and deployment configuration.
- `APP_URL`: optional canonical app URL used by hosted Stripe checkout and billing portal return URLs.
- No secrets should be committed to the repository.

## Security Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, future property provider API keys, future email provider secrets, or future calling provider secrets to client code.
- Client code should only use `VITE_*` variables.
- Provider calls should go through services and Netlify Functions.
- Do not commit real `.env` files. Use `.env.example` as a template and store production values in Netlify environment variables.
- Rotate any server-side key that has been copied into a shared workspace, ticket, chat, screenshot, or committed history.
