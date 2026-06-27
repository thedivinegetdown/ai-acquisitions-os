# QA Gaps

This document captures the current quality gaps after PR-5 and the areas that still require dedicated coverage before a production release candidate.

## PR-5 Production Quality Score

- Production quality score: 72/100

## Remaining QA Gaps

- No browser end-to-end (E2E) suite yet.
- Endpoint-level Netlify Function tests need expansion beyond shared helper coverage.
- No Supabase local integration / RLS test harness yet.
- No coverage threshold enforcement in CI yet.
- Seller Workspace needs deeper workflow tests.
- Property Intelligence needs deeper workflow tests.
- Transaction Management needs deeper workflow tests.
- Conversation Hub needs deeper workflow tests.

## Impact Areas

- Workflow confidence is still limited for high-value seller and deal operations.
- API boundary hardening is incomplete for server-side Netlify Functions.
- Data access and row-level security behavior remain unvalidated in a local integration context.
- Coverage tracking is not yet raising visibility on missing gaps in CI.

## Immediate Focus

1. Expand endpoint tests for all Netlify Functions, including request validation, safe error responses, and secret handling.
2. Add workflow tests for Seller Workspace, Property Intelligence, Transaction Management, and Conversation Hub.
3. Introduce a local Supabase integration harness to validate RLS and tenant-scoped access.
4. Enable coverage thresholds on critical folders once functional tests are stable.
