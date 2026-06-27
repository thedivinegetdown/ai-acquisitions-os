# CI/CD

## Current CI Checks

GitHub Actions runs `.github/workflows/ci.yml` on pull requests and pushes to `main` or `master`.

The workflow checks:

- Dependency installation with `npm ci`
- Unit and smoke tests with `npm run test:run`
- Production build with `npm run build`

CI fails if tests fail, dependencies cannot install from the lockfile, or the production build fails.

## Secrets And Environment Variables

The CI workflow does not require real Supabase, Twilio, or OpenAI secrets.

It uses safe placeholder client variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_NETLIFY_FUNCTIONS_BASE`
- `SMS_TEST_MODE=true`

Real deployment environments still need the variables documented in `docs/ENVIRONMENT_VARIABLES.md`.

## Netlify Deployment Notes

Netlify should continue to run:

```bash
npm run build
```

Publish directory:

```text
dist
```

Netlify Functions live in:

```text
netlify/functions
```

Deployment secrets such as `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, and `OPENAI_API_KEY` must be configured in Netlify and must not be committed to the repository.

## Running Checks Locally

Run all local checks:

```bash
npm run check
```

Run tests only:

```bash
npm run test:run
```

Run build only:

```bash
npm run build
```

## Debugging Failed CI

1. Check whether `npm ci` failed because `package.json` and `package-lock.json` are out of sync.
2. If tests fail, run `npm run test:run` locally and inspect the failing test file.
3. If build fails, run `npm run build` locally and check Vite output.
4. If a failure references missing environment variables, confirm the code path should not require real external provider secrets during CI.
5. If Netlify deployment fails but GitHub CI passes, compare Netlify environment variables with `docs/ENVIRONMENT_VARIABLES.md`.

## Current Scope

This workflow is build/test safety only. It does not deploy, run migrations, manage billing, or perform multi-tenant release automation.
