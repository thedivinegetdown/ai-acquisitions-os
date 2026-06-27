# AI Acquisitions OS Production Readiness

## Architecture

The application is moving toward a feature-and-service architecture:

- `src/features/*`: large product areas with their own components, hooks, services, and types.
- `src/components/*`: shared or legacy UI components that have not yet moved into feature folders.
- `src/services/*`: reusable business, data, API, logging, monitoring, cache, and provider services.
- `src/utils/*`: pure formatting, parsing, text, date, phone, error, and async helpers.
- `src/types/*`: stable TypeScript contracts for future service and provider boundaries.
- `netlify/functions/*`: server-side integration boundaries for Twilio and future providers.

## Cross-Cutting Services

### Logging

`src/services/logging` exposes `logger.info`, `logger.warn`, `logger.error`, and `logger.debug`.
Debug logs only emit in development. Logs should avoid raw message bodies, secrets, auth tokens, and full request payloads.

### Monitoring

`src/services/monitoring` stores an in-memory event buffer and exposes timing helpers for async operations, API calls, and user actions. No external provider is connected yet.

### API

`src/services/api` centralizes Netlify Function calls through `callNetlifyFunction`.
It supports:

- JSON parsing
- consistent `success/error` service results
- transient retry handling
- API timing events

### Cache

`src/services/cache` provides a small in-memory TTL cache for low-risk derived reads. Use short TTLs for data that changes frequently.

### Config

`src/services/config` centralizes client environment access. Client-side variables must use `VITE_*`. Server secrets must remain in Netlify environment variables only.

## Environment Variables

Client:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_NETLIFY_FUNCTIONS_BASE` optional, defaults to `/.netlify/functions`

Server only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` optional fallback only
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SMS_TEST_MODE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional, defaults to the configured application model in Netlify Functions

Never expose service-role keys, Twilio auth tokens, or future OpenAI keys in client code.

## Security Notes

- Twilio outbound SMS is isolated behind `netlify/functions/send-sms.cjs`.
- Inbound SMS writes use `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Function logs should include presence flags and lengths, not raw message bodies.
- Client Supabase access should use the anon key and rely on Supabase policies.

## Future AI Provider Integration

AI providers should plug into service/provider boundaries, not UI components.

Recommended flow:

1. UI calls a hook.
2. Hook calls a gateway service.
3. Gateway calls a provider interface.
4. Provider may be rule-based, OpenAI, enterprise AI, or multi-agent.
5. Gateway returns stable analysis contracts to UI.

This keeps OpenAI integration replaceable without rewriting dashboards, copilot panels, workflows, or communications UI.

Current AI functions:

- `netlify/functions/ai-chat.js`
- `netlify/functions/ai-analysis.js`
- `netlify/functions/ai-summary.js`

Client code should call `src/services/ai/aiGateway.js` only. The gateway can run rule-based, OpenAI, or hybrid fallback modes.

## Remaining Hardening Work

- Add persistent monitoring provider when the app is deployed.
- Add lint enforcement once existing legacy files are normalized.
- Expand `AsyncStateView` to major legacy screens as they are touched.
- Add database-backed internal notes, notification history, and workflow approvals when schemas are approved.
- Continue measuring performance after the initial route-level code splitting pass.
