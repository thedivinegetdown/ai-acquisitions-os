# EO-PROD-02 production schema reconciliation plan

Date: 2026-08-13

Baseline: `05dad2a979760c06ab77e4b0104832c43f8405a2`

Decision: **PLAN READY; PRODUCTION EXECUTION NOT AUTHORIZED**

## Boundary

This plan reconciles the sanitized EO-PROD-01R production shape to the current
repository contract with additive SQL. It does not apply SQL to production,
create an organization or membership, assign ownership, replace legacy
policies, activate RLS, touch providers, or bootstrap a migration ledger.

The review candidate is
`supabase/security/production_schema_reconciliation.sql`. It is transactional,
ends in `ROLLBACK`, retains all legacy objects and values, and does not populate
canonical aliases. A local-only harness may replace that final rollback with a
commit only for an explicitly named disposable `eo_prod_02_*` database.

## Reconciliation matrix

| Object | Production classification | Required additive action | Deferred action |
|---|---|---|---|
| `deals` | Present, incompatible | Add missing canonical, timestamp, and nullable tenant columns; indexes and guarded constraints | Validate aliases, then separately backfill; tighten nullability only after data review |
| `message_logs` | Present, incompatible | Add tenant and provider/status fields, checks, indexes, and guarded deal FK | Ownership backfill and legacy-policy removal |
| `seller_tasks` | Missing | Create canonical table, indexes, nullable tenant ownership, guarded FKs | Ownership assignment |
| `buyers` | Present, incompatible | Add `updated_at`, nullable ownership, indexes/FK | Validate hidden row count; ownership assignment |
| `documents` | Present, incompatible | Add `updated_at`, nullable ownership, indexes/FK | Validate hidden rows/nulls; ownership assignment |
| `comps` | Present, incompatible | Add `updated_at`, nullable ownership, indexes/FK | Validate hidden rows/nulls; ownership assignment |
| `sequences` | Present, incompatible | Add `updated_at`, nullable ownership, indexes/FK | Validate hidden rows/nulls; ownership assignment |
| `organizations` | Missing | Create canonical empty table and indexes | Create confirmed production organization in a later EO |
| `organization_memberships` | Missing | Create canonical empty table and indexes | Create confirmed active owner membership later |
| `communication_consents` | Missing | Create canonical empty table, constraints, index, tenant policy definitions | Never infer consent ownership or state |
| `Deals` | Production-only | Preserve exactly; fixture mirrors metadata | **MERGE REQUIRES SEPARATE REVIEW** |
| `activities` | Production-only | Preserve exactly; its FK to lowercase `deals` remains | **RETAIN** and document in future schema baseline |
| `leads` | Production-only | Preserve exactly with indexes | **RETAIN**; overlap analysis requires separate product/data review |

Production nullability is intentionally not tightened by this reconciliation.
New defaults support future writes but existing null values remain unchanged.

## Legacy-object findings

Fresh read-only catalog inspection confirmed the following without selecting
business rows:

- `Deals`: bigint ID, creation timestamp, and phone. It has a primary-key index,
  no application reference, no observed FK, and no SELECT grant to the
  inspection role. Its row count is unknown. The shape is not equivalent to the
  lowercase UUID-keyed `deals` table, so automatic merge/view/deprecation is
  unsafe. Decision: **MERGE REQUIRES SEPARATE REVIEW**.
- `activities`: bigint ID, UUID `deal_id`, type, note, and creation timestamp.
  Its FK targets lowercase `deals`. No current application query was found, but
  the relationship proves historical dependency. Count is unknown. Decision:
  **RETAIN**.
- `leads`: UUID ID and lead intake/contact/property/scoring fields, with primary
  key plus created-at, score, and temperature indexes. No current application
  query was found and count is unknown. Its shape overlaps some deal fields but
  represents a distinct lead-stage model. Decision: **RETAIN**.

The production read-only role has no SELECT privilege on these three tables;
therefore no row count is asserted. A later execution preflight must obtain
authorized aggregate counts before and after reconciliation.

## Legacy field mappings

| Legacy field | Canonical field | Classification | Rule |
|---|---|---|---|
| `deals.beds` integer | `deals.bedrooms` numeric | Direct safe widening alias | Add canonical column only; later populate only where canonical is null |
| `deals.baths` integer | `deals.bathrooms` numeric | Direct safe widening alias | Add canonical column only; later populate only where canonical is null |
| `deals.condition` text | `deals.property_condition` text | Direct safe alias | Add canonical column only; later populate only where canonical is null |
| `deals.seller_price` | `asking_price` | Ambiguous | No automatic mapping; semantics require business review |
| case-sensitive `Deals` fields | lowercase `deals` | Cannot reconcile automatically | No merge, alias, view, or ID conversion |

No alias backfill appears in the candidate. The guarded backfill belongs to a
later execution after value-distribution review.

## Additive repair design

The candidate:

1. verifies the observed canonical tables, legacy case collision, important
   source types, deal-reference integrity, and legacy address uniqueness;
2. adds missing repository columns while preserving legacy fields and nulls;
3. creates missing seller-task, tenant, membership, and consent tables;
4. adds query and tenant indexes, provider uniqueness, check constraints, and
   `NOT VALID` foreign keys where existing rows need later validation;
5. installs membership/role and readiness reporting helpers;
6. defines tenant policies conditionally but does not enable RLS or remove the
   two legacy permissive policies;
7. performs no ownership or alias assignment and rolls back by default.

Composite deal/organization FKs are installed as `NOT VALID`; they protect new
non-null relationships while legacy null ownership remains permissible. A later
EO must validate constraints only after deterministic ownership backfill.

## Tenant and communication installation

Tenant foundation installation creates empty `organizations` and
`organization_memberships`, adds nullable `organization_id` to all tenant-owned
tables, and installs indexes, guarded FKs, read-only readiness helpers, and
policy definitions. It does not create an organization, owner, or ownership.

Communication installation adds message provider identity/status timestamps,
bounded provider/consent checks, the provider uniqueness index, and an empty
tenant-owned `communication_consents` table. Existing messages remain intact.
Consent state is never inferred from message history.

## Staged legacy RLS transition

RLS remains enabled exactly as found during reconciliation. The future sequence
must be:

1. install and verify the additive schema while retaining existing policies;
2. create the explicitly approved organization and active owner membership;
3. backfill only reviewed null ownership in relationship order;
4. prove zero null, orphan, and cross-tenant violations;
5. verify every tenant policy exists and authenticated role tests pass;
6. in one controlled change, remove `deals."Allow all for now"` and
   `message_logs."Allow read access"` only after tenant access is proven;
7. smoke owner/analyst/viewer/anonymous paths while RLS stays enabled;
8. invoke the existing activation artifact only for any table still lacking RLS.

This ordering avoids removing current access before ownership exists and avoids
creating a period where tenant policy is treated as sufficient while permissive
legacy policies still grant cross-tenant access.

## Migration-ledger strategy

Do not claim that the eight Git migrations historically ran. Production has no
ledger and only partial resemblance to some effects. The future execution must:

1. record an immutable sanitized legacy-start fingerprint and backup reference;
2. execute an approved, versioned derivative of this reconciliation candidate,
   suggested version `202608130001_production_schema_reconciliation_baseline`;
3. verify its postconditions and record only that reconciliation version in a
   newly established ledger through the supported Supabase migration mechanism;
4. keep the eight historical Git migrations unchanged for clean rebuilds;
5. record subsequent organization bootstrap, ownership backfill, constraint
   validation, policy transition, and activation as separate reviewed changes.

Ledger creation and writes are deliberately absent from the candidate.

## Disposable-clone validation

`eo_prod_02_legacy_fixture.sql` reproduces the sanitized divergent shape, legacy
nullable patterns, constraints/indexes, RLS flags, permissive policies, 16
synthetic deals, seven synthetic messages, and one synthetic row in each legacy
object. It contains no production values.

`test-production-schema-reconciliation.cjs` refuses non-local hosts, requires an
explicit authorization flag and `eo_prod_02_*` database name, applies the
candidate twice to test idempotence, and runs preservation assertions after
each application. The committed candidate itself remains rollback-default.

## Future production execution checklist

Each step requires its own authorization and captured evidence:

1. Verify a current production backup and tested recovery point.
2. Open the maintenance/change window and pause writes if required.
3. Re-run drift/preflight checks and apply the reconciliation migration only.
4. Verify all pre/post row counts, IDs, legacy objects, schema, constraints,
   indexes, functions, policies, and application reads.
5. Create or confirm the intended production organization and active owner.
6. Execute the explicit null-only tenant ownership backfill.
7. Run ownership/readiness reports and database/RLS integration validation.
8. Replace permissive legacy policies with verified tenant policies.
9. Verify authenticated owner, analyst, viewer, anonymous, and server API access.
10. Run production-safe browser/API/Inbox test-mode smoke checks and record the
    rollback decision.

## Rollback and recovery

Before commit, use transaction rollback. After an additive reconciliation
commit, prefer leaving unused nullable columns/tables in place while addressing
the defect; destructive removal may lose newly written data. Do not proceed to
organization, ownership, or policy transition if reconciliation verification
fails. After policy transition, emergency RLS rollback follows the separately
approved activation runbook and must not erase tenant ownership or memberships.

## Validation evidence

- Reconciliation safety and repository/schema contracts: **PASS**, 35 tests.
- Disposable production-like PostgreSQL reconciliation: **PASS**. The fixture
  built cleanly, the candidate applied twice, and every synthetic row and ID was
  preserved after both applications.
- Database RLS Validation: **PASS** against two additional clean disposable
  PostgreSQL databases with matching schema behavior.
- Browser E2E: **PASS**, 20/20.
- Netlify Functions: **PASS**, 102/102.
- Full suite: **PASS**, 84 files / 870 tests.
- Lint: **PASS**, zero errors / 49 existing warnings.
- Production build: **PASS**.

## Remaining blockers

- authoritative counts for RLS-hidden canonical tables and production-only
  objects are still unavailable;
- actual value distributions for legacy aliases and nullable required fields
  require approved aggregate preflight;
- backup/recovery evidence, organization identity, owner identity, and separate
  mutation authority remain absent.

Production remains **NO-GO** for reconciliation execution.
