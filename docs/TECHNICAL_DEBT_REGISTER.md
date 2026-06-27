# Technical Debt Register

This register tracks known debt after the Version 1.0 launch audit.

| ID | Category | Severity | Debt | Launch Impact | Recommended Timing |
| --- | --- | --- | --- | --- | --- |
| TD-001 | Testing | High | No browser E2E suite for launch-critical workflows. | Requires manual smoke validation. | First post-RC sprint |
| TD-002 | Security | High | Supabase RLS and tenant isolation lack automated integration harness coverage. | Production approval must include manual backend validation. | Before broad SaaS rollout |
| TD-003 | Lint | Medium | React hook warnings remain across legacy components and hooks. | Lint passes, but warnings obscure future regressions. | PR-7B or first post-launch hardening sprint |
| TD-004 | Observability | Medium | Monitoring is in-memory/browser-local and Netlify-log based. | No persistent alerts or dashboards. | Post-launch operations sprint |
| TD-005 | Performance | Medium | No bundle budget or performance regression gate. | Performance drift could go unnoticed. | Post-launch hardening |
| TD-006 | Persistence | Medium | Conversation persistence uses compatibility repository exports. | Boundary is documented but can confuse contributors. | Repository cleanup sprint |
| TD-007 | Documentation | Low | Root README remains less useful than the docs folder. | Developer onboarding friction. | Before public handoff |
| TD-008 | Release Engineering | Low | `npm run test` is watch-mode; release automation should use `npm run test:run`. | Human confusion during audits. | Next release-process cleanup |
| TD-009 | Health Checks | Low | Health endpoint validates env presence only, not provider connectivity. | Cannot prove external providers are reachable. | Post-launch operations |
| TD-010 | Data Scale | Medium | No high-volume Supabase query or rendering benchmark suite. | Scaling risk as data volume grows. | Before larger customer rollout |

## Debt Policy

Debt should block launch only when it creates an unmitigated Critical or High production risk.

For Version 1.0:

- TD-001 and TD-002 require explicit release owner acknowledgement.
- TD-003 through TD-010 can proceed with documented mitigations.

