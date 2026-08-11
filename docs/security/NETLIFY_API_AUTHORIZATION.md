# Netlify API authorization boundary

EO-SEC-02 separates browser business APIs from external webhooks and public-safe operational checks. Supabase service-role access bypasses RLS, so user APIs validate the caller and organization before any privileged query.

| Function | Invocation | Classification | Authorization | Tenant/resource rule |
| --- | --- | --- | --- | --- |
| `ai-analysis`, `ai-chat`, `ai-summary` | Browser AI provider | User API | Active membership; all canonical roles | Explicit organization context; no access token is sent to the AI provider |
| `send-sms` | Browser communications flow | User mutation API | Owner, admin, or analyst | Optional deal must match the organization; every message log carries `organization_id` |
| `send-email` | Browser email flow | User mutation API | Owner, admin, or analyst | Optional deal must match the organization; live provider behavior remains disabled |
| `create-checkout-session` | Browser billing panel | User administration API | Owner | Stripe metadata is derived from validated organization context |
| `create-billing-portal-session` | Browser billing panel | User administration API | Owner | Stripe customer metadata must match the validated organization |
| `inbound-v2` | Twilio provider | External webhook | No Supabase bearer token | Signature validation and provider-to-tenant resolution remain blocked for EO-COMM-01 |
| `stripe-webhook` | Stripe provider | External webhook | Stripe signature | No tenant-owned persistence is currently performed |
| `health-check` | Monitoring/operator | Public-safe | None | Returns configuration presence only, never values |

## Request contract

The browser uses the current Supabase session and sends its access token only in the `Authorization: Bearer` header. `X-Organization-Id` is a requested scope, not proof of access. The server validates it against an active persisted membership. If more than one active membership exists, explicit selection is required.

Missing, malformed, invalid, or expired authentication returns `401`. A valid user without the required membership or role receives `403`. Tenant-scoped resources that do not belong to the authorized organization are hidden behind `404`.

Authenticated endpoints are same-origin and do not emit wildcard CORS authorization. Tokens, authorization headers, service-role credentials, and provider secrets must never be logged or returned.

## Deliberate exclusions

This change does not activate RLS, mutate production data, backfill ownership, or change the Twilio inbound webhook. The inbound webhook remains unsuitable for production reliance until signature validation, replay protection, opt-out handling, idempotency, and trustworthy tenant resolution are implemented by the communications hardening order.
