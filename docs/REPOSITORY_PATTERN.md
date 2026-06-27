# Repository Pattern

Production data access should use repositories as the only boundary for raw Supabase table operations.

## Goals

- Keep UI components focused on rendering and user interactions.
- Keep business services free from ad hoc Supabase CRUD.
- Centralize validation and normalization before writes.
- Prepare for tenant scoping, RLS, audit logging, and retries.
- Preserve backwards compatibility while persistence is hardened incrementally.

## Location

Repositories live in:

`src/services/repositories/`

The repository barrel is:

`src/services/repositories/index.js`

## Result Shape

Repositories return service result objects:

```js
{
  success: true,
  data: value,
  metadata: {}
}
```

or:

```js
{
  success: false,
  error: {
    message: "User safe message",
    cause: originalError
  },
  metadata: {}
}
```

Components should not inspect raw Supabase errors directly.

## Current Repositories

- `dealRepository`: list, single lookup, single update, bulk update.
- `buyerRepository`: list and create buyers.
- `documentRepository`: list and create deal documents.
- `propertyRepository`: list and create comps.
- `sellerTaskRepository`: list, create, and update seller tasks.
- `workflowRepository`: list, create, and update follow-up sequence records.
- `conversationRepository`: compatibility exports for SMS conversation persistence.
- `transactionRepository`: transaction field update wrapper.
- `notificationRepository`: placeholder boundary for derived notification persistence.
- `organizationRepository`: placeholder boundary for local organization context.

## Rules

- Components and hooks should not import `supabaseClient`.
- Repositories may import `supabaseClient`.
- Auth services may import `supabaseClient`.
- Netlify Functions may create server Supabase clients, but must validate external signatures and authenticated user tokens where appropriate.
- Validation belongs in repositories or domain services, not inline in components.
- Business services can compose repositories, but should not duplicate raw CRUD.

## Incremental Migration Path

1. Keep existing behavior working.
2. Move active UI CRUD to repositories.
3. Add schemas and RLS policies.
4. Add tenant scoping to repository queries.
5. Add audit logging for high-risk writes.
6. Add tests around repositories before broader enforcement.

## Avoid

- Direct `.from(...).insert/update/delete` calls in components.
- Multiple components writing the same table with different payload shapes.
- Client-side hard deletes.
- Persisting new resource types without migrations.
- Adding tenant enforcement before existing rows are backfilled.
