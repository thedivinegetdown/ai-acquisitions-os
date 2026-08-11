# Local database and RLS execution validation

EO-VAL-01 adds a real PostgreSQL execution gate. Static migration-contract tests remain useful, but they are not evidence that migrations or RLS policies executed.

## Safety boundary

The runner refuses to start unless all of these conditions are true:

- `ALLOW_LOCAL_DB_TESTS=true` is set explicitly.
- both database hosts are `localhost`, `127.0.0.1`, or `::1`;
- both database names begin with `eo_val_`;
- the two database names are different;
- both databases contain no application tables in `public`;
- `psql` is available.

It never reads `.env`, accepts a Supabase project host, creates a production connection, or resets an existing database. Supply two newly created local databases so the complete migration and activation sequence is independently rebuilt twice.

## Run locally

Install a local PostgreSQL server and client, create two empty disposable databases, and run:

```powershell
$env:ALLOW_LOCAL_DB_TESTS = "true"
$env:EO_VAL_DATABASE_URL_A = "postgresql://postgres:local-only@127.0.0.1:5432/eo_val_a"
$env:EO_VAL_DATABASE_URL_B = "postgresql://postgres:local-only@127.0.0.1:5432/eo_val_b"
npm run test:rls
```

Use fake local credentials only. Do not reuse a production or staging password.

The runner applies all committed migrations in filename order, verifies schema objects, creates synthetic tenants, proves unsafe activation is blocked, performs only the explicit synthetic legacy-row backfill, activates RLS locally, executes authenticated role/isolation assertions, and compares deterministic schema fingerprints across both databases.

## Covered execution cases

- missing ownership, orphan ownership, ownerless organization, cross-tenant child, and missing-policy activation failures;
- clean activation and all ten intended RLS-enabled tables;
- owner, analyst, viewer, owner-of-another-tenant, and anonymous access;
- membership creation and self-promotion boundaries;
- immutable tenant ownership;
- cross-tenant deal relationships for messages, tasks, documents, comps, and sequences;
- communication-consent read/write isolation;
- contained service-role `BYPASSRLS` behavior;
- eight migrations applied independently to two clean databases with matching fingerprints.

## CI behavior

`.github/workflows/database-rls-validation.yml` runs this as a separate pull-request job using two disposable databases on a PostgreSQL service container. It does not contact Supabase or any external database. Normal unit tests do not download or start PostgreSQL.

If the integration job has not run successfully, report database/RLS execution as **not validated**. Never substitute the static harness contract test for the database job.
