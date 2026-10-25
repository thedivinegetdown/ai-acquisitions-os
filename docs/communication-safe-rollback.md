# Communication safety rollback contract

The original complete Netlify deployment at
`aa9726488a312db18a84d63ce3cfe82ab63499cf` is not a safe restore target:
its SMS function does not enforce research-only scope.

## Qualified fallback source

Run `node scripts/prepare-communication-safe-rollback.cjs` locally for the
candidate HEAD. It creates a new, ignored `.netlify/communication-safe-rollback-<HEAD>-<suffix>`
directory without overwriting an earlier artifact. It packages the exact
prior application, retaining only these five accepted safety files from
`9b20cd60971a3e9668d7680181bef1a31af8562d`:

- `netlify/functions/_shared/auth.cjs`
- `netlify/functions/send-sms.cjs`
- `netlify/functions/send-email.js`
- `src/components/MessageCenter.jsx`
- `src/components/SequenceEngine.jsx`

Every file has an exact Git-source hash in `manifest.json`. All application and
function files, dependency manifests, and build configuration must equal the
qualified candidate; packaging fails on runtime drift. No local environment or
credential files are copied. `communication-safe-rollback.tar` contains the
verified safe source, with its SHA256 in the manifest. The intermediate archive
of the unsafe base is removed before the safe artifact is created. This is
source, not a published Netlify deployment. Its migrations are inert reference
files and must never be replayed.

`netlify.toml` builds `dist` and bundles the entire `netlify/functions` directory.
This fallback uses that complete deployment model. It does not assume Netlify
can restore UI assets independently of functions. Rebuilding/publishing this
artifact requires separate authorization and the normal CI and release gates.

## Retained safeguards and limits

Retain both communication database guards and the canonical identity foundation.
The protected functions reload a tenant-authorized deal and enforce its stored
scope before any provider send. Database sequence guards do not protect an SMS
that has already been sent. Restricted requests and unlinked outbound requests
fail explicitly; active-acquisition requests retain existing consent and provider
safety checks. History and research evidence are not edited by this procedure.

Old browser assets or previously opened clients may display enabled controls;
the protected functions reject restricted requests and PostgreSQL rejects unsafe
sequence writes. Only completed sequence history can accompany a transition into
research-only scope; existing actionable sequences cause an explicit failure.

This repair changes only safety runtime files, so the fallback deliberately has
the same runtime as the qualified candidate. It cannot fix a fault in those
retained files. If those files cause a release failure, stop for a separately
qualified correction; do not restore the scope-unaware functions. No claim is
made that this source package is already built, deployed, or restorable from
Netlify deployment history.

## Execution order, deferred

1. Complete the authorized production-wide read-only audit, including object-name
   collisions and actionable research-only sequences.
2. Obtain separate migration authorization. Apply only the checksum-confirmed
   migration using its own transaction. It takes write-excluding locks on
   sequences and deals before the conflict audit and retains them through COMMIT.
   Lock contention or deadlock is a failed attempt; never bypass locking.
3. Verify committed guard definitions/enabled state, historical fingerprints,
   canonical identity preservation, and absence of restricted actionable sequences.
4. Obtain application publication authorization, pass normal CI, and publish the
   qualified complete application through the established GitHub/Netlify flow.
   Main updates automatically publish; do not update main before schema acceptance.
5. If a safe fallback is needed, use this separately reviewed complete artifact
   through the same authorized publication process. Never drop the guards or
   canonical schema. After an uncertain migration COMMIT, inspect catalogs and
   invariants before deciding whether any retry is safe.

The migration alone does not retrofit SMS scope enforcement into the old serving
functions during the schema-to-application window. Full communication safety is
accepted only once the protected functions are serving. No seamless safe restore
of the original deploy is claimed.
