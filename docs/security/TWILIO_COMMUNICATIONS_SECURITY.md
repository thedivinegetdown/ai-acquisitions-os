# Twilio communications security boundary

EO-COMM-01 protects external Twilio callbacks with Twilio signatures. These
callbacks intentionally do not use Supabase bearer authentication.

## Endpoints

| Function | Source | Trust boundary | Tenant behavior |
| --- | --- | --- | --- |
| `inbound-v2` | Twilio inbound SMS | Valid `X-Twilio-Signature` | Configured destination number and `TWILIO_ORGANIZATION_ID` |
| `twilio-status` | Twilio delivery callback | Valid `X-Twilio-Signature` | Configured organization plus persisted provider message ID |
| `send-sms` | Authenticated browser user | EO-SEC-02 bearer and membership authorization | Server-resolved organization and consent lookup |

`PUBLIC_SITE_URL` is the canonical public origin used for signature validation
and the delivery callback URL. Forwarded host and protocol headers are not used
to construct signed URLs.

## Personal-v1 routing limitation

Inbound routing supports one configured Twilio destination number and one
configured organization. The destination number must match
`TWILIO_PHONE_NUMBER`, and ownership comes only from the server-side
`TWILIO_ORGANIZATION_ID`. Sender phone numbers are used only after that trusted
route is resolved, and deal lookup is scoped to the configured organization.
Unmatched senders are stored as tenant-owned, unassigned communication records.

Multi-organization number ownership requires a future persisted mapping. The
current implementation fails closed for unknown destination numbers and does
not accept an organization ID from webhook input.

## Consent and delivery

Exact STOP commands (`STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`)
persist `opted-out`. Exact START commands (`START`, `UNSTOP`) persist
`opted-in`. Ordinary messages and fuzzy phrases do not change consent.

Outbound sends check tenant-scoped SMS consent before test persistence or live
provider access. Live provider access occurs only when `SMS_TEST_MODE=false`
and all required server configuration is present. Provider acceptance is not
reported as delivery; signed callbacks advance the existing message record
without creating callback rows or allowing backward terminal transitions.

## Deployment boundary

This repository change does not apply migrations, activate RLS, configure a
Twilio number, enable live SMS, or send messages. Production activation remains
a separate explicitly authorized operation.
