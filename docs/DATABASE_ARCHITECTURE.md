# Database Architecture

AI Acquisitions OS uses Supabase Postgres as the primary persistence layer.

## Current Tables In Use

The application currently reads or writes these tables by convention:

- `deals`: primary seller/deal records and many workflow fields.
- `message_logs`: inbound and outbound SMS conversation history.
- `seller_tasks`: seller task/reminder records.
- `buyers`: buyer CRM records.
- `documents`: deal document link records.
- `comps`: comparable sale records.
- `sequences`: follow-up sequence steps.

These tables currently have migrations in this repository:

- `supabase/migrations/202606250001_create_seller_tasks.sql`
- `supabase/migrations/202606270001_add_message_logs_direction.sql`

The other tables appear to exist in the Supabase project or are expected by the UI, but their schema is not versioned in this repo yet.

`message_logs.direction` is expected by conversation loading and SMS timeline rendering. It is an additive text column with allowed values `inbound` and `outbound`; application inserts populate it directly, and legacy rows are backfilled from `status` where possible.

## Persistence Boundaries

Client-side data access should go through `src/services/repositories`.

Current repository layer:

- `dealRepository.js`
- `buyerRepository.js`
- `conversationRepository.js`
- `documentRepository.js`
- `notificationRepository.js`
- `organizationRepository.js`
- `propertyRepository.js`
- `sellerTaskRepository.js`
- `transactionRepository.js`
- `workflowRepository.js`

Auth-specific Supabase calls remain in `src/services/auth`.

Conversation persistence still has an existing dedicated repository under `src/services/conversations`; the new repository layer re-exports that boundary for compatibility.

## Current Production Risks

- Most expected tables do not have committed migrations.
- No tenant or organization columns are consistently enforced across persisted records.
- Row Level Security policies are not versioned in the repo.
- Client updates depend on broad table access through the anon key.
- Netlify Functions write to Supabase with service credentials but do not yet validate caller Supabase JWTs.
- Several workflows persist operational state onto `deals`, which increases coupling and makes audit history difficult.

## RLS Readiness

RLS should not be enabled blindly until the schema is ready. The recommended rollout is:

1. Add `organization_id`, `created_by`, `updated_by`, and audit timestamps to tenant-owned tables.
2. Backfill existing rows to a known organization.
3. Create `organizations` and `organization_memberships`.
4. Store role assignments in membership records or trusted `app_metadata`.
5. Add RLS policies for authenticated users scoped by organization membership.
6. Move privileged webhook writes to explicit server-only paths.

## Recommended Policy Shape

For tenant-owned tables:

- Read: authenticated user belongs to the row's organization.
- Insert: authenticated user belongs to the organization and has create permission for the resource.
- Update: authenticated user belongs to the organization and has update permission for the resource.
- Delete: avoid client deletes initially; use soft-delete or server-only deletion.

For `message_logs`:

- Client read: scoped to organization membership.
- Client insert: outbound messages only through controlled service paths.
- Webhook insert: server-only service-role path after Twilio signature validation.

For `deals`:

- Client read/update should be organization-scoped.
- Bulk updates should be permission-checked and audit-logged.

## Migration Discipline

Every production table should be represented by a migration in `supabase/migrations`.

Future migrations should include:

- Primary keys
- Foreign keys
- Organization/tenant ownership columns
- Useful indexes
- Check constraints for status fields
- `created_at` and `updated_at`
- RLS enablement and policies
- Backfill scripts when changing existing data
