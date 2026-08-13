# Production Backup Recovery Evidence

## Verification Status

**BACKUP / RECOVERY VERIFIED**

This record documents EO-PROD-BACKUP-01R verification of the production public-schema backup and a reconciliation dry run against a disposable local restore. No production system was changed or written.

## Backup Artifact

- Backup operation: 2026-08-13 20:52:14Z through 20:52:19Z
- Location: `F:\AI-Acquisitions-Backups\2026-08-13T205214Z\ai-acquisitions-production-public.dump` (outside the repository)
- Format: PostgreSQL custom-format archive, gzip compressed
- Source PostgreSQL version: 17.6
- `pg_dump` / restore tooling version: 17.10
- File size: 21,041 bytes
- SHA-256: `56E2DD94DEE30E6452DBC76FCE8C85E7A4B23F88BE5C6DB5C99E7991BEA1178F`
- Archive integrity (`pg_restore --list`): PASS

## Disposable Restore

- Fresh isolated local PostgreSQL restore: PASS
- Production access during restore verification: NONE
- Supabase-managed `auth` data: intentionally excluded
- Restore fingerprint:

| Public table | Rows | Aggregate ID fingerprint |
| --- | ---: | --- |
| `deals` | 16 | `fa73ecc208306cc676d539f5e50015c4` |
| `message_logs` | 7 | `907678fb8d420a40e08e4afa02db2c05` |
| `leads` | 1 | `a6c294cd9160a7c77959b516c810b223` |
| `buyers` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `documents` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `comps` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `sequences` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `Deals` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `activities` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |

The restored row counts and aggregate ID fingerprints matched the approved backup manifest exactly.

## Disposable Auth Compatibility

The public-only archive intentionally contains no Supabase-managed auth schema or identities. The disposable database received one compatibility function solely so the unchanged reconciliation candidate could parse and execute:

```sql
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT NULL::uuid $$;
```

The disposable `auth` schema contained no tables and no other functions. The stub always returned `NULL`, contained no authentication logic, and contained no production identity. Empty `NOLOGIN` role shells for the candidate's existing `authenticated` and `service_role` grant targets contained no users, memberships, credentials, or provider metadata. All compatibility objects existed only inside the disposable cluster and were removed with it.

No production migration or production reconciliation artifact defines or installs this stub.

## Reconciliation Verification

- Candidate: `supabase/security/production_schema_reconciliation.sql`
- Candidate SHA-256: `044C43664A8FD611E5BDE77FA7C855182635FD2E7179A146FFC42546E9941754`
- Approved disposable harness safety check: PASS
- Disposable reconciliation dry run: PASS
- Row and aggregate ID preservation: PASS
- Required compatibility tables, columns, provider/status fields, indexes, constraints, and helper functions: PASS
- `seller_tasks` created empty: PASS
- `organizations` created empty: PASS
- `organization_memberships` created empty: PASS
- `communication_consents` created empty: PASS
- Legacy tables and fields retained: PASS
- Ownership backfill count: 0
- Provider/status backfill count: 0
- Original RLS flags unchanged: PASS
- Original legacy policy definitions unchanged: PASS
- Provider activity: NONE

## Cleanup And Safety

- Disposable database dropped: PASS
- Disposable PostgreSQL cluster removed: PASS
- Temporary compatibility objects and local verification files removed: PASS
- Local PostgreSQL authentication configuration restored and hash-matched to its original state: PASS
- Verified backup and external recovery manifest preserved: PASS
- Backup tracked by Git: NO
- Production row data added to the repository: NO
- Production changed: NO
- Production auth copied: NO
- Production reconciliation executed: NO
- Production data written: NO
- Production schema changed: NO
- Production organization or membership created: NO
- Production ownership backfilled: NO
- Production RLS changed: NO

The verified recovery evidence consists of the production public-schema backup, matching archive checksum, successful clean restore, exact production fingerprint match, successful reconciliation dry run on the restored production shape, zero row/ID loss, and the disposable-only auth compatibility stub.
