# Versioning

AI Acquisitions OS uses semantic versioning for production releases.

## Recommended Version

The recommended first production release version is:

```text
1.0.0
```

PR-7A updates package metadata to `1.0.0` so release artifacts, lockfile metadata, and Git tags can align for the Release Candidate.

## Semantic Versioning

Use:

- `MAJOR` for incompatible product, data, API, or operational contract changes.
- `MINOR` for backwards-compatible product capabilities or operational improvements.
- `PATCH` for backwards-compatible fixes, documentation corrections, and release hardening.

Examples:

- `1.0.0`: first production release.
- `1.0.1`: production hotfix.
- `1.1.0`: backwards-compatible production enhancement.
- `2.0.0`: breaking architecture, data, auth, billing, or API contract change.

## Release Candidate Tags

Recommended release candidate tag format:

```text
v1.0.0-rc.1
v1.0.0-rc.2
```

Recommended final production tag:

```text
v1.0.0
```

## Git Strategy

Recommended release flow:

1. Complete readiness work on a focused branch.
2. Open a pull request into `main`.
3. Require CI to pass.
4. Tag the approved release commit.
5. Deploy the tagged commit or approved branch.
6. Preserve rollback target in Netlify deploy history.

Hotfix flow:

1. Branch from the production tag or production commit.
2. Apply the smallest safe fix.
3. Run lint, tests, and build.
4. Deploy and verify.
5. Tag as a patch release, for example `v1.0.1`.
6. Merge the fix back into active development.

## Package Metadata

`package.json` and `package-lock.json` should always carry the same package version.

Before final release:

- Confirm package metadata is `1.0.0`.
- Confirm the Git tag is `v1.0.0`.
- Confirm release notes reference the same version.
- Confirm Netlify deployment metadata records the release commit.

