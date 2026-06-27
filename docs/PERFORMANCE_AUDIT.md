# Performance Audit

Production Readiness Sprint PR-4 reviewed render cost, data loading, bundle output, caching, and major product surfaces.

## Findings

### React Rendering

- `App` recreated handlers and page section props on every render.
- `SectionRenderer` was not memoized.
- `PipelineBoard` filtered the full deal list once for every pipeline stage during render.
- Search recomputed the command index synchronously on every keystroke.
- Executive dashboard rebuilt metric arrays on each render even when dashboard data was unchanged.

### Data Fetching

- Conversation-related panels can request the same message logs independently.
- Buyer records were loaded by buyer board and buyer matching independently.
- Conversation summaries already used a short cache.
- Deal loading is centralized through `useDealData`, so no additional deal-fetch cache was added in PR-4.

### Bundle

- `AppSections` eagerly imported many panels that are not needed for first paint.
- Several heavier panels were already lazy-loaded, including seller workspace sub-panels.
- Main chunk had room to improve by pushing below-fold panels into async chunks.

### Component Size

Oversized or future-split candidates:

- `ConversationThread`
- `SearchCommandCenter`
- `LeadImporter`
- `CommunicationsHubPanel`
- `PropertyIntelligencePanel`
- `BillingSubscriptionPanel`

These were not split further in PR-4 because current lazy boundaries already keep most of them off the initial path, and deeper splitting should be guided by profiling.

## Optimizations Performed

- Lazy-loaded additional page sections.
- Memoized the section renderer.
- Stabilized app callbacks and section configuration.
- Memoized pipeline board and grouped staged deals with `useMemo`.
- Added deferred search query processing.
- Memoized search result cards.
- Added short TTL cache for message log reads.
- Added short TTL cache for buyer reads.
- Added cache invalidation on message insert/realtime insert and buyer creation.
- Memoized executive dashboard metric arrays.

## Build Result

After PR-4:

- Tests passed: 21 tests.
- Production build passed.
- Main `index` chunk decreased to about 316 kB uncompressed and 99 kB gzip.

Before PR-4, the main `index` chunk from PR-3 was about 365 kB uncompressed and 111 kB gzip.

Estimated main chunk reduction:

- About 49 kB uncompressed.
- About 12 kB gzip.
- Roughly 13 percent smaller main chunk.

## Remaining Bottlenecks

- Supabase client/repository chunk is still large.
- Long message lists render without virtualization.
- Pipeline cards render all deals in every stage.
- Search index is built in the browser from loaded data.
- Seller workspace sub-panels may independently derive similar conversation intelligence.
- Caching is in-memory only and resets on page reload.
- No server-side pagination yet.

## Recommendations Before PR-5

- Add server-side auth/RLS work before deeper data-query optimization.
- Add pagination contracts for high-volume tables.
- Add list virtualization only after expected production row counts are known.
- Profile seller workspace after real data volume exists.
- Consider a workspace-level conversation data provider to share loaded thread messages across AI, workflow, offer, and communication panels.
