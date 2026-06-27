# Engineering Handoff

AI Acquisitions OS Version 1.0 Release Candidate

## 1. System Overview

AI Acquisitions OS is a React/Vite application for real estate acquisition workflows. It combines deal pipeline management, seller conversations, buyer matching, AI-assisted deal intelligence, workflow automation, notifications, transaction management, billing foundations, and operational readiness tooling.

Version 1.0 is feature-complete and has reached Release Candidate readiness with the recommendation `READY WITH MINOR FIXES`.

Current release posture:

- Package version: `1.0.0`
- Recommended RC tag: `v1.0.0-rc.1`
- Recommended final tag: `v1.0.0`
- Overall production readiness score: `85 / 100`
- Automated gates pass: build, tests, and lint
- Remaining launch work: staging smoke validation, environment review, and release-owner approval

## 2. Architecture Summary

Core stack:

- React
- Vite
- Supabase
- Netlify Functions
- Twilio
- OpenAI through server-side Netlify Functions
- Stripe foundation
- Vitest and Testing Library

Primary architectural principles:

- UI components render data and call hooks/services.
- Business logic belongs in `src/services` or feature services.
- Supabase CRUD should move through repository boundaries.
- Server-only provider calls belong in Netlify Functions.
- AI features must preserve rule-based fallback behavior.
- Large application sections should remain lazy-loaded where practical.
- Secrets must never enter client bundles.

Important folders:

- `src/components`: shared and legacy UI components.
- `src/features`: larger product areas with components, hooks, services, and types.
- `src/services`: business logic, providers, repositories, logging, monitoring, cache, API clients, and config.
- `src/hooks`: shared app hooks.
- `src/utils`: pure utility helpers.
- `src/types`: TypeScript contract definitions for future migration.
- `netlify/functions`: server-side integration boundary.
- `supabase`: migrations and database setup.
- `docs`: architecture, operations, release, testing, and launch documentation.
- `e2e`: reserved for browser E2E tests.

## 3. Major Features

Implemented product areas include:

- Authentication foundation and protected route behavior.
- Executive dashboard and KPI surfaces.
- Deal pipeline and deal modal workflows.
- Buyer CRM and buyer matching.
- Seller conversation inbox and thread workflows.
- AI Copilot and AI intelligence panels.
- Workflow engine and automation sequence foundations.
- Notification center and action inbox.
- Command/search center.
- Lead importer, duplicate detection, and data health tooling.
- Property intelligence and comps foundations.
- Offer system and offer readiness/strategy tools.
- Transaction management and document preparation foundations.
- SMS integration through Twilio.
- Email, calling, and property provider foundations.
- Stripe checkout, billing portal, and webhook foundations.
- SaaS readiness, team roles, and organization settings foundations.
- Operational health and release readiness documentation.

## 4. AI Architecture

The AI architecture is designed to keep provider access server-side while preserving deterministic fallback behavior.

Key client/service modules:

- `src/services/ai/aiGateway.js`
- `src/services/ai/openAiProvider.js`
- `src/services/ai/promptBuilder.js`
- `src/services/ai/responseParser.js`
- `src/services/ai/tokenEstimator.js`
- `src/services/ai/conversationMemory.js`
- `src/features/copilot`
- `src/services/intelligence`

Key Netlify Functions:

- `netlify/functions/ai-chat.js`
- `netlify/functions/ai-analysis.js`
- `netlify/functions/ai-summary.js`

AI behavior:

- Client code calls AI services or Copilot hooks.
- Prompt construction happens in service code, not UI components.
- OpenAI requests go through Netlify Functions.
- `OPENAI_API_KEY` remains server-side.
- If OpenAI is unavailable, rule-based fallback output should remain usable.
- AI output is internal guidance and should not automatically send messages or perform irreversible actions.

## 5. Deployment Architecture

The supported deployment target is Netlify.

Build settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node bundler: `esbuild`

CI:

- GitHub Actions runs on pull requests and pushes to `main` or `master`.
- CI installs with `npm ci`.
- CI runs lint, tests, and build.
- CI uses safe placeholder client environment variables.

Runtime boundaries:

- Static React app is served from `dist`.
- Netlify Functions handle server-only integration behavior.
- Supabase is used by browser-safe client flows and server-side webhook/function flows.

## 6. Environment Variables

Client-safe variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_NETLIFY_FUNCTIONS_BASE`

Server-only variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_PHONE`
- `SMS_TEST_MODE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ENTERPRISE`
- `APP_URL`

Optional or future provider variables:

- `PROPERTY_DATA_PROVIDER`
- `PROPERTY_DATA_API_KEY`
- `PROPERTY_DATA_API_BASE_URL`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_WEBHOOK_SECRET`
- `CALLING_PROVIDER`
- `CALLING_API_KEY`
- `CALLING_ACCOUNT_ID`
- `CALLING_WEBHOOK_SECRET`

Rules:

- Only `VITE_*` variables belong in client code.
- Server-side secrets must live in Netlify environment settings.
- Never commit real `.env` files.
- Use `.env.example` as the local template.
- Rotate any key accidentally copied into commits, logs, tickets, screenshots, or shared docs.

## 7. Third-Party Integrations

Supabase:

- Client auth/session and data access.
- Repository pattern for CRUD boundaries.
- Server-side functions use service-role configuration where needed.
- RLS and tenant isolation need deeper automated validation.

Twilio:

- Outbound SMS through `send-sms.cjs`.
- Inbound SMS through `inbound-v2.cjs`.
- SMS test mode is important for staging and safe validation.

OpenAI:

- Server-side only through Netlify Functions.
- Rule-based fallback remains required.
- No OpenAI key should be present in client code.

Stripe:

- Checkout, billing portal, and webhook foundations exist.
- Production launch should verify test versus live mode before any billing validation.

Email, calling, and property data:

- Provider-shaped foundations exist.
- Some providers remain manual, mock, or future-ready rather than fully live.

Netlify:

- Deployment target and function runtime.
- Health endpoint validates server-side environment presence without exposing values.

## 8. Repository Structure

High-level structure:

```text
.
├── .github/workflows
├── docs
├── e2e
├── netlify/functions
├── public
├── src
│   ├── components
│   ├── features
│   ├── hooks
│   ├── providers
│   ├── services
│   ├── test
│   ├── types
│   └── utils
└── supabase
```

Service structure highlights:

- `src/services/repositories`: Supabase repository boundaries.
- `src/services/api`: Netlify Function client and service result contracts.
- `src/services/ai`: shared AI gateway/provider/prompt/parser code.
- `src/services/auth`: auth and authorization helpers.
- `src/services/notifications`: notification rules and state helpers.
- `src/services/observability`: internal health/readiness services.
- `src/services/logging`: sanitized client logger.
- `src/services/monitoring`: in-memory runtime monitoring events.
- `src/services/config`: client environment config and validation.

Feature structure highlights:

- `src/features/copilot`
- `src/features/workflows`
- `src/features/communications`
- `src/features/dashboard`

## 9. Production Readiness Summary

Version 1.0 RC audit result:

- Recommendation: `READY WITH MINOR FIXES`
- Overall production readiness: `85 / 100`
- Critical blockers: none
- High risks: browser E2E gap and Supabase RLS/tenant isolation validation gap

Scorecard:

| Area | Score |
| --- | ---: |
| Architecture | 88 |
| Security | 84 |
| Performance | 86 |
| Testing | 80 |
| Developer Experience | 84 |
| Maintainability | 83 |
| Scalability | 78 |
| Operations | 85 |
| Documentation | 90 |
| Overall Production Readiness | 85 |

Verified release gates:

- `npm run build`
- `npm run test`
- `npm run test:run`
- `npm run lint`

Note: `npm run test` starts Vitest in watch mode after passing. Use `npm run test:run` for CI and release automation.

## 10. Known Technical Debt

Highest-priority debt:

- No browser E2E suite for launch-critical workflows.
- Supabase RLS and tenant isolation lack automated integration harness coverage.
- React hook lint warnings remain across some legacy components and hooks.
- Monitoring is not persistent and has no external alerting provider.
- No automated performance or bundle budget gate.
- Conversation persistence includes compatibility repository exports.
- Root README is still less useful than the docs folder for onboarding.
- Health endpoint validates environment presence, not provider connectivity.
- No high-volume data benchmark suite.

Launch mitigation:

- Require manual staging smoke validation.
- Require environment review before production promotion.
- Track post-launch hardening work explicitly.

## 11. Future Roadmap

Recommended post-launch roadmap:

1. Add browser E2E tests for critical workflows.
2. Add Supabase local/RLS integration tests.
3. Retire React hook lint warnings with focused workflow tests.
4. Add persistent monitoring and alerting after operational requirements are approved.
5. Add bundle and performance budgets.
6. Add deployment metadata such as commit SHA, release version, and build timestamp.
7. Consolidate docs into a clearer onboarding index.
8. Expand endpoint tests for negative-path provider behavior.
9. Add high-volume data fixtures and rendering benchmarks.
10. Continue repository-pattern migration and tenant-readiness hardening.

## 12. Operational Runbooks

Primary runbooks and operational docs:

- `docs/PRODUCTION_RUNBOOK.md`
- `docs/OPERATIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/HEALTH_ENDPOINT.md`
- `docs/VERSION_1_0_RELEASE_CHECKLIST.md`

Core production operating flow:

1. Confirm release commit or tag.
2. Confirm CI passed.
3. Run `npm run lint`, `npm run test:run`, and `npm run build`.
4. Confirm Netlify environment variables.
5. Deploy through Netlify.
6. Check `/.netlify/functions/health-check`.
7. Run manual smoke tests.
8. Monitor Netlify Function logs, browser console, Supabase status, Twilio logs, OpenAI fallback behavior, and Stripe test/live mode.

Incident severity:

- Sev 1: App unavailable, auth broken, data exposure, unsafe payment/SMS behavior.
- Sev 2: Critical workflow broken for many users.
- Sev 3: Non-critical workflow degraded with workaround.
- Sev 4: Cosmetic, documentation, or low-risk operational issue.

## 13. Disaster Recovery Notes

Primary rollback:

- Use Netlify deploy rollback to restore the last known-good deploy.

Rollback does not revert:

- Supabase data changes.
- Twilio message state.
- Stripe payment/customer/webhook state.
- OpenAI request history.
- Netlify environment variable edits.

Recovery guidance:

- Identify the last known-good Netlify deploy before launch.
- Confirm rollback owner before production promotion.
- Preserve environment snapshots or documented values.
- Treat database/provider recovery separately from app deploy rollback.
- After rollback, validate app shell, auth, dashboard, pipeline, deal modal, conversations, AI fallback, SMS mode, and Stripe mode.

## 14. Release Process

Recommended release flow:

1. Complete release work on a focused branch.
2. Open a pull request into `main`.
3. Require CI to pass.
4. Tag Release Candidate as `v1.0.0-rc.1`.
5. Deploy RC to staging.
6. Complete smoke validation and environment review.
7. Fix only release blockers.
8. Tag final production release as `v1.0.0`.
9. Deploy the approved commit or tag.
10. Monitor post-launch signals.

Hotfix flow:

1. Branch from production tag or production commit.
2. Apply the smallest safe fix.
3. Run lint, tests, and build.
4. Deploy and verify.
5. Tag as patch release, for example `v1.0.1`.
6. Merge the fix back into active development.

Versioning:

- Use semantic versioning.
- `1.0.0` is the first production release.
- Patch releases should be backwards-compatible fixes.
- Minor releases should be backwards-compatible enhancements.
- Major releases should be reserved for breaking product, data, auth, billing, or API changes.

## 15. Recommended Development Standards

Engineering standards:

- Preserve existing functionality.
- Avoid redesigns during production-readiness work.
- Prefer small, reviewable changes.
- Keep business logic in services, not UI components.
- Use repository boundaries for Supabase CRUD.
- Keep provider calls server-side or behind approved service abstractions.
- Preserve rule-based AI fallback behavior.
- Add tests for new service logic, repository behavior, critical UI behavior, and Netlify Function safety.
- Keep environment variables documented.
- Never expose server-only secrets.
- Use `npm run test:run` for release verification.
- Run `npm run lint` and address errors before merging.
- Treat remaining lint warnings as debt to retire incrementally.

Code review standards:

- Lead with correctness, security, data integrity, and regression risk.
- Check auth, permissions, and tenant implications for persistence changes.
- Check provider test/live mode behavior for SMS, AI, Stripe, email, and calling changes.
- Confirm safe error handling and secret redaction.
- Confirm docs and environment references stay current.

## 16. Recommendations for Future Contributors

Start here:

1. Read `docs/VERSION_1_0_LAUNCH_REPORT.md`.
2. Read `docs/PRODUCTION_READINESS_REPORT.md`.
3. Read `docs/TECHNICAL_DEBT_REGISTER.md`.
4. Read `docs/ARCHITECTURE_OVERVIEW.md`.
5. Read `docs/REPOSITORY_PATTERN.md`.
6. Read `docs/DEPLOYMENT.md` and `docs/PRODUCTION_RUNBOOK.md`.

Before contributing:

- Run `npm ci`.
- Run `npm run test:run`.
- Run `npm run build`.
- Run `npm run lint`.
- Review open technical debt before making broad changes.

Contribution guidance:

- Do not add new persistence patterns casually.
- Do not call external providers directly from client UI.
- Do not make AI, SMS, Stripe, email, or calling actions irreversible without explicit review.
- Avoid broad UI rewrites unless they are tied to a launch-approved objective.
- Prefer feature-local services/hooks for feature-specific logic.
- Prefer shared services/utilities only when behavior is genuinely reusable.
- Update relevant docs when changing deployment, environment variables, integrations, release flow, or operational behavior.

Most important inherited context:

- The project is Release Candidate ready, not operationally complete.
- The largest remaining risks are test automation depth, backend/RLS validation, and production observability.
- The app should launch only after staging smoke validation and environment review are complete.

