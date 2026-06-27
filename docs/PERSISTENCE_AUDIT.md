# Persistence Audit

Production Readiness Sprint PR-2 reviewed the current persistence model and standardized active client CRUD behind repositories.

## Architecture Findings

- Supabase is the primary persistence provider.
- The app has real persisted workflows for deals, SMS logs, seller tasks, buyers, documents, comps, and follow-up sequences.
- Only `seller_tasks` has a committed migration in this repo.
- Multiple features are still foundation-level projections from loaded deals or local state.
- Several operational concepts are stored directly on `deals`, including task metadata, ownership, negotiation fields, closeout values, and analysis fields.
- Netlify Functions write SMS records to `message_logs` and read `deals`, but caller auth validation is not yet in place.

## Standardization Completed

Raw Supabase CRUD was removed from active components and hooks touched in this sprint.

Standardized through repositories:

- Deal loading and updates
- Bulk deal updates
- Pipeline stage changes
- Follow-up task fields on deals
- Team assignment fields on deals
- Closeout/revenue fields on deals
- Deal analysis fields
- Negotiation fields
- Buyer list and buyer creation
- Buyer matching reads
- Document list and creation
- Comp list and creation
- Sequence list, creation, and completion update
- Seller task list, creation, and status update

## Local, Derived, Or Placeholder Persistence

These areas are not yet production-persisted as first-class records:

- Notification center state: derived from deals and local/manual state.
- Action inbox state: local/manual completion and dismissal state.
- Campaign records: local/manual foundation.
- Organization settings: local/manual foundation.
- Team roles/memberships: local/manual foundation.
- AI chat memory: in-memory only.
- AI analyses and recommendations: derived on demand or stored in deal fields where applicable.
- Property data lookups: mock/manual provider output and in-memory cache.
- Calling and email foundations: manual/mock providers, limited or no persistence.
- Search index: derived from loaded deals and foundation records.
- Monitoring event buffer: in-memory only.

## Duplicate Or Risky Persistence Logic

- Deal field updates previously appeared in multiple components with inline payloads.
- Buyer reads appeared in both buyer board and buyer matching.
- Document, comp, sequence, and seller task CRUD lived directly in UI components.
- Server-side SMS writes duplicate some message log payload logic from client conversation repositories.

## Data Validation Findings

Missing or incomplete validation:

- Many numeric fields are converted with `Number(...)` but do not enforce minimums or finite values.
- URL fields are accepted as plain text.
- Status fields rely on UI options but lack database check constraints in committed migrations.
- Bulk updates do not yet audit changed fields or actor identity.
- Seller task status has no check constraint in the current migration.

Unsafe write/update risks:

- Client can update broad deal fields if Supabase table permissions allow it.
- Netlify Functions use service credentials without user JWT authorization for user-triggered operations.
- Inbound SMS writes should depend on Twilio signature validation before production traffic.
- Delete strategy is not defined; production should prefer soft deletes for user-owned data.

## RLS Readiness

Missing:

- Committed RLS policies.
- Organization membership tables.
- Tenant ownership columns across all persisted tables.
- Authenticated actor columns for auditing.
- Backfill migration plan for existing rows.

Recommended policies:

- Enable RLS on every tenant-owned table.
- Scope reads and writes by `organization_id`.
- Enforce role permissions through membership records or trusted claims.
- Keep webhook inserts server-only.
- Avoid client-side deletes until soft-delete policy is defined.

## Production Risks

- Existing Supabase schema is not reproducible from the repo.
- Tenant isolation cannot be enforced safely without schema and backfill work.
- Service-role Netlify Functions can bypass RLS and need explicit validation and audit logging.
- Important business events are overwritten on `deals` rather than stored as auditable event history.
- Local/manual foundations may give the appearance of persistence where no durable record exists.

## PR-3 Recommendations

- Create migrations for all currently expected tables.
- Add organization and membership schema.
- Add non-destructive tenant columns and backfill defaults.
- Add RLS policies in a staged rollout.
- Add repository tests for payload validation and result shape.
- Add server-side auth helpers for Netlify Functions before permission enforcement.
