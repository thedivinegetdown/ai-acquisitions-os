# Roadmap

## Enterprise Roadmap Governance

Future implementation sequencing is governed by `docs/enterprise/AI_ACQUISITIONS_OS_ENTERPRISE_ENGINEERING_V1.md`.

This legacy roadmap remains useful as an inventory of product areas, but it is superseded for prioritization by the enterprise Decision-First Product Model, Today Workspace, Universal Approval Inbox, Deal Decision Room, Asset Strategy Layer, Product Experience and Design System, and Simplicity Guardrail.

### Free-First Architecture Governance

All current and future programs follow the Free-First and Vendor-Neutral Architecture defined by the [enterprise baseline](enterprise/AI_ACQUISITIONS_OS_ENTERPRISE_ENGINEERING_V1.md) and [ADR-026](enterprise/adrs/ADR-026-FREE-FIRST-AND-VENDOR-NEUTRAL-ARCHITECTURE.md).

- Core development and basic single-user workflows must retain a no-paid-service baseline.
- External providers must be optional, explicitly configured, replaceable, and isolated behind provider adapters.
- Every relevant phase and Execution Order must identify new services and dependencies, licensing, provider tier, data transfer, operational cost exposure, fallback behavior, lock-in risk, internal or self-hosted alternatives, and the reason the integration is necessary.
- Existing infrastructure, internal implementation, and appropriate open-source alternatives must be evaluated before adding a service or package.
- No paid or usage-based service may be added silently, and user approval is required before configuration or spending.
- Architecture Review must validate fallback behavior, dependency health and licensing, cost exposure, and freedom from required vendor lock-in.

Relevant future phases must include acceptance criteria confirming that:

- the core workflow functions with the optional provider disabled;
- integration absence does not crash the workspace;
- test mode and live mode are clearly distinguished;
- provider-specific code remains behind an adapter;
- the product does not fabricate success when an external side effect was not performed;
- usage-based actions require explicit configuration and visible cost implications.

## SaaS Platform

- Multi-tenancy and organization switching.
- Tenant-scoped data access policies.
- User invitations and account lifecycle.
- Billing and subscription management when commercial plans are activated.
- Optional Stripe integration through the `BillingProvider` boundary.

## Contracts And Closing

- Legal document generation with attorney-reviewed templates.
- Optional e-sign integration through the `ElectronicSignatureProvider` boundary.
- Document persistence and audit trail.
- Title company and closing partner workflows.

## Optional Data Integrations

- Property data APIs.
- MLS integrations.
- Mapping and geospatial intelligence.
- Email provider integration.
- Calling and voicemail integrations.
- WhatsApp, Messenger, and web chat providers.

## AI

- Advanced AI automation with approval queues.
- AI-generated seller summaries, deal briefings, and executive insights at scale.
- Multi-agent workflow orchestration.
- Optional provider selection by tenant through `AIProvider`, with deterministic fallback.
- Evaluation and prompt versioning.

## Reliability

- Testing and CI hardening.
- End-to-end tests for SMS, Copilot fallback, and Deal Modal workflows.
- Optional external monitoring through `MonitoringProvider`.
- Error reporting.
- Audit logs.

## Performance

- Continue code splitting where useful.
- Data query consolidation.
- Virtualization for large lists.
- Supabase query tuning and indexes where needed.
