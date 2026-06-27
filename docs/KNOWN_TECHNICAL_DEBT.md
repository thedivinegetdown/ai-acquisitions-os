# Known Technical Debt

## SaaS Foundations

- Permissions are visible but not fully enforced.
- Team management is local/manual foundation only.
- Settings are local/manual and not fully persisted or enforced.
- No full multi-tenancy yet.
- No org switching yet.
- No billing or Stripe yet.

## Documents And Legal

- Documents / Contract Prep is internal preparation only.
- No legal document generation yet.
- No e-sign integration yet.
- No legal template management.
- No document audit trail.

## Communications

- Internal notes are local/session-only.
- Email, calls, voicemail, WhatsApp, Messenger, and web chat are future-ready but not connected.
- SMS is active; external sends still require user action.

## AI

- Rule-based fallback remains required.
- Prompt evaluation and versioning are not implemented.
- AI output is not automatically executed.
- AI chat memory is local/in-memory.

## Data And Persistence

- Several foundation panels use local state because safe persistence tables are not approved yet.
- Database schema and RLS policies need a dedicated SaaS hardening pass.
- Some legacy components still access Supabase directly.

## Testing And Operations

- Automated test coverage is not yet comprehensive.
- CI enforcement needs hardening.
- External monitoring and error reporting are not connected.
- Audit logging is not complete.

## Frontend

- Some legacy components remain in `src/components` instead of feature folders.
- More shared UI primitives could reduce repeated inline styles.
- Route-level code splitting has begun, but further performance work should be measured before additional splits.
