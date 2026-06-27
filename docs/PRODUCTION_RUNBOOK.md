# Production Runbook

This runbook is for operating AI Acquisitions OS during production deployment, validation, incidents, and rollback.

## Pre-Deploy

1. Confirm the release commit or tag.
2. Confirm CI passed on the release commit.
3. Run local verification:

```bash
npm run test:run
npm run build
```

4. Confirm required Netlify environment variables are configured.
5. Confirm `SMS_TEST_MODE`, Stripe keys, and OpenAI keys match the intended release stage.
6. Review the rollback target in Netlify deploy history.
7. Assign release owner and rollback owner.

## Deploy

1. Trigger the Netlify deployment from the approved branch or tag.
2. Watch Netlify build logs for dependency, build, or function bundling errors.
3. Confirm the deploy is published.
4. Confirm Netlify Functions are available under `/.netlify/functions`.

## Post-Deploy Smoke Test

Validate:

- App shell loads.
- Authentication flow works for signed-out and signed-in states.
- Executive dashboard renders.
- Pipeline board renders deal cards.
- Deal modal opens.
- Conversation inbox and thread load.
- AI Copilot returns fallback-safe output if OpenAI is unavailable.
- Notification center renders and can open related deal context.
- Command palette/search can find records.
- SMS function returns success or safe test-mode response.
- Stripe actions use the intended test or production credentials.

## Health Review

Check:

- Browser console for new errors.
- Netlify deploy logs.
- Netlify Function invocation logs.
- Supabase service status and query errors.
- Twilio message logs if SMS is enabled.
- OpenAI fallback behavior.
- Stripe webhook and checkout logs if billing is enabled.

## Incident Triage

Classify incidents:

- Sev 1: App unavailable, authentication broken, data exposure, payment/SMS provider unsafe behavior.
- Sev 2: Critical workflow broken for many users.
- Sev 3: Non-critical workflow degraded with available workaround.
- Sev 4: Cosmetic, documentation, or low-risk operational issue.

Capture:

- Incident severity.
- Start time and timezone.
- Affected workflows.
- Deploy ID and commit SHA.
- Logs and screenshots with secrets redacted.
- Immediate mitigation.
- Owner and next update time.

## Rollback

Use rollback when a release causes Sev 1 or high-impact Sev 2 behavior and a forward fix is not immediately safer.

Rollback steps:

1. Select the last known-good Netlify deploy.
2. Restore that deploy.
3. Confirm the app loads.
4. Re-run critical smoke checks.
5. Check function logs for recurring errors.
6. Notify stakeholders that rollback is complete.
7. Open a follow-up issue with root cause and corrective action.

Rollback does not revert:

- Supabase data changes.
- Provider-side SMS, Stripe, or OpenAI state.
- Netlify environment variable edits.

Review those separately during recovery.

## Common Failure Modes

Build failure:

- Run `npm ci`.
- Confirm `package.json` and `package-lock.json` are in sync.
- Run `npm run build` locally.

Test failure:

- Run `npm run test:run`.
- Identify whether the failure is source, test setup, or environment related.

Missing environment variable:

- Compare Netlify settings with `docs/ENVIRONMENT_VARIABLES.md`.
- Confirm server-only values are not expected in browser code.

Netlify Function failure:

- Review function logs.
- Confirm required server-only variables are configured.
- Confirm request shape and method are valid.

Provider outage:

- Keep AI fallback available.
- Keep SMS in test mode or disable outbound behavior if safety is uncertain.
- Confirm Stripe mode before allowing billing validation.

## Post-Incident Review

After recovery:

- Document root cause.
- Record customer or workflow impact.
- Identify missing tests or health checks.
- Update docs if the runbook was incomplete.
- Add a follow-up item to the next production readiness sprint.

