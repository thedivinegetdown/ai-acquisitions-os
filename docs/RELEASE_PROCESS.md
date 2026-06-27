# Release Process

This document defines the repeatable release process for AI Acquisitions OS.

## Release Principles

- Preserve existing functionality.
- Keep production changes small and reviewable.
- Use the repository lockfile for reproducible installs.
- Do not depend on real external secrets for CI.
- Validate build and test health before deployment.
- Document rollback before launch.

## Versioning

The current package version remains `0.0.0`.

Before Version 1.0 release, choose one of the following:

- Set `package.json` to `1.0.0` for the first production release.
- Keep application versioning in release notes and Git tags until package versioning is approved.

Recommended Version 1.0 release tag format:

```text
v1.0.0
```

Recommended release candidate tag format:

```text
v1.0.0-rc.1
```

## Branch And Git Strategy

Recommended release flow:

1. Use feature branches for readiness sprint work.
2. Open pull requests into `main`.
3. Require CI to pass before merge.
4. Keep release changes focused and avoid unrelated refactors.
5. Tag the release commit after approval.
6. Deploy from the approved branch or tag.

For urgent production fixes:

1. Branch from the production commit.
2. Apply the smallest safe fix.
3. Run `npm run test:run` and `npm run build`.
4. Deploy and verify.
5. Merge the fix back into the active development branch.

## Release Candidate Checklist

Before a release candidate:

- `npm ci` succeeds from a clean checkout.
- `npm run test:run` passes.
- `npm run build` passes.
- Netlify configuration matches `netlify.toml`.
- Required Netlify environment variables are present.
- Server-only secrets are not committed or exposed in client code.
- Manual smoke tests are completed.
- Rollback plan is reviewed.

## Deployment Repeatability

A release is repeatable when:

- The same commit can be rebuilt with `npm ci` and `npm run build`.
- Environment variables are documented and scoped by environment.
- Netlify deployment settings are stored in `netlify.toml`.
- Build output is generated, not manually edited.
- The release process does not rely on untracked local files.

## Approval Gates

Required gates before production:

- Engineering approval.
- QA or release owner approval.
- Environment variable review.
- Rollback readiness confirmation.
- Known blocker review.

Do not begin the next production readiness sprint until the current sprint report has been reviewed and approved.

