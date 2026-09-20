# EO-PROD-04T Production Tenant/RLS Cutover Evidence

## Execution boundary

- Execution UTC: `2026-08-14T03:06:55Z`
- Repository baseline: `417ca41268311bf111900f886d5268a715374b69`
- Recovery backup SHA-256: `56E2DD94DEE30E6452DBC76FCE8C85E7A4B23F88BE5C6DB5C99E7991BEA1178F`
- Ephemeral cutover SQL SHA-256: `F375C756033C42E46B30EE8198DFC7B386580C21B924FCEB33C70BCF428B2F5C`
- Production transaction: committed once
- Provider activity: none

The execution was limited to the approved ownership-trigger correction,
personal-v1 organization and owner-membership bootstrap, NULL-only tenant
ownership assignment, three approved alias backfills, readiness validation,
remaining RLS enablement, and removal of the two named legacy policies.

## Trigger defect and durable correction

The reconciliation-installed `prevent_organization_transfer()` function
rejected every organization change, including the required initial
`NULL -> organization UUID` assignment. The corrected rule now:

- permits the one-time `NULL -> organization UUID` assignment;
- permits ordinary updates that retain the same organization;
- rejects `organization A -> organization B`;
- rejects `organization A -> NULL`.

The correction is represented by the additive migration
`202608130001_allow_initial_tenant_ownership_assignment.sql`, the canonical
reconciliation definition, the real-PostgreSQL harness, and focused repository
contract tests. It does not use a session flag, disable triggers, or create an
application-accessible bypass.

Disposable production-shaped PostgreSQL validation passed before production:

- reconciliation applied twice without row loss;
- 16 synthetic deals, 7 synthetic messages, and 1 synthetic lead preserved;
- initial ownership assignment succeeded;
- same-owner ordinary update succeeded;
- transfer and ownership clearing were denied;
- final ownership was 16 deals and 7 messages;
- alias updates were 11 bedrooms, 11 bathrooms, and 1 property condition;
- `asking_price` remained empty;
- all 10 tenant tables had RLS and both synthetic legacy policies were removed.

## Production preflight

Immediately before the transaction, the production state matched the approved
fingerprint:

| Object | Rows |
| --- | ---: |
| `deals` | 16 |
| `message_logs` | 7 |
| `leads` | 1 |
| `buyers` | 0 |
| `documents` | 0 |
| `comps` | 0 |
| `sequences` | 0 |
| `"Deals"` | 0 |
| `activities` | 0 |
| `seller_tasks` | 0 |
| `organizations` | 0 |
| `organization_memberships` | 0 |
| `communication_consents` | 0 |

All tenant ownership values were NULL. Alias sources were 11 `beds`, 11
`baths`, and 1 `condition`; all four canonical targets were empty. The
confirmed owner account was active, 29/29 reviewed tenant policies were
present, both expected legacy policies were present, eight ownership triggers
were attached, and no conflicting database operation was active.

## Committed production result

The fail-closed transaction completed with these results:

- exactly one active `AI Acquisitions OS` organization created;
- exactly one active owner membership created;
- 16 deals and 7 message logs assigned to that organization;
- zero ownership conflicts, orphans, NULL-owned populated rows, or child/deal
  mismatches;
- 11 `beds -> bedrooms`, 11 `baths -> bathrooms`, and 1
  `condition -> property_condition` NULL-only updates;
- `seller_price -> asking_price` not performed and `asking_price` remains
  empty;
- tenant readiness true with zero violations;
- 29/29 reviewed tenant policies retained;
- `deals."Allow all for now"` removed;
- `message_logs."Allow read access"` removed;
- all 10 tenant tables RLS-enabled;
- eight ownership triggers retained with corrected semantics.

The ending row counts remain 16 deals, 7 messages, 1 lead, and zero rows in
buyers, documents, comps, sequences, seller tasks, and communication consents.
The aggregate ID fingerprints for deals, message logs, and leads match the
verified recovery evidence exactly.

Database-level security verification passed:

- anonymous deal and message reads returned zero rows;
- the authenticated owner policy context read all 16 deals, all 7 messages,
  the organization, and the membership;
- an allowed owner update succeeded inside a rollback-only verification
  transaction;
- attempted ownership transfer and clearing were denied.

## Production application cutover completion

The existing Netlify site `ai-acquisitions-divine.netlify.app` was retained.
The two public frontend inputs, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, retained their production values and were corrected
from write-only secret metadata to public Vite build inputs. No other
environment variable was changed. `SUPABASE_SERVICE_ROLE_KEY` remains a
write-only server secret and was not exposed to the browser.

One production deployment was published as Netlify deploy
`6aaf2fa02d703bac23f78642`. The production client bundle contains the expected
Supabase project URL and an anon-role JWT. It contains no service-role JWT and
no `SUPABASE_SERVICE_ROLE_KEY` variable name.

Focused unauthenticated production checks passed:

- `/`, `/login`, `/today`, `/pipeline`, `/inbox`, `/approvals`, and the
  route shell used by the deal Decision Room returned HTTP 200;
- `/.netlify/functions/health-check` returned HTTP 200 with configured status;
- all user-facing protected Functions tested without a bearer token returned
  HTTP 401;
- unsigned Twilio inbound and status callbacks remained fail-closed with HTTP
  503 because the unrelated Twilio production configuration is intentionally
  incomplete;
- no SMS, email, AI, billing, or record-creation action was invoked.

Focused authenticated owner smoke passed:

- the production owner session loaded successfully;
- Settings displayed organization name `AI Acquisitions OS` and owner role;
- Today rendered the live decision-first acquisition queue;
- Pipeline loaded exactly 16 opportunities;
- Inbox loaded the production conversation and its bounded message history;
- Approvals loaded 16 pending approval items;
- a real deal route rendered the deal-level Decision Room;
- the previously verified production cutover evidence remains exactly 16
  organization-owned deals, 7 organization-owned message rows, and zero
  anonymous visibility. These database/RLS checks were not rerun during the
  focused application smoke.

## Repository validation

- Ownership/RLS focused contracts: 30 tests passed.
- Real PostgreSQL Database RLS Validation: 9 migrations applied to two clean
  databases with matching schema fingerprints.
- Disposable production-shaped reconciliation and cutover: passed.
- Browser E2E: 20/20 passed.
- Netlify Function tests: 102/102 passed.
- Full Vitest suite: 84 files, 871/871 tests passed using synthetic public test
  client placeholders.
- ESLint: 0 errors, 49 pre-existing warnings.
- Production build: passed.

## Safety confirmations

- Production rows deleted: **NO**
- Existing IDs changed: **NO**
- Second organization created: **NO**
- Unapproved alias backfill: **NO**
- Legacy tenant policies removed: **NO**
- RLS disabled: **NO**
- Provider activity: **NO**
- SMS/email/AI/billing activity: **NO**
- Credentials or production row contents recorded: **NO**
- Production deployments during completion: **ONE**
- Other Netlify environment variables changed: **NO**
- Service-role secret exposed to the client: **NO**

## Final status

**PRODUCTION TENANT / RLS CUTOVER VERIFIED**

The database tenant/RLS cutover, production application configuration, single
production deployment, public-client secret boundary, unauthenticated API
controls, and authenticated owner smoke are complete. The final readiness audit
is explicitly outside this execution.
