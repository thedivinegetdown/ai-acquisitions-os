# ADR-026: Free-First and Vendor-Neutral Architecture

## Status

Accepted.

## Context

AI Acquisitions OS must remain affordable for its owner and usable for local development and basic single-user deployment without assembling multiple paid SaaS subscriptions. Existing architecture already requires replaceable provider adapters, server-side provider secrets, and deterministic AI fallback. It does not yet establish a zero-cost core baseline, provider tiers, spending approval, or a uniform cost-governance review.

Provider pricing, quotas, availability, and terms can change. The architecture cannot assume that any provider will remain free forever, and domain or UI code must not become coupled to provider-specific contracts.

## Decision

AI Acquisitions OS uses a Free-First architecture. Core functionality must operate without required paid third-party services during development and basic single-user use. External paid services must remain optional, replaceable, and isolated behind provider adapters.

Core workflows use internal, open-source, standards-based, or existing-platform capabilities first. A paid or usage-based provider is introduced only when business value justifies it and the integration satisfies the governance in this ADR.

This decision extends and does not supersede ADR-010, Replaceable External Provider Adapters. ADR-010 owns the common adapter mechanics; ADR-026 owns the zero-cost baseline, provider tiers, fallback obligations, dependency review, and cost governance.

Free-first does not mean ignoring legitimate unavoidable costs. Real SMS, external AI inference, paid property records, payment processing, premium email delivery, or similar provider activity may incur usage costs when enabled. The platform must expose those costs clearly and remain usable when those integrations are disabled wherever technically practical.

### Zero-Cost Baseline

The no-paid-service baseline includes:

- CRM records and workflows for sellers, leads, properties, deals, stages, tasks, notes, activities, and assignments;
- the Today Workspace, deterministic prioritization, Deal Decision Room, missing-information checks, deterministic recommendations, readiness rules, and decision memory;
- message drafts, communication history, templates, test mode, and manual communication logging;
- deterministic AI fallback, rule-based analysis, and manually entered insights;
- internal workflow definitions, tasks, supported schedules, approval state, and execution history;
- PostgreSQL search, internal read models and reports, internal notifications, document metadata and approved storage abstraction, structured logs, and health status;
- manual property facts, CSV import, public-record research workflows, and address or parcel use without a mandatory map.

Real delivery, external inference, enrichment, mapping, billing, and similar side effects may be unavailable until an optional provider is configured. Their absence must not make core CRM and decision workflows fail.

### Provider Tiers

Tier 1 - Core and Free-First:

- PostgreSQL, existing Supabase and Netlify capabilities, browser APIs, appropriate local storage, open-source libraries, internal deterministic engines, manual data entry, and CSV import.

Tier 2 - Optional usage-based integrations:

- Twilio, OpenAI, email delivery, Stripe, property-data, geocoding or mapping, and electronic-signature providers.
- Tier 2 providers require explicit configuration, visible usage or cost implications, server-side secrets, adapters, and practical deterministic or manual fallbacks.

Tier 3 - Optional enterprise integrations:

- premium monitoring, data warehouses, enterprise identity providers, commercial GIS, external CRMs, and advanced compliance services.
- Tier 3 integrations never become prerequisites for the core single-user product.

### Adapter Boundaries

Every external provider is accessed through a documented interface or adapter. Required boundaries include `AIProvider`, `MessagingProvider`, `EmailProvider`, `PropertyDataProvider`, `MapProvider`, `StorageProvider`, `BillingProvider`, `MonitoringProvider`, and `ElectronicSignatureProvider`.

Adapters normalize requests, responses, errors, health status, usage metadata, and provider identifiers. Application and domain code do not depend directly on provider-specific response formats. UI components do not import external provider SDKs or provider secrets.

### Fallback Requirements

- AI unavailable: use deterministic rules or clearly identify that AI assistance is unavailable while preserving CRM and decision workflows.
- SMS unavailable: retain drafts, permit manual communication logging, display a delivery-unavailable state, and never report an unsent message as sent.
- Email unavailable: retain drafts and templates and display a safe unavailable state.
- Property data unavailable: support manual facts, CSV imports, research tasks, and unverified-data labeling.
- Maps unavailable: preserve address and parcel information without a map.
- Monitoring unavailable: preserve structured logs and internal health status.
- Payment unavailable: preserve development and basic single-user use; subscription enforcement may be disabled in development and test modes.

Disconnected optional integrations must be presented as optional or unavailable integrations, not as broken core functionality. Test mode, live mode, and actions that may incur usage costs must be clear and must not use manipulative upgrade prompts.

### Dependency Governance

- Prefer existing dependencies before adding packages.
- Prefer small, maintained, permissively licensed packages.
- Avoid packages that require paid hosted services or duplicate platform and project capabilities.
- Record the purpose of each new production dependency.
- Evaluate maintenance health, bundle impact, security history, and license.
- Do not add a dependency for minor visual convenience when the design system already provides the capability.

### Cost-Governance Review

Every roadmap phase and Execution Order identifies new third-party services and dependencies, provider tier, license, expected data transfer, operational cost exposure, fallback, lock-in risk, internal or self-hosted alternative, and why the integration is necessary.

A new paid or usage-based dependency requires explicit architecture review, documented justification, adapter design, fallback behavior, user approval before configuration or spending, and an ADR when it materially changes the architecture. No paid service may be added silently.

### No-Vendor-Lock-In Rule

Provider-specific code stays inside adapters, canonical records do not require provider response formats, exports remain available through standards-based or documented formats, and provider replacement must not require redesigning domain workflows. Provider health and usage metadata may be retained without making provider identifiers canonical business keys.

### Security and Compliance Exception

Free-First does not justify weakening security, legal compliance, correctness, reliability, consent controls, auditability, or data protection. When a compliant or reliable capability has an unavoidable cost, Architecture Review may approve it with documented justification, explicit user approval, bounded cost exposure, adapter isolation, and the safest technically practical fallback.

## Consequences

Positive:

- Local development and basic single-user use remain viable without a collection of paid subscriptions.
- Provider outages, missing configuration, and pricing changes have bounded product impact.
- Provider replacement and test doubles are easier because domain contracts remain neutral.
- Users can distinguish core capability from optional, disconnected, test, live, and usage-based features.

Negative:

- Adapter and fallback contracts add design and test work to integrations.
- Some provider-only conveniences may be deferred until actual usage justifies their cost.
- Manual and deterministic fallbacks may provide less automation than configured providers.
- Cost and license review adds a required governance step.

## Alternatives Considered

Require a preferred SaaS stack for all environments:

- Rejected because it creates recurring cost, configuration burden, outage coupling, and avoidable vendor lock-in for core workflows.

Prohibit paid providers entirely:

- Rejected because real SMS, external AI inference, payment processing, premium email delivery, and paid data can provide legitimate business value and may have unavoidable usage costs.

Select providers case by case without shared adapters or governance:

- Rejected because provider contracts would leak into domain and UI code, fallbacks would become inconsistent, and spending could be introduced without review.

## Future Review Triggers

Review this decision when:

- an optional provider becomes operationally necessary for a core workflow;
- a provider pricing, quota, licensing, availability, or compliance change threatens the zero-cost baseline;
- self-hosting materially changes security, reliability, or operating cost;
- local-model support or a new provider category is proposed;
- tenant scale requires enterprise services that affect canonical contracts;
- a fallback can no longer preserve correctness, compliance, or user trust.

Any material change requires Architecture Review and a new or superseding ADR; implementation must not silently weaken this policy.
