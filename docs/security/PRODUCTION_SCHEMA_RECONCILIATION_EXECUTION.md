# EO-PROD-03 production schema reconciliation execution

Date: 2026-08-13

Repository baseline: `2c68ee4fe055860214b2c7d623bd86388ebfcee7`

Final status: **PRODUCTION RECONCILIATION VERIFIED**

## Execution boundary

The approved additive reconciliation was executed once against the production
Supabase PostgreSQL database through a temporary Windows user-level
`EO_PROD_RECONCILIATION_DATABASE_URL`. Supabase's existing `postgres` database
owner performed the transaction. The connection string and password were never
printed, written to the repository, or included in this evidence.

No organization or membership row was created. No tenant or alias ownership was
backfilled. No legacy policy was removed, no RLS flag changed, and no provider
was invoked.

## Pinned recovery and source artifacts

- Source reconciliation SHA-256:
  `044C43664A8FD611E5BDE77FA7C855182635FD2E7179A146FFC42546E9941754`
- Verified recovery backup SHA-256:
  `56E2DD94DEE30E6452DBC76FCE8C85E7A4B23F88BE5C6DB5C99E7991BEA1178F`
- Ephemeral execution-copy SHA-256:
  `A2D222A2DB48B8153BEBD31B99CBD2C6F684B0F880576F97D8B2133668D893DD`

The ephemeral copy was created outside the repository after verifying the
source checksum. Only the final transaction terminator changed from `ROLLBACK`
to `COMMIT`; a prefix/suffix comparison rejected any other difference. The
ephemeral SQL was deleted after verification and was never tracked by Git.

## Maintenance and transaction

- Preflight recorded: 2026-08-13T22:42:24Z
- Transaction started: 2026-08-13T22:42:40.217Z
- Transaction committed: 2026-08-13T22:42:40.551Z
- Conflicting active schema sessions immediately before execution: 0
- Transaction result: **COMMITTED**

The execution used bounded lock and statement timeouts. The candidate ran as
one transaction. No application write pause was required.

## Starting and ending fingerprint

| Object | Starting rows | Ending rows |
|---|---:|---:|
| `deals` | 16 | 16 |
| `message_logs` | 7 | 7 |
| `buyers` | 0 | 0 |
| `documents` | 0 | 0 |
| `comps` | 0 | 0 |
| `sequences` | 0 | 0 |
| `"Deals"` | 0 | 0 |
| `activities` | 0 | 0 |
| `leads` | 1 | 1 |
| `seller_tasks` | missing | 0 |
| `organizations` | missing | 0 |
| `organization_memberships` | missing | 0 |
| `communication_consents` | missing | 0 |

Aggregate ordered-ID fingerprints for `deals`, `message_logs`, and `leads`
match the verified recovery evidence. No existing row or identifier was lost or
changed.

## Schema verification

The reconciliation installed the reviewed additive schema:

- four empty tables: `seller_tasks`, `organizations`,
  `organization_memberships`, and `communication_consents`;
- canonical deal compatibility fields, nullable tenant ownership fields, and
  message provider/status fields;
- 22 checked high-value repository columns;
- 25 expected named indexes;
- guarded checks and foreign keys from the pinned candidate;
- eight approved membership, ownership-readiness, and immutability helper
  functions;
- the reviewed future tenant policy definitions.

Legacy `"Deals"`, `activities`, `leads`, and the `deals.beds`, `deals.baths`,
`deals.condition`, and `deals.seller_price` fields remain present.

## Ownership and alias safety

- Organizations: 0 rows.
- Organization memberships: 0 rows.
- Communication consents: 0 rows.
- Seller tasks: 0 rows.
- Non-null `organization_id` values across all legacy tenant tables: 0.
- Non-null `bedrooms`, `bathrooms`, `property_condition`, and `asking_price`
  values on existing deals: 0.

No ownership or alias backfill occurred. In particular,
`seller_price -> asking_price` remains deferred.

## RLS and policy preservation

All nine pre-existing production tables retain their original RLS-enabled
state. RLS was not enabled on the four new tables. The pre-existing policies
remain unchanged:

- `deals`: `Allow all for now`, `ALL`, role `public`;
- `message_logs`: `Allow read access`, `SELECT`, role `public`.

The post-commit catalog contains 28 policies: the two legacy policies plus the
reviewed future tenant definitions. This execution did not perform the tenant
enforcement cutover.

## Production-safe smoke

Only anonymous, non-mutating probes were run:

- production root: HTTP 200 with the application shell;
- production login route: HTTP 200 with the authentication shell;
- health check: safe HTTP 503 configuration-unavailable response with no
  credential leakage;
- unauthenticated outbound SMS API: HTTP 401 rejection.

No deal/message creation, SMS, email, AI, checkout, billing, or other provider
activity occurred.

## Credential and artifact cleanup

- `EO_PROD_RECONCILIATION_DATABASE_URL` removed from Windows user storage and
  verified absent;
- credential state cleared from the dashboard automation session;
- ephemeral execution SQL deleted and verified absent;
- permanent `EO_PROD_READ_ONLY_DATABASE_URL` retained;
- verified recovery backup retained unchanged.

## Repository validation

- Reconciliation/readiness/schema contract tests: 47 passed.
- Netlify Function tests: 102 passed.
- Full Vitest suite: 84 files and 870 tests passed.
- ESLint: 0 errors and 49 pre-existing warnings.
- Production build: passed.
- `git diff --check`: passed.
- Secret and production-row-data scans: passed; no sensitive values entered the
  evidence or tracked changes.
- Backup and ephemeral execution artifacts tracked by Git: none.

## Safety confirmation

- Production reconciliation committed: **YES, pinned candidate only**
- Existing production rows or IDs changed: **NO**
- Organization created: **NO**
- Membership created: **NO**
- Ownership backfilled: **NO**
- Alias backfilled: **NO**
- Legacy policy removed: **NO**
- RLS enablement changed: **NO**
- Provider activity: **NO**
- Credential committed or retained after verification: **NO**
- Production row data committed: **NO**
