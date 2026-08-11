# Tenant RLS rollout

EO-SEC-01 defines the tenant model and policies but deliberately leaves row-level security disabled. Policy presence is not enforcement. Production activation is a separate, manually authorized operation.

## Staged rollout

1. Apply the committed migrations in a non-production environment.
2. Create the initial organization and owner membership through `create_personal_organization`; never accept a caller-supplied owner user ID.
3. Assign every legacy row to an organization through a reviewed, explicit backfill. The nullable columns exist only to permit this transition.
4. Resolve every row returned by `tenant_rls_readiness_report()`. All issue counts must be zero, including missing ownership, orphan ownership, cross-organization deal relationships, and organizations without an active owner.
5. Validate the `NOT VALID` foreign-key constraints after the data is clean.
6. Confirm client writes obtain `organization_id` from authenticated membership context, not component input.
7. Confirm server-only Netlify Functions resolve and authorize organization ownership before writing. Their service-role access bypasses RLS and remains an activation blocker until a later security order closes that gap.
8. Run authenticated owner, admin, analyst, viewer, non-member, and anonymous integration tests in staging. Confirm viewers cannot write and no client can transfer row ownership.
9. In a reviewed staging transaction, run `supabase/security/activate_rls.sql`. It fails before activation unless readiness and required-policy checks pass.
10. Repeat the approved backfill/readiness/integration process for production, then run the activation script manually during a monitored change window and complete read/write smoke tests.

## Authority boundaries

Database membership roles (`owner`, `admin`, `analyst`, `viewer`) are authoritative for tenant access. Existing user-metadata roles may guide the interface, but they do not grant database access.

Table owners and server clients using the Supabase service role can bypass ordinary RLS enforcement. They are controlled administrative paths, not tenant-user paths. This execution order does not alter Netlify authentication, inbound SMS, outbound SMS, or production data.

Repository reads intentionally rely on RLS after activation instead of adding transitional client-side filters that would hide legacy rows before backfill. Until activation, the repository continues to operate under the existing database access model.
