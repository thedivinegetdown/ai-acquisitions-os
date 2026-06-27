# SaaS Architecture

## Current Status

AI Acquisitions OS now has a SaaS foundation layer, but tenant enforcement is not fully active yet. Current single-user/local workflows continue to work as before.

## Foundation Services

- `src/services/saas/organizationContextService.js`
- `src/services/saas/userContextService.js`
- `src/services/saas/tenantService.js`
- `src/services/saas/index.js`

## Shared Types

- `src/types/saas.ts`

Contracts include:

- `Organization`
- `TenantContext`
- `UserContext`
- `UserRole`
- `TenantScopedRecord`
- `OrganizationSettings`

## Tenant Context

The current foundation provides:

- Current organization
- Current user
- Current role
- Active market
- Tenant ID placeholder
- Organization ID placeholder
- Enforcement status flag

Default local placeholders:

- Tenant ID: `local-tenant`
- Organization ID: `local-org`
- User ID: `local-user`

## Tenant Helpers

- `getTenantId`
- `getOrganizationId`
- `applyTenantScope`
- `isTenantScoped`
- `createTenantScopedPayload`

These helpers are available for future repository and API work. They are not globally applied yet.

## Current UI

`src/components/SaaSReadinessPanel.jsx` displays SaaS readiness, missing setup items, risks, and the recommended next setup action.

## Safety Boundary

This sprint does not:

- Enforce tenant filtering globally
- Change database schema
- Add billing
- Add Stripe
- Add org switching
- Change current permissions
- Block existing access

Tenant isolation should be enabled only after database schema, RLS policies, auth, and migration plans are complete.
