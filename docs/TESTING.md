# Testing

Production Readiness Sprint PR-5 establishes automated regression coverage for critical services, selected UI workflows, and shared Netlify Function security helpers.

## Commands

Run the full non-watch test suite:

```bash
npm run test:run
```

Run Vitest in interactive watch mode during development:

```bash
npm run test
```

Run the production build:

```bash
npm run build
```

Run the current local release check:

```bash
npm run check
```

## Test Stack

- Vitest for unit and component tests.
- jsdom for browser-like component rendering.
- Testing Library for React component assertions.
- `src/test/setup.js` for shared DOM test setup.
- Explicit mocks for external providers and infrastructure seams.

## Current Coverage Areas

- Utility helpers.
- AI gateway and OpenAI provider routing.
- Offer services.
- Authentication and authorization helpers.
- Deal repository access.
- Conversation service composition.
- Notification service state transitions.
- Workflow engine guard behavior.
- Netlify Function security helpers.
- Pipeline board rendering and deal selection.
- Protected route behavior.
- Search command center record opening.
- Notification center actions.
- Offer builder draft behavior.
- Executive dashboard rendering.

## Mocking Rules

Tests must not call real external systems.

- Mock OpenAI through provider/API boundaries.
- Mock Twilio and SMS services.
- Mock Stripe and billing functions.
- Mock property, email, and calling providers.
- Mock Supabase repository/client boundaries unless an explicit local integration test harness is introduced.
- Never require production environment variables for routine test execution.

## Release Expectations

Before a production release candidate:

- `npm run test:run` must pass.
- `npm run build` must pass.
- New service logic must include focused service tests.
- New repository behavior must include repository boundary tests.
- New component behavior in critical workflows must include practical component tests.
- Netlify Function changes must validate request shape and safe error behavior.

## Known Gaps

- No browser end-to-end suite yet.
- No Supabase local integration test harness yet.
- No coverage threshold enforcement yet.
- Netlify Function tests currently cover shared security helpers more than each endpoint.
- Seller Workspace needs deeper workflow tests.
- Property Intelligence needs deeper workflow tests.
- Transaction Management needs deeper workflow tests.
- Conversation Hub needs deeper workflow tests.
- High-volume UI behavior is not covered with performance regression tests.
