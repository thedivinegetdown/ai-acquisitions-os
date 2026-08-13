# EO-PROD-02R production reconciliation preflight

Date: 2026-08-13

Repository baseline: `df34c60f90564ca4be9c010a28cb80b9a8c2b45a`

Decision: **NO-GO FOR RECONCILIATION EXECUTION**

## Inspection boundary

Production aggregate inspection used the securely configured
`EO_PROD_READ_ONLY_DATABASE_URL`. The connection value and credentials were not
printed or written to the repository. The session ran inside `BEGIN READ ONLY`;
`transaction_read_only` was `on`. Role `eo_prod_readonly` remained a
non-superuser with `BYPASSRLS` false, replication false, no schema `CREATE`, and
zero table-write grants.

One explicitly authorized temporary SQL-language `SECURITY DEFINER` function
was created through the authenticated Supabase dashboard. It used static SQL,
`search_path = pg_catalog, public`, returned aggregates only, had `PUBLIC`
execution revoked, and granted execution only to `eo_prod_readonly`. It returned
no row values or identifiers. After the evidence was captured through the
read-only connection, the grant was revoked and only that function was dropped.
Catalog verification reports zero remaining functions with its name. No broader
role, schema, table, or RLS privilege changed.

## Exact production fingerprint

| Object | Exact rows | Constraints | Indexes | RLS |
|---|---:|---:|---:|---|
| `deals` | 16 | 2 | 2 | enabled |
| `message_logs` | 7 | 2 | 1 | enabled |
| `buyers` | 0 | 1 | 1 | enabled |
| `documents` | 0 | 2 | 1 | enabled |
| `comps` | 0 | 2 | 1 | enabled |
| `sequences` | 0 | 2 | 1 | enabled |
| `"Deals"` | 0 | 1 | 1 | enabled |
| `activities` | 0 | 2 | 1 | enabled |
| `leads` | 1 | 1 | 4 | enabled |
| `seller_tasks` | TABLE MISSING | - | - | - |
| `organizations` | TABLE MISSING | - | - | - |
| `organization_memberships` | TABLE MISSING | - | - | - |
| `communication_consents` | TABLE MISSING | - | - | - |

The two legacy policies remain unchanged:

- `deals`: `Allow all for now`, `ALL`, role `public`.
- `message_logs`: `Allow read access`, `SELECT`, role `public`.

All nine observed production tables have RLS enabled. No tenant policy or
tenant ownership state was installed by this EO.

## Legacy alias distributions

All counts below are aggregate-only. Canonical target columns are currently
absent, so pairwise both-present, exact-match, and conflict counts are not
applicable.

| Field | Type/presence | Total | Null | Non-null | Distinct | Min | Max |
|---|---|---:|---:|---:|---:|---:|---:|
| `beds` | integer | 16 | 5 | 11 | 2 | 3 | 4 |
| `bedrooms` | missing | 16 | - | - | - | - | - |
| `baths` | integer | 16 | 5 | 11 | 2 | 2 | 3 |
| `bathrooms` | missing | 16 | - | - | - | - | - |
| `condition` | text | 16 | 15 | 1 | 1 | - | - |
| `property_condition` | missing | 16 | - | - | - | - | - |
| `seller_price` | numeric | 16 | 2 | 14 | 12 | 140000 | 420000 |
| `asking_price` | missing | 16 | - | - | - | - | - |

Alias decisions:

- `beds -> bedrooms`: **SAFE NULL-ONLY BACKFILL** after the canonical numeric
  column is installed; preserve `beds`.
- `baths -> bathrooms`: **SAFE NULL-ONLY BACKFILL** after the canonical numeric
  column is installed; preserve `baths`.
- `condition -> property_condition`: **SAFE NULL-ONLY BACKFILL** after the
  canonical text column is installed; preserve `condition`.
- `seller_price -> asking_price`: **AMBIGUOUS**. Similar value shape does not
  establish equivalent business semantics, so no automatic backfill is
  approved.

## Owner and organization proposal

The authenticated Supabase operator view confirms the intended production owner
account exists, is confirmed, and has signed in. Sanitized owner UUID:
`9a6b08d4-1e5d-445a-ab05-4baeb322134c`.

Owner status: **OWNER CONFIRMED**.

Proposed personal-v1 organization:

- display name: `AI Acquisitions OS`;
- owner UUID: `9a6b08d4-1e5d-445a-ab05-4baeb322134c`;
- model: one personal-v1 organization;
- organization UUID: generate transactionally only in a separately authorized
  execution.

Organization status: **ORGANIZATION PROPOSAL READY**. No organization or
membership was created.

## Backup and recovery status

Supabase reports that the production project is on the Free plan and has no
scheduled project backups. No point-in-time recovery or restorable platform
backup is available. Status: **BACKUP NOT AVAILABLE**.

A separately authorized manual logical backup/export, integrity verification,
secure storage location, and documented restore rehearsal are mandatory before
any reconciliation execution. This EO did not create a backup or change the
project plan.

## Reconciliation preview

Candidate:
`supabase/security/production_schema_reconciliation.sql`

SHA-256:
`044C43664A8FD611E5BDE77FA7C855182635FD2E7179A146FFC42546E9941754`

Result: **PREVIEW MATCH**.

The observed canonical tables exist, `"Deals"` remains distinct from `deals`,
all three required legacy alias sources exist with the expected types, the
message direction constraint remains compatible, no duplicate lowercase deal
address was found, and no invalid visible message-to-deal reference was found.
The authoritative zero counts for buyers, documents, comps, and sequences make
their child-reference guards deterministic. No unexpected drift from the
EO-PROD-01R starting shape was observed.

The candidate remains additive, preserves `"Deals"`, `activities`, and `leads`,
does not assign ownership, does not remove legacy policies, does not activate
RLS, and ends in `ROLLBACK`.

## Production execution package

The starting fingerprint is the table above. A later execution must pin the
candidate to the recorded SHA-256, verify a new recovery artifact, reopen a
maintenance window, and re-run every preflight guard immediately before use.

Expected additive objects are `seller_tasks`, `organizations`,
`organization_memberships`, and `communication_consents`; nullable tenant and
repository compatibility columns; guarded foreign keys, checks, and query
indexes; tenant helper functions and policy definitions. Existing
`"Deals"`, `activities`, `leads`, legacy columns, rows, IDs, RLS flags, and
legacy policies must remain present after the reconciliation step.

Post-reconciliation verification must compare all nine starting row counts and
IDs, verify the added schema objects and constraints, confirm the three legacy
objects remain intact, confirm tenant ownership is still unassigned, confirm
legacy policies are unchanged, and re-run repository/schema contracts. Any row
loss, ID change, failed guard, unexpected object drift, policy change, ownership
assignment, or checksum mismatch is an immediate STOP/rollback condition.

## Validation evidence

- Reconciliation, production-readiness, and repository/schema contracts:
  **PASS**, 34 tests.
- Disposable reconciliation and Database RLS execution locally:
  **ENVIRONMENT BLOCKED**; no disposable local PostgreSQL URLs or `psql` client
  are configured. The harness refused non-local targets and production was not
  repurposed.
- Merged EO-PROD-02 PR #11 CI evidence: **PASS**, including Database RLS
  Validation, Browser E2E and Security, Build and Test, and deploy preview.
- Browser E2E locally: **PASS**, 20/20.
- Netlify Functions: **PASS**, 102 tests.
- Full unit suite: **PASS**, 84 files / 870 tests using synthetic non-secret
  public client placeholders.
- Lint: **PASS**, zero errors / 49 existing warnings.
- Build: **PASS**.

## GO / NO-GO

**NO-GO FOR RECONCILIATION EXECUTION.**

The aggregate-count, alias-distribution, owner, organization-proposal, and SQL
preview blockers are resolved. The remaining blocker is production recovery:
the project has no platform backup, and no separately authorized, verified
manual logical backup exists. Local disposable PostgreSQL execution is also not
available in this workspace, although the unchanged candidate's merged CI
Database RLS validation remains green.

GO may be reconsidered only after a manual logical backup and restore path are
separately authorized and verified, with the recorded SQL checksum and starting
fingerprint revalidated. GO would authorize only preparation of a separate
execution order, never execution itself.

## Safety confirmation

- Temporary aggregate function removed: **YES**
- Row-level production data exposed: **NO**
- Broader production privileges granted: **NO**
- Durable production schema mutation: **NO**
- Other production mutation beyond the authorized temporary function lifecycle:
  **NO**
- Reconciliation executed: **NO**
- Production migration applied: **NO**
- Organization created: **NO**
- Membership created: **NO**
- Ownership backfilled: **NO**
- Legacy policy changed: **NO**
- RLS changed: **NO**
- Provider activity: **NO**
