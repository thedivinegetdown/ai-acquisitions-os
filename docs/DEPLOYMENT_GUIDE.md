# Deployment Guide

## Build

Run:

```bash
npm run build
```

The app uses Vite and outputs static assets to `dist`.

## Netlify

Recommended deployment target is Netlify because the app uses Netlify Functions for Twilio and OpenAI.

Required setup:

1. Connect the repository to Netlify.
2. Configure build command: `npm run build`.
3. Configure publish directory: `dist`.
4. Add required environment variables from `ENVIRONMENT_VARIABLES.md`.
5. Confirm Netlify Functions are deployed from `netlify/functions`.

## Supabase

Configure Supabase URL and keys in both client and server environments as needed.

Client:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Twilio

Outbound SMS uses `send-sms.cjs`.
Inbound SMS webhook should point to the deployed `inbound-v2.cjs` Netlify Function URL.

## OpenAI

OpenAI is server-side only through Netlify Functions. Add:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional

## Verification Checklist

- App loads.
- Pipeline Board renders.
- Seller Workspace opens.
- Conversation Inbox loads.
- SMS send function returns success or safe test-mode response.
- AI Copilot falls back when `OPENAI_API_KEY` is missing.
- Deal Modal opens.
- Build completes without compile errors.
