# Search Command Center

## Goal

Provide a centralized search and command surface for quickly finding sellers, deals, conversations, tasks, buyers, transactions, documents, campaigns, AI recommendations, and workflow items.

## Current Foundation

Epic 29 adds search services under `src/services/search`:

- `searchIndexService`: builds normalized searchable records.
- `searchFilterService`: applies entity, stage, market, source, priority, status, and date filters.
- `searchService`: runs global search and returns grouped UI-ready results.
- `commandCenterService`: defines safe command action metadata.

## Supported Result Types

- Sellers
- Deals
- Phone numbers
- Property addresses
- Conversations
- Tasks
- Buyers
- Transactions
- Documents
- Campaigns
- AI recommendations
- Workflow items

Some result types are foundation projections from currently loaded deals until dedicated persisted records are available.

## Supported Filters

- Entity type
- Pipeline stage
- Market
- Lead source
- Priority
- Status
- Date range

## Command Actions

Current actions are view/navigation only:

- Open seller workspace
- Open conversation
- View AI recommendation
- View next best action
- View transaction checklist
- View buyer matches
- View documents
- View campaign performance
- View workflow items

No destructive actions are available. The command center does not send messages, run AI automatically, execute workflows, or update the database.

## Current Limitations

- Search indexes currently use loaded client-side data.
- Conversations, tasks, buyers, transactions, documents, AI, and workflow items are represented through foundation/deal-derived records unless dedicated data is already loaded.
- No server-side search index exists yet.
- No database schema changes were made.

## Future Work

- Add tenant-aware server-side search.
- Add persisted command history.
- Add permission-aware results.
- Add keyboard navigation and modal mode.
- Add dedicated indexes for conversations, tasks, buyers, documents, workflows, and AI insights.
- Add relevance tuning after real usage data exists.
