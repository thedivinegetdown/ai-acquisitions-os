# EO-PROD-01R production readiness report

Date: 2026-08-13

Repository baseline: `f7e112f2bd44abfc9f00595fd084849da699264c`

Expected migration head: `202608110004`

Decision: **NO-GO**

## Production inspection method and safety boundary

Production was inspected through PostgreSQL 17 using only the securely supplied
Windows user environment variable `EO_PROD_READ_ONLY_DATABASE_URL`. The value,
password, host details, and other credentials were never printed or written to
an artifact.

Every production query ran inside `BEGIN READ ONLY` and ended with `ROLLBACK`.
Before inspection, `SHOW transaction_read_only` returned `on`. The connected
role was independently verified as `eo_prod_readonly`: login enabled,
non-superuser, `BYPASSRLS` false, replication false, zero table/schema write
privileges, and zero schema `CREATE` privileges.

Only catalogs, aggregate counts, and relationship-count queries were used. No
business row values or auth profile data were selected.

## Migration state

Production has neither the `supabase_migrations` schema nor the
`schema_migrations` ledger. Applied migration versions therefore cannot be
proven from a ledger. Production is **behind and structurally divergent** from
the committed head.

The first committed migration whose required effects are demonstrably
incomplete is `202606240001`: existing baseline tables are missing required
columns, nullability, foreign keys, and indexes. The `message_logs.direction`
column and its check constraint are present, which resembles part of
`202606270001`, but there is no ledger evidence that the migration itself ran.
No migration may be considered applied solely from that resemblance.

Committed order remains:

1. `202606240001_create_current_schema_baseline.sql`
2. `202606250001_create_seller_tasks.sql`
3. `202606270001_add_message_logs_direction.sql`
4. `202606280001_complete_current_schema_constraints.sql`
5. `202608110001_create_tenant_security_foundation.sql`
6. `202608110002_define_tenant_rls_policies.sql`
7. `202608110003_enforce_tenant_ownership_immutability.sql`
8. `202608110004_harden_twilio_communications.sql`

Because the initial migration uses `CREATE TABLE IF NOT EXISTS`, blindly
applying this sequence would not repair existing table definitions. A later,
separately authorized execution must first reconcile the unledgered schema and
validate an explicit additive migration plan.

## Schema drift

### Expected and present

The lowercase tables `deals`, `message_logs`, `buyers`, `documents`, `comps`,
and `sequences` exist. Primary keys exist on all six. Foreign keys exist for
`documents.deal_id`, `comps.deal_id`, and `sequences.deal_id`.
`message_logs.direction` and `message_logs_direction_check` exist.

### Expected but missing

- Tables: `seller_tasks`, `organizations`, `organization_memberships`, and
  `communication_consents`.
- Tenant ownership: no `organization_id` column exists anywhere in `public`.
- Readiness and activation helpers:
  `tenant_table_ownership_report`, `tenant_rls_readiness_report`,
  `tenant_rls_is_ready`, and `activate_rls` are absent.
- High-value columns include `deals.email`, `deals.asking_price`,
  `deals.updated_at`, every expected `updated_at` on the other baseline tables,
  and all committed message provider/status/consent fields.
- The expected `message_logs.deal_id` foreign key is absent.
- All eleven checked repository indexes are absent, including the baseline deal,
  message, buyer, document, comp, and sequence query indexes and both
  communication-hardening indexes.

Existing baseline tables also differ in nullability: required fields such as
message phone/body, buyer name, document relationship/type/title, comp
relationship/address, sequence relationship/step/action/status, and committed
`created_at` fields are nullable in production. Production `deals` additionally
uses legacy names/types not represented by migration head, including `beds`,
`baths`, and `condition`, while committed canonical counterparts are missing.

### Production-only objects

Production contains uncommitted public tables `Deals` (case-sensitive),
`activities`, and `leads`, with associated constraints/indexes. It also has a
production-only `deals_address_unique` constraint. These objects require
separate reconciliation; this read-only EO did not alter them.

## Current RLS and policy state

RLS is already enabled on every observed public table, including the six
expected tables and the three production-only tables. This is not the committed
tenant policy set.

Only two legacy policies exist:

- `deals`: `Allow all for now`, command `ALL`, role `public`, predicate `true`.
- `message_logs`: `Allow read access`, command `SELECT`, role `public`,
  predicate `true`.

The other RLS-enabled tables have no visible policy granting this non-bypass
inspection role row access. Consequently, a returned zero for those tables is
RLS-filtered and cannot be reported as an authoritative production total.

## Tenant ownership counts

`organization_id` does not exist, so non-null, null, distinct-organization, and
orphan counts cannot yet be computed. `NOT CERTIFIABLE` means the aggregate
query returned zero through the dedicated role but RLS may have hidden rows.

| Tenant table | Authoritative total | Non-null org | Null org | Distinct orgs | Orphans |
|---|---:|---:|---:|---:|---:|
| deals | 16 | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED |
| message_logs | 7 | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED |
| seller_tasks | TABLE MISSING | TABLE MISSING | TABLE MISSING | TABLE MISSING | TABLE MISSING |
| buyers | NOT CERTIFIABLE | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED |
| documents | NOT CERTIFIABLE | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED |
| comps | NOT CERTIFIABLE | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED |
| sequences | NOT CERTIFIABLE | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED | NOT INSTALLED |
| communication_consents | TABLE MISSING | TABLE MISSING | TABLE MISSING | TABLE MISSING | TABLE MISSING |

The deal and message totals are authoritative for this inspection because their
legacy policies expose all rows to `public`. This is evidence of the current
policy state, not an endorsement of those policies.

## Child relationship findings

| Child table | Null deal IDs | Missing visible deal IDs | Cross-tenant mismatch |
|---|---:|---:|---:|
| message_logs | 0 | 0 | NOT INSTALLED |
| seller_tasks | TABLE MISSING | TABLE MISSING | NOT INSTALLED |
| documents | NOT CERTIFIABLE | NOT CERTIFIABLE | NOT INSTALLED |
| comps | NOT CERTIFIABLE | NOT CERTIFIABLE | NOT INSTALLED |
| sequences | NOT CERTIFIABLE | NOT CERTIFIABLE | NOT INSTALLED |

The message result is authoritative under its unconditional read policy. The
other observed zeroes are not evidence of empty tables because RLS can filter
them completely. Cross-tenant checks cannot run before tenant columns exist.

## Organization, membership, and target decision

`organizations` and `organization_memberships` are absent. Therefore:

- organization count/status: **NOT INSTALLED**;
- active membership and role counts: **NOT INSTALLED**;
- active owner membership: **UNAVAILABLE**;
- authenticated owner UUID: **UNAVAILABLE**;
- readiness-function result: **FUNCTIONS MISSING**;
- personal-v1 target decision: **TARGET UNAVAILABLE**.

The single-organization assumption cannot be supported. No target organization
or owner can be proposed, and EO-PROD-01R therefore does not calculate or
approve backfill counts. The rollback-default backfill template remains
unchanged and was not executed.

## GO / NO-GO blockers

Production remains **NO-GO** for a later mutation EO because:

1. the migration ledger is absent and the live schema diverges from the first
   committed baseline as well as migration head;
2. tenant foundation, ownership columns, communication consent, provider/status
   fields, readiness helpers, and committed tenant policies are missing;
3. the existing legacy RLS/policy configuration differs materially from the
   committed design and includes an unconditional public `ALL` policy on deals;
4. organizations and memberships do not exist, so no active owner or rollout
   target can be confirmed;
5. authoritative totals and relationship checks for buyers, documents, comps,
   and sequences are unavailable to the required non-bypass role because RLS
   filters them and approved read-only reporting functions are absent;
6. ownership, orphan, and cross-tenant counts are impossible until the tenant
   schema exists;
7. backup/recovery evidence and a reviewed schema-reconciliation plan remain
   prerequisites to any later execution.

Resolving these blockers requires a separately authorized plan. This report
does not authorize applying migrations, changing legacy policies, expanding the
inspection role, creating a security-definer function, or mutating production.

## Validation evidence

- Rollout safety and schema contracts: **PASS**, 26 tests.
- Netlify Function suite: **PASS**, 102 tests.
- Full CI-matched unit suite: **PASS**, 83 files / 862 tests.
- Lint: **PASS**, zero errors / 49 existing warnings.
- Production build: **PASS**.
- `git diff --check`: **PASS**.
- Changed-report secret scan: **PASS**, zero credential-pattern categories.
- Tracked-file strong-pattern scan: no new secret was found; matches were
  limited to previously committed synthetic local PostgreSQL test URLs in the
  database validation workflow, its harness test, and its documentation.
- Production-mutation scan: **PASS**, zero executable mutation lines in the
  changed report; every production SQL session was read-only and rolled back.
- Database/RLS execution validation: **ENVIRONMENT BLOCKED**. The local
  PostgreSQL listener has no valid disposable-test credential configured, the
  generic local URL is stale, and no container runtime is installed. The
  production read-only connection was not repurposed.
- Browser E2E: **TEARDOWN TIMEOUT**. All 20 scenarios were reached without a
  reported assertion failure in both parallel and CI-single-worker runs, but
  the Windows Playwright process did not exit or print a final pass summary
  before the five-minute ceiling. This is not recorded as green.

## Safety confirmation

- Production session forced read-only: **YES**
- Production data mutated: **NO**
- Production migration applied: **NO**
- Organization or membership created: **NO**
- Ownership backfilled: **NO**
- Backfill template executed: **NO**
- RLS enabled or disabled: **NO**
- Production environment changed: **NO**
- Live SMS/provider activity: **NO**
- Production deployment performed: **NO**
