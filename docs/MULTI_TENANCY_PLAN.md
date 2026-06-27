# Multi-Tenancy Plan

## Goal

Move AI Acquisitions OS from local/single-organization usage toward safe multi-tenant SaaS without breaking existing workflows.

## Phase 1: Foundation

Completed foundation:

- SaaS context services
- Tenant helper utilities
- Shared SaaS TypeScript contracts
- SaaS Readiness panel
- Documentation

Tenant enforcement is intentionally inactive.

## Phase 2: Data Model Planning

Design and review tables for:

- Organizations
- Organization memberships
- User profiles
- Roles and permissions
- Tenant-scoped settings
- Audit logs

Decide tenant columns:

- `tenant_id`
- `organization_id`

## Phase 3: Supabase RLS

Add RLS policies after schema approval.

Required policy areas:

- Deals
- Message logs
- Tasks
- Buyers
- Transactions
- Documents
- Automation/workflows
- Settings

## Phase 4: Repository Adoption

Apply tenant helpers to repositories and service data access:

- Reads should filter by tenant and organization.
- Writes should add tenant and organization IDs.
- System/admin workflows should use explicit elevated server-side paths.

Do not apply global filtering before migration and backfill are complete.

## Phase 5: User And Org UX

Add:

- Organization switcher
- Team invitations
- Membership management
- Role enforcement
- Settings persistence
- Audit visibility

## Phase 6: Billing

Add billing after tenant isolation is reliable:

- Stripe customer mapping
- Subscription status
- Plan limits
- Billing portal
- Usage and entitlement checks

## Risks

- Applying tenant filters before legacy records are backfilled can hide existing data.
- Missing RLS policies can leak tenant data.
- Over-enforcing permissions too early can block current workflows.
- Serverless functions need tenant-aware validation before production SaaS usage.

## Recommended Next Step

Create a database schema and migration proposal for organizations, memberships, tenant-scoped settings, and RLS policy rollout.
