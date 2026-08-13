# Production tenant ownership and RLS activation runbook

This runbook prepares a later, separately authorized production change. EO-PROD-01
does not apply migrations, assign ownership, create organizations or memberships,
enable or disable RLS, deploy, or contact a communications provider.

## Current EO-PROD-01 status

**NO-GO.** Repository baseline: `d847c5fbda270709e14faa6888289b1e73a7d68e`.

The production deployment is the Netlify project `ai-acquisitions-divine`, linked
to `thedivinegetdown/ai-acquisitions-os` on `main`. Its production environment
contains the required Supabase variable names, but Netlify exposes redacted
placeholders to the local CLI. No local database credential or read-only role is
available. The guarded inspector stopped before making a Supabase request.

Consequently, production migration head, schema drift, RLS state, row counts,
organization/membership state, owner identity, and backfill target are unknown.
They are mandatory blockers, not assumed-empty or assumed-single-tenant results.

## Artifacts and authority

- `supabase/security/production_readiness_inspection.sql` is read-only and must be
  run with a reviewed production connection. It starts a read-only transaction
  and ends with `ROLLBACK`.
- `scripts/inspect-production-tenant-readiness.cjs` is a constrained REST fallback.
  It requires `EO_PROD_READ_ONLY=true`, a production Supabase HTTPS project, and
  allows only `GET`, `HEAD`, and three stable reporting RPCs.
- `supabase/security/production_backfill_template.sql` is review-only. It requires
  explicit organization name/UUID and owner UUID substitution, refuses conflicts,
  updates only null ownership, and ends with `ROLLBACK`.
- `supabase/security/activate_rls.sql` is the separately controlled activation
  artifact. It must not run until every readiness condition below is satisfied.

Never paste credentials into tickets, chat, logs, SQL files, or source control.
Prefer a dedicated read-only database role. Possession of an admin or service-role
credential does not authorize mutation.

## Expected migration sequence

Compare `supabase_migrations.schema_migrations` with this exact order. Apply
nothing during readiness inspection.

1. Schema baseline:
   - `202606240001_create_current_schema_baseline.sql`
   - `202606250001_create_seller_tasks.sql`
   - `202606270001_add_message_logs_direction.sql`
   - `202606280001_complete_current_schema_constraints.sql`
2. Tenant foundation:
   - `202608110001_create_tenant_security_foundation.sql`
3. Tenant policy definitions, still without activation:
   - `202608110002_define_tenant_rls_policies.sql`
4. Ownership immutability:
   - `202608110003_enforce_tenant_ownership_immutability.sql`
5. Communications hardening:
   - `202608110004_harden_twilio_communications.sql`
6. Explicit ownership backfill under a later EO.
7. Readiness verification and constraint validation under explicit authority.
8. RLS activation with `activate_rls.sql` under a later EO.

If production is behind, stop and record the first missing migration and the
ordered suffix required. Never skip directly to backfill or activation.

## Read-only evidence capture

Run the inspection artifact and retain an access-controlled result containing no
seller names, phones, addresses, messages, credentials, or other business data.
Capture only:

- migration versions and first missing migration;
- table/column/type/nullability differences;
- constraint names, definitions, and validation state;
- index names and definitions;
- policy names/commands and table RLS flags;
- per-table total, owned, null-owned, distinct-organization, and orphan counts;
- per-child-table missing-deal and cross-tenant counts;
- organization UUID, exact organization name, status, and creator UUID;
- membership organization UUID, user UUID, role, and status;
- readiness-report results.

The tenant tables are `deals`, `message_logs`, `seller_tasks`, `buyers`,
`documents`, `comps`, `sequences`, and `communication_consents`. Child/deal
validation applies to `message_logs`, `seller_tasks`, `documents`, `comps`, and
`sequences`.

## Personal-v1 target decision

A target organization may be proposed only when all of these are proven:

- exactly one intended active production organization exists;
- exactly one explicit active owner membership identifies the operator;
- the authenticated application owner UUID matches that membership;
- no table contains a conflicting non-null organization assignment;
- no orphan organization UUID exists;
- no missing-deal or cross-tenant child relationship exists;
- provenance supports that all unowned legacy rows originated in the same
  personal application.

Record the exact organization UUID, organization name, owner UUID, and null row
count for every table. If any condition is ambiguous, the target remains
**unresolved** and the rollout is NO-GO.

## Proposed backfill ordering

The reviewed template uses this relationship-aware order:

1. Reconfirm the target active organization and exact name.
2. Reconfirm the explicit active owner UUID and owner role.
3. Refuse every existing non-null assignment to another organization.
4. Refuse missing-deal or cross-tenant child relationships.
5. Capture pre-change ownership/readiness counts.
6. Assign only null `deals.organization_id`.
7. Assign only null child ownership where the parent deal is either absent by
   design (`deal_id is null`) or already belongs to the explicit target:
   `message_logs`, `seller_tasks`, `documents`, `comps`, then `sequences`.
8. Assign only null `buyers.organization_id`.
9. Do not rewrite `communication_consents`; its committed schema requires
   non-null ownership. Any unexpected null is a blocker.
10. Re-run null, orphan, child, owner, and readiness validation.
11. Default decision: `ROLLBACK`.

Before a later execution, replace the three placeholders, compare the template's
preflight counts with the approved change record, and peer-review every qualified
update. Converting the final `ROLLBACK` to `COMMIT` requires a later explicit EO.

## Production activation sequence

Do not perform these steps during EO-PROD-01.

1. Open the approved maintenance/change window.
2. Verify a current production backup and tested recovery point.
3. Pause application writes if the approved plan requires it.
4. Verify migration state against the ordered migration head.
5. Verify the explicit organization UUID and exact name.
6. Verify the explicit active owner membership and browser owner UUID.
7. Capture legacy ownership counts for every tenant table.
8. Execute the reviewed backfill script under the later EO.
9. Re-run the ownership report.
10. Confirm zero null tenant ownership.
11. Confirm zero orphan organization UUIDs.
12. Confirm zero missing-deal and cross-tenant child relationships.
13. Confirm every active organization has an active owner.
14. Run the database/RLS integration suite against current migration head.
15. Execute the reviewed `activate_rls.sql` artifact.
16. Verify RLS is enabled on all ten protected tables and required policies exist.
17. Run the authenticated production-safe smoke test.
18. Verify the owner workflow.
19. Verify analyst and viewer boundaries.
20. Verify authenticated Netlify API authorization.
21. Verify Inbox in test mode only.
22. Hold the rollback decision window with named approvers present.
23. Record sanitized post-change evidence and close the change window.

## Rollback modes

### Before RLS activation

- If the backfill transaction is still open, execute `ROLLBACK`.
- Re-run read-only counts and verify the pre-change state.
- Restore from the verified backup only if transactional rollback cannot recover
  the approved state.

### After RLS activation

- If an emergency access outage occurs, explicitly authorized security/database
  leadership may disable RLS as a temporary containment action.
- Disabling RLS reopens broader database access and must be treated as a security
  incident with a short remediation window.
- Do not remove organization ownership, delete tenant columns, destroy
  memberships, or perform blanket cleanup.
- Preserve evidence, identify the failed policy/path, and reactivate only after
  the database suite and smoke plan pass.

## Post-activation production-safe smoke plan

No real SMS is required or authorized.

1. Owner login succeeds and resolves the expected organization.
2. Today, Pipeline, Inbox, and Deal Decision Room load.
3. Only own-organization records are visible.
4. Viewer write is rejected.
5. An unauthenticated Netlify API request is rejected.
6. An authenticated user-originated Netlify function succeeds where the user's
   role and organization permit it.
7. An invalid unsigned Twilio webhook fails closed with no persistence or
   provider activity.
8. SMS remains in explicit test mode.
9. Cross-tenant URL, repository, and function access is rejected.
10. Health check responds safely without secret material.

## Deterministic GO/NO-GO checklist

Every item must be YES for GO. Any NO or UNKNOWN is NO-GO.

| Gate | Required evidence | Current |
|---|---|---|
| Production schema equals migration head | ledger plus schema drift report | UNKNOWN |
| Production RLS state known and pre-activation disabled | catalog flags | UNKNOWN |
| Explicit target organization confirmed | UUID and exact name | UNKNOWN |
| Explicit active owner confirmed | owner UUID and active membership | UNKNOWN |
| Authenticated app owner matches membership | controlled login evidence | UNKNOWN |
| Zero ambiguous/conflicting ownership | aggregate ownership report | UNKNOWN |
| Exact per-table backfill counts approved | captured null counts | UNKNOWN |
| Zero orphan organization UUIDs | aggregate orphan report | UNKNOWN |
| Zero child/deal inconsistencies | aggregate relationship report | UNKNOWN |
| Backfill script peer-reviewed | approval record | NO |
| Backup/recovery point verified | recovery evidence | UNKNOWN |
| Database/RLS validation green | current-head CI run | YES (repository baseline) |
| Browser E2E green | current-head CI run | YES (repository baseline) |
| CI green | current-head CI run | YES (repository baseline) |
| No secrets exposed | scan/evidence review | YES (repository baseline) |
| No unexplained migration drift | drift disposition | UNKNOWN |
| Rollback authority and steps ready | named approvers/change record | UNKNOWN |

**Current decision: NO-GO.** Obtain a dedicated production read-only connection,
run the inspection artifact, and resolve every UNKNOWN before requesting a later
backfill or RLS activation execution order.
