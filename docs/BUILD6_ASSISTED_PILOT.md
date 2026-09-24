# Build 6 assisted pilot operations

Build 6 is an internal, service-role-only workflow for one assisted operator. It is not a customer onboarding portal. Never place `SUPABASE_SERVICE_ROLE_KEY` in browser configuration, generated exports, or import plans.

## Preconditions

- The owner already exists in Supabase Auth; use that auth user's UUID. This build does not create credentials or send invitations.
- Run commands only from a trusted administrative machine with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the process environment.
- Use a stable, non-secret provisioning idempotency key. Reusing the key returns the original pilot; changing the key cannot create a second organization for the same active owner.

## Canonical workflow

```text
npm run pilot:admin -- provision --idempotency-key pilot-2026-001 --organization-name "Example Operator" --owner-user-id UUID --slug example-operator
npm run pilot:admin -- configure-settings --organization-id UUID --settings pilot-settings.json
npm run pilot:admin -- import-preview --organization-id UUID --csv leads.csv --plan reviewed-plan.json --default-market "Tampa"
npm run pilot:admin -- import-apply --plan reviewed-plan.json --confirmation-token TOKEN_FROM_PREVIEW
npm run pilot:admin -- status --organization-id UUID
npm run pilot:admin -- export --organization-id UUID --output customer-export.json
npm run pilot:admin -- suspend --organization-id UUID
npm run pilot:admin -- reactivate --organization-id UUID
```

Output files use exclusive creation and will not overwrite an existing file. The import preview reuses the Build 1 CSV normalization, validation, duplicate detection, and durable `lead-intake:v1` identity. Apply requires the SHA-256 confirmation token for the unchanged reviewed plan. The database injects the target organization and rejects a conflicting organization value.

## Provider controls

OpenAI is disabled for every organization by default. Enabling it is an assisted administrative action and requires both a monthly request cap and a maximum prompt size:

```text
npm run pilot:admin -- configure-provider --organization-id UUID --provider openai --enabled true --monthly-request-cap 100 --max-prompt-characters 12000
```

Each server-side OpenAI request consumes the organization cap atomically before any paid provider call. Missing policy, disabled policy, exhausted cap, and policy-read failures all fail closed. API keys remain server environment variables. Twilio stays on the accepted deferred/test-mode boundary and is not activated by Build 6.

## Export and diagnostics boundaries

The versioned JSON export is deterministic in record ordering and contains explicit customer-owned operational fields. It excludes memberships, auth identities, provisioning keys, provider usage internals, service credentials, provider message IDs, and server telemetry.

Diagnostics expose organization status, configuration completeness, provider readiness and limits, import/export readiness, bounded record counts, and build/schema identifiers. Existing failure telemetry is log-only, so diagnostics report that recent failures are unavailable instead of exposing logs or message bodies.

## Known limitations

- Auth-user creation, password delivery, invitations, billing, deletion, and self-service onboarding are intentionally absent.
- Export is an assisted admin-generated JSON archive, not a customer-facing download page.
- Import supports the existing Build 1 deals/leads CSV contract only.
- Provider caps count accepted attempts; they are not token accounting or billing metering.
- No new Twilio, email, property-data, Stripe, or other provider integration is included.
