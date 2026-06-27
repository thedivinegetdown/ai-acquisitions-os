# Performance

AI Acquisitions OS uses React, Vite, Supabase, and Netlify Functions. Production performance work should prioritize measurable render, data-fetching, and bundle-size improvements without changing product behavior.

## Current Optimizations

Implemented in PR-4:

- More below-fold panels are lazy-loaded from `AppSections`.
- Main app callbacks and section configuration are stabilized with `useCallback` and `useMemo`.
- `SectionRenderer`, `PipelineBoard`, `ResultCard`, and `ExecutiveDashboard` use memoization where prop stability matters.
- Pipeline board groups deals once per deal-list change instead of filtering the full deal array once per stage on every render.
- Search uses `useDeferredValue` so typing stays responsive while the command index recalculates.
- Conversation message reads use a short TTL cache with invalidation after inserts and realtime messages.
- Buyer list reads use a short TTL cache and invalidate after buyer creation.
- Executive dashboard metric arrays are memoized from dashboard output.

## Data Fetching

Current cached reads:

- Conversation summaries: cached by existing conversation service.
- Message logs: cached for 5 seconds by query shape.
- Buyers: cached for 10 seconds by sort shape.

Cache invalidation:

- Message log cache clears on outbound insert and realtime inbound insert.
- Buyer cache clears after buyer creation.

The short TTLs are intentionally conservative because the app still lacks a server-backed query cache or invalidation bus.

## Bundle Notes

PR-4 reduced the main app chunk by moving many panels out of the initial bundle.

Observed production build after PR-4:

- Main `index` chunk: about 316 kB uncompressed, about 99 kB gzip.
- Largest async chunk: Supabase/conversation repository chunk at about 187 kB uncompressed, about 49 kB gzip.
- Seller workspace chunk remains about 57 kB uncompressed.

The largest remaining bundle cost is Supabase client code. That is expected while browser-side Supabase remains the data client.

## React Guidelines

Use memoization only when:

- A component is large or repeated.
- Props are stable enough for memoization to help.
- Derived work scans large arrays or creates large objects.
- UI responsiveness suffers during typing or filtering.

Avoid memoization when:

- The component is small.
- The inputs always change.
- The memo adds complexity without reducing work.

## Remaining Opportunities

- Add pagination or virtualization for large message, deal, search, and activity lists.
- Move repeated conversation-thread message loading into a shared hook/provider for the seller workspace.
- Add server-side pagination for `deals`, `message_logs`, `buyers`, and future tenant data.
- Add query-level caching once auth/RLS and tenant boundaries are complete.
- Split Supabase-heavy repository chunks further only if measured load time requires it.
- Replace broad client-side search indexing with a persisted/search-service strategy when data volume grows.
