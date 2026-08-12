# Browser E2E validation

EO-E2E-01 uses Playwright Chromium against the real built Vite application. The
browser exercises real routes, lazy bundles, the Supabase client, authenticated
function client, and Inbox composer.

## Controlled boundary

Tests never connect to production. `e2e/fixtures.js` intercepts only the
synthetic local Supabase and Netlify URLs baked into the E2E bundle. It provides:

- password-based synthetic sessions for owner, analyst, viewer, and a second organization
- membership-scoped PostgREST fixtures
- deterministic deals and conversations
- a role- and organization-enforcing function boundary
- test-only SMS persistence with a provider-call counter that must remain zero
- safe 401, 403, 404, 500, network, malformed-response, and webhook failures

This is not a frontend auth bypass: the normal sign-in screen, Supabase auth
client, session guard, organization lookup, authorization headers, and
`X-Organization-Id` flow all execute in Chromium.

## Commands

- `npm run test:e2e` — build and run all browser gates
- `npm run test:e2e:security` — authorization and tenant gates
- `npm run test:e2e:smoke` — route and safe endpoint smoke gates
- `npm run test:e2e:a11y` — accessibility smoke
- `npm run test:smoke:preview -- https://deploy-preview-N--site.netlify.app` — safe, unauthenticated deploy-preview smoke

The deploy-preview command refuses non-preview targets and only performs GETs
plus deliberately invalid, unauthenticated webhook/function requests that fail
before any data or provider action.

Failure traces, screenshots, and video are retained locally under
`test-results/e2e`; CI uploads them for seven days only when a browser job fails.
