# Authorization

AI Acquisitions OS now has a reusable authorization foundation, but PR-1 does not fully enforce permissions.

## Roles

The current role foundation supports:

- Owner
- Admin
- Acquisitions Manager
- Dispositions Manager
- Transaction Coordinator
- Viewer

These roles are shared with the existing team permission foundation in `src/services/team/permissionService.js`.

## Permission Helpers

Authorization helpers live in `src/services/auth/authorizationService.js`.

Available helpers include:

- `normalizeRole(role)`
- `getRoleFromUser(user)`
- `getPermissionsForUser(user)`
- `hasPermission(userOrRole, permissionKey)`
- `hasAnyPermission(userOrRole, permissionKeys)`
- `hasAllPermissions(userOrRole, permissionKeys)`
- `canAccessRole(userOrRole, allowedRoles)`

React code should prefer `usePermissions()` from `src/hooks/usePermissions.js`.

## Role Source

The helper layer reads role values from Supabase user metadata in this order:

- `user.app_metadata.role`
- `user.user_metadata.role`
- fallback role

The current fallback role is `Viewer`.

## Enforcement Status

Permissions are advisory in PR-1. They are ready for UI visibility checks and future route/action guards, but they are not yet enforced across workflows.

Do not rely on client-side permission checks for data security. Production enforcement must include:

- Supabase Row Level Security policies
- server-side JWT verification in Netlify Functions
- organization membership records
- role assignment auditability

## PR-2 Recommendations

- Create persisted organization membership records linked to Supabase user IDs.
- Decide whether roles are stored in `app_metadata` or membership tables.
- Add RLS policies for tenant-owned tables.
- Add server-side authorization helpers for Netlify Functions.
- Add tests for role normalization and permission helper behavior.
