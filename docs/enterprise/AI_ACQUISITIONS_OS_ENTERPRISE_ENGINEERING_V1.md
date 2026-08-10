# AI Acquisitions OS Enterprise Engineering Baseline v1.0

**Status:** Approved architecture baseline  
**Document type:** Enterprise Architecture, Implementation Roadmap, ADR Index, and Engineering Operating Process  
**Scope:** AI Acquisitions OS repository  
**Architecture phase rule:** Documentation and governance only. No product functionality is implemented by this document.

---

# 0. Repository Architectural Assessment

## 0.1 Assessment purpose

This assessment establishes the verified current-state architecture and identifies the boundaries that future implementation must preserve. It is the controlling baseline for all future Execution Orders.

## 0.2 Current-state summary

AI Acquisitions OS is a modular React and Vite application backed by Supabase/PostgreSQL and Netlify Functions. The product has evolved from a single-screen deal tracker into a broad acquisition operating system containing CRM, seller workspace, deal analysis, communications, AI-assisted guidance, workflow concepts, buyers/dispositions, dashboards, billing foundations, organization settings, and production-readiness tooling.

The current codebase demonstrates a meaningful separation of concerns:

- `src/App.jsx` is an application composition root rather than a business-logic container.
- `src/AppSections.jsx` controls dashboard section composition through lazy-loaded configuration.
- `src/hooks/useDealData.js` isolates primary deal loading state.
- `src/services/repositories/*` provides a repository boundary over Supabase access.
- `src/features/*` contains larger product areas such as dashboard and Copilot.
- `src/services/api`, `src/services/ai`, logging, monitoring, cache, and configuration provide cross-cutting abstractions.
- `netlify/functions/*` is the server-side integration and privileged-operation boundary.
- Supabase is the system of record for operational CRM data.
- Netlify is the deployment and serverless runtime.

## 0.3 Verified strengths

1. **Modular UI composition**
   - Large feature panels are lazy-loaded.
   - The application shell delegates data loading and section rendering.
   - The current structure supports further extraction into domain-oriented feature modules.

2. **Repository abstraction**
   - Deal reads and writes are accessed through repository functions.
   - Repository result contracts provide a foundation for consistent error handling.

3. **Provider isolation**
   - OpenAI and Twilio integrations are intended to remain behind Netlify Functions.
   - Client-side code uses service and gateway abstractions rather than provider secrets.

4. **AI fallback architecture**
   - The AI system supports rule-based, OpenAI, and hybrid behavior.
   - Prompt construction, response parsing, token estimation, provider access, and conversation memory are separated.

5. **Release-readiness foundations**
   - Vitest, ESLint, Vite build scripts, CI, environment templates, operational documentation, and health/readiness components exist.
   - The repository has already completed release-candidate stabilization work.

6. **Incremental production hardening**
   - Shared function security helpers, bounded payload handling, safe response contracts, sanitized logging, lazy loading, and configuration validation are established patterns.

## 0.4 Principal architectural risks

1. **Dashboard aggregation risk**
   - `AppSections.jsx` composes many independent panels into one page. The product needs route-level workspaces and role-aware navigation so the dashboard does not remain the permanent integration point for every capability.

2. **Domain boundary inconsistency**
   - Newer feature modules coexist with legacy shared components. Business logic can still drift into UI components unless future work is constrained to domain services and repositories.

3. **Deal-table concentration**
   - The original product grew around a broad `deals` record. Enterprise maturity requires explicit aggregates for sellers, properties, opportunities/deals, contacts, tasks, conversations, workflows, transactions, buyers, documents, organizations, users, and audit records.

4. **Authentication and authorization gaps**
   - Browser authentication foundations exist, but server functions must consistently validate Supabase JWTs, organization membership, roles, and resource ownership.
   - Row Level Security must become a tested production control, not only a database configuration assumption.

5. **Communication compliance and reliability gaps**
   - Outbound SMS, inbound webhook verification, consent, opt-out, rate limits, provider retries, delivery status, idempotency, and message lifecycle state require a unified communication platform.

6. **Workflow persistence gap**
   - Existing automation and action panels contain valuable rules and UI, but enterprise automation requires persisted definitions, runs, steps, approvals, retries, schedules, and audit events.

7. **Observability gap**
   - Structured logging and monitoring hooks exist, but persistent centralized error reporting, traces, metrics, uptime checks, correlation IDs, and operational alerting remain incomplete.

8. **Testing gap**
   - Unit and component tests are established, but browser E2E, contract tests, webhook tests, RLS integration tests, migration tests, and production smoke automation must be formal release gates.

9. **Schema governance gap**
   - Schema changes need a single migration authority, repeatable staging validation, rollback policy, and explicit ownership by domain.

10. **Multi-tenant maturity gap**
    - Organization, roles, SaaS readiness, and billing foundations exist, but every table, API, event, cache key, AI context, file object, and report must enforce tenant isolation.

## 0.5 Architecture assessment conclusion

The repository is beyond prototype stage and has a viable modular foundation. The correct next step is not another broad feature wave. The correct next step is to formalize domain boundaries, tenant-safe contracts, workflow and communication runtimes, AI governance, operational controls, and release discipline through the architecture and roadmap below.

---

# 1. AI Acquisitions OS Enterprise Architecture v1.0

## 1.1 Product vision

AI Acquisitions OS is the enterprise operating system for residential real estate acquisition teams. It unifies lead intake, seller relationship management, underwriting, negotiations, communications, follow-up automation, transaction coordination, dispositions, analytics, and AI-assisted decision support in one tenant-safe platform.

The platform must help teams:

- respond to leads quickly;
- preserve complete seller and deal context;
- prioritize opportunities consistently;
- calculate offers with explainable assumptions;
- automate approved repetitive work;
- maintain compliant communication histories;
- coordinate acquisitions, dispositions, and transaction roles;
- measure source, team, pipeline, and revenue performance;
- use AI as a governed copilot rather than an uncontrolled autonomous actor.

## 1.2 Architectural principles

1. **Architecture before implementation.**
2. **Domain ownership over screen ownership.**
3. **Supabase/PostgreSQL is the operational source of truth.**
4. **Server boundaries protect secrets and privileged operations.**
5. **Tenant isolation is mandatory at every layer.**
6. **AI recommendations are explainable, reviewable, and reversible.**
7. **Automation is stateful, idempotent, observable, and approval-aware.**
8. **External providers are replaceable behind adapters.**
9. **Events describe completed facts, not commands disguised as events.**
10. **Every mutation has an actor, tenant, timestamp, and audit trail.**
11. **Read models may be optimized, but domain records remain canonical.**
12. **One validation cycle gates one commit and one push.**
13. **No implementation phase may redesign architecture.**
14. **Backward compatibility is preserved unless an ADR explicitly approves a break.**
15. **Security, accessibility, observability, and testability are product requirements.**
16. **Free-First and vendor-neutral architecture is mandatory.**

AI Acquisitions OS uses a Free-First architecture. Core functionality must operate without required paid third-party services during development and basic single-user use. External paid services must remain optional, replaceable, and isolated behind provider adapters.

Free-First means:

- build internally when practical;
- prefer existing platform capabilities;
- prefer open-source libraries with appropriate licenses;
- prefer standards-based integrations;
- do not introduce a paid dependency when the requirement can be met safely using PostgreSQL, Supabase, Netlify, browser capabilities, local processing, or existing project code;
- do not sacrifice security, legal compliance, correctness, or reliability merely to avoid costs;
- usage-based services that inherently cost money must be opt-in and disabled safely when unconfigured.

## 1.3 System context

### Users

- Organization Owner
- Administrator
- Acquisitions Manager
- Acquisitions Representative
- Dispositions Representative
- Transaction Coordinator
- Analyst
- Virtual Assistant
- Read-only Viewer

### External systems

- Supabase Auth and PostgreSQL
- Netlify Functions and deployment
- Twilio Messaging and webhooks
- OpenAI models
- Email provider such as Resend
- Property/comparable-data providers
- Stripe billing
- File/object storage
- Optional calendar, calling, e-signature, title, and accounting integrations

### Free-First provider tiers

Provider selection follows three tiers. The architecture must tolerate plan, pricing, quota, and availability changes; no vendor is assumed to remain free forever.

#### Tier 1 - Core and Free-First

Tier 1 capabilities are the default baseline for development and basic single-user use:

- PostgreSQL;
- Supabase capabilities already used by the project;
- Netlify capabilities already used by the project;
- browser APIs;
- local storage where appropriate;
- open-source libraries;
- internal deterministic engines;
- manual data entry and CSV import.

Tier 1 is preferred whenever it can satisfy the requirement without weakening security, legal compliance, correctness, or reliability.

#### Tier 2 - Optional usage-based integrations

Tier 2 providers may be supported when the business value justifies configuration and cost exposure:

- Twilio;
- OpenAI;
- email delivery providers;
- Stripe;
- property-data providers;
- geocoding or mapping providers;
- electronic signature providers.

Tier 2 integrations must:

- be disabled safely when unconfigured;
- keep provider secrets out of client code;
- use an adapter boundary;
- require explicit configuration;
- expose visible usage and cost implications;
- provide deterministic or manual fallback where practical.

#### Tier 3 - Optional enterprise integrations

Tier 3 providers are optional enterprise extensions and must never be required for the core single-user product:

- premium monitoring;
- data warehouses;
- enterprise identity providers;
- commercial GIS;
- external CRMs;
- advanced compliance services.

### Zero-cost core capability baseline

The following product capabilities must have a no-paid-service baseline:

| Capability | Required no-paid-service baseline |
| --- | --- |
| CRM | Sellers, leads, properties, deals, stages, tasks, notes, activities, and assignments operate through internal data models, PostgreSQL/Supabase, and existing project code. |
| Decision experience | Today Workspace, deterministic prioritization, Deal Decision Room, missing-information checks, deterministic recommendations, readiness rules, and decision memory operate without AI or paid providers. |
| Communication foundation | Message drafts, communication history, templates, test mode, and manual logging operate without real SMS delivery. Real SMS may use an optional paid provider, but CRM workflows must not require it. |
| AI foundation | Deterministic and rule-based fallback, manually entered insights, optional external AI provider support, and future local-model adapter support. The application must not fail because an AI provider is absent. |
| Workflow foundation | Internally implemented workflow definitions, tasks, schedules where supported by the existing platform, approval state, and execution history. Zapier, Make, or a paid workflow platform must not be required. |
| Search | PostgreSQL search and browser/client filtering where appropriate. No required paid hosted-search provider. |
| Analytics | PostgreSQL queries, internal read models, and internal reports. No required paid product-analytics platform. |
| Notifications | Internal notification records and UI, with optional external delivery channels. |
| Documents | Database metadata, approved storage abstraction, local/test compatibility, and no required document-management SaaS. |
| Maps | Maps remain optional. Initial geographic functionality may use open standards or open-source components. No mandatory commercial map provider. |
| Monitoring | Structured logs, health endpoints, and internal operational records, with optional monitoring adapter. |
| Property data | Manual entry, CSV import, public-record research workflow, and provider-neutral adapters for optional paid enrichment. |

### Vendor-neutral adapter rule

Every external provider must be accessed through a documented interface or adapter. Application and domain code must not depend directly on provider-specific response formats, and UI components must not import external provider SDKs.

Required provider boundaries include:

- `AIProvider`;
- `MessagingProvider`;
- `EmailProvider`;
- `PropertyDataProvider`;
- `MapProvider`;
- `StorageProvider`;
- `BillingProvider`;
- `MonitoringProvider`;
- `ElectronicSignatureProvider`.

Provider adapters normalize:

- requests;
- responses;
- errors;
- health status;
- usage metadata;
- provider identifiers.

### Required fallback behavior

| Provider unavailable | Required behavior |
| --- | --- |
| AI provider | Use deterministic rules or clearly show that AI assistance is unavailable; preserve CRM and decision workflows. |
| SMS provider | Retain drafts, allow manual communication logging, show safe delivery-unavailable state, and never pretend a message was sent. |
| Email provider | Retain drafts and templates; provide safe unavailable state. |
| Property-data provider | Support manual facts, CSV imports, research tasks, and mark data unverified. |
| Map provider | Preserve address and parcel information without a map. |
| Monitoring provider | Preserve structured logs and internal health status. |
| Payment provider | Core development and single-user functionality remains usable; paid subscription enforcement may remain disabled in development/test modes. |

### Cost and dependency governance

Every roadmap phase and Execution Order must identify:

- new third-party services;
- new dependencies;
- whether they are free, optional, usage-based, or paid;
- expected data transfer;
- expected operational cost exposure;
- available fallback;
- provider lock-in risk;
- self-hosted or internal alternative;
- reason the integration is necessary.

No new paid service may be added silently. A new paid or usage-based dependency requires:

1. explicit architecture review;
2. documented justification;
3. adapter design;
4. fallback behavior;
5. user approval before configuration or spending;
6. an ADR when it materially affects architecture.

Software dependency governance:

- prefer existing dependencies before adding new packages;
- prefer small, maintained, permissively licensed packages;
- avoid dependencies that require paid hosted services;
- avoid packages that duplicate platform or existing project capabilities;
- record the purpose of every new production dependency;
- evaluate maintenance health, bundle impact, security history, and license;
- do not add dependencies only for minor visual convenience when the existing design system can provide the capability.

### UX requirements for optional integrations

The interface must clearly distinguish:

- available core functionality;
- optional integration features;
- disconnected integrations;
- test mode;
- live mode;
- features that may incur usage costs.

Disconnected paid integrations must not appear as broken core functionality. Acceptable states include:

- "SMS provider not connected";
- "Using rule-based analysis";
- "Property enrichment unavailable; manual research is available";
- "Map view optional".

Upgrade prompts must not be manipulative.

## 1.4 Logical architecture layers

### Presentation layer

- React application shell
- Role-aware navigation
- Dashboard and operational workspaces
- Seller workspace
- Conversation inbox
- Deal workspace
- Transaction workspace
- Dispositions workspace
- Administration workspace

Rules:

- Components render view models and dispatch user intent.
- Components do not call provider SDKs directly.
- Complex state belongs in feature hooks or application services.
- Route-level code splitting is preferred over indefinitely expanding one dashboard section stack.

### Application layer

- Use-case services
- Commands and queries
- Authorization checks
- Workflow orchestration
- AI orchestration
- Notification orchestration
- Validation and idempotency

### Domain layer

- Seller/Contact
- Property
- Lead
- Opportunity/Deal
- Conversation
- Task
- Workflow
- Offer/Underwriting
- Transaction
- Buyer/Dispositions
- Document
- Campaign/Source
- Organization/Identity
- Audit/Event

### Infrastructure layer

- Supabase repositories
- Netlify Function handlers
- Twilio adapter
- Email adapter
- OpenAI adapter
- Storage adapter
- Billing adapter
- Monitoring adapter

## 1.5 Subsystem boundaries

### A. Identity and Organization

Owns:

- users;
- organizations;
- memberships;
- roles and permissions;
- invitations;
- organization settings;
- subscription entitlements.

Does not own CRM records. It provides tenant and actor context to all other subsystems.

### B. CRM Runtime

Owns:

- sellers and contacts;
- properties;
- leads;
- opportunities/deals;
- stages and stage history;
- ownership/assignment;
- notes and activities;
- tasks and appointments;
- lead-source attribution.

### C. Deal Intelligence and Underwriting

Owns:

- property facts used for analysis;
- comps;
- ARV assumptions;
- repair estimates;
- financing assumptions;
- offer scenarios;
- MAO calculations;
- flip, wholesale, rental, and creative-finance projections;
- analysis snapshots and versions.

Calculations must be deterministic and independently testable. AI may explain or recommend assumptions but must not silently replace canonical calculations.

### D. Communication Platform

Owns:

- conversations;
- participants;
- messages;
- templates;
- consent and opt-out state;
- provider message IDs;
- delivery states;
- inbound webhook processing;
- outbound send commands;
- attachments;
- communication audit history.

Channels include SMS first, then email, voice/call metadata, and additional channels through adapters.

### E. AI Copilot

Owns:

- prompt and policy versions;
- model routing;
- structured context assembly;
- response parsing;
- AI recommendations;
- confidence and evidence metadata;
- conversation memory summaries;
- human feedback;
- AI usage and cost telemetry.

The Copilot may summarize, classify, draft, recommend, and explain. It may not send messages, execute offers, change stages, or mutate records without an explicit approved command path.

### F. Workflow Engine

Owns:

- workflow definitions and versions;
- triggers;
- conditions;
- actions;
- workflow runs;
- step runs;
- retries;
- approvals;
- schedules;
- cancellation;
- idempotency keys.

The workflow engine consumes domain events and invokes application commands. It does not bypass subsystem authorization.

### G. Automation Engine

Automation is the policy layer built on the workflow engine. It owns reusable business automations such as:

- new-lead response;
- follow-up sequences;
- stale-lead reactivation;
- appointment reminders;
- stage-based tasks;
- contract and closing reminders;
- buyer notifications;
- escalation and SLA enforcement.

All externally visible actions require consent, compliance checks, rate limits, and configurable approval policy.

### H. Document Management

Owns:

- document metadata;
- object-storage references;
- document categories;
- versions;
- access policy;
- associations with seller, property, deal, offer, transaction, and buyer;
- upload and scan status;
- retention and deletion policy;
- audit history.

Binary files belong in object storage, not PostgreSQL rows. Database records own metadata and access relationships.

### I. Transaction and Closeout

Owns:

- contract milestones;
- title/escrow details;
- contingencies;
- closing checklist;
- closing date;
- assignment fee and revenue realization;
- transaction status history;
- closeout documents and audit events.

### J. Buyers and Dispositions

Owns:

- buyer profiles;
- buy boxes;
- markets and criteria;
- proof-of-funds status;
- deal matching;
- buyer campaigns;
- interest and offer tracking;
- assignment/disposition outcomes.

### K. Analytics and Reporting

Owns read models and metrics, not canonical operational records.

Includes:

- pipeline conversion;
- speed-to-lead;
- contact and offer rates;
- source ROI;
- rep performance;
- revenue;
- workflow performance;
- communication deliverability;
- AI quality and cost;
- operational health.

### L. Platform Operations

Owns:

- configuration;
- feature flags;
- health checks;
- deployment metadata;
- audit logs;
- operational events;
- incident records;
- rate-limit state;
- provider status;
- backup/restore verification.

## 1.6 Domain model

### Core aggregates

#### Organization

- organization_id
- name
- subscription_plan
- settings
- status

#### Membership

- organization_id
- user_id
- role
- permissions
- status

#### Seller

- seller_id
- organization_id
- identity and contact profile
- communication preferences
- consent/opt-out state
- summary fields

#### Property

- property_id
- organization_id
- normalized address
- parcel/external identifiers
- physical attributes
- market metadata

#### Lead

- lead_id
- organization_id
- seller_id
- property_id
- source/campaign
- intake data
- status
- score
- created/assigned timestamps

#### Deal/Opportunity

- deal_id
- organization_id
- lead_id
- stage
- owner
- strategy
- financial state
- next action
- status

#### Conversation

- conversation_id
- organization_id
- seller/contact association
- channel
- status
- latest activity

#### Message

- message_id
- conversation_id
- direction
- provider identifiers
- body/attachment references
- delivery status
- compliance state

#### Underwriting Analysis

- analysis_id
- deal_id
- version
- assumptions
- calculations
- author/source
- created_at

#### Offer

- offer_id
- deal_id
- type
- terms
- status
- version
- approval state

#### Task

- task_id
- organization_id
- related entity
- assignee
- due date
- priority
- status

#### Workflow Definition and Run

- workflow_definition_id
- version
- trigger and policy
- workflow_run_id
- step states
- approval states

#### Transaction

- transaction_id
- deal_id
- milestones
- closing details
- revenue facts

#### Buyer and Buy Box

- buyer_id
- organization_id
- criteria
- compliance/qualification state
- matching preferences

#### Document

- document_id
- organization_id
- related entity
- storage key
- metadata/version/status

#### Audit Event

- audit_event_id
- organization_id
- actor
- action
- entity
- before/after references
- correlation_id
- occurred_at

## 1.7 CRM architecture

The CRM Runtime is the operational backbone. It must support:

- deterministic intake normalization;
- seller and property deduplication;
- lead creation without duplicate opportunity creation;
- configurable stage definitions per organization;
- immutable stage-history events;
- owner and team assignment;
- task and SLA generation;
- source and campaign attribution;
- seller workspace read model;
- complete activity timeline;
- archive, loss reason, and reactivation state.

The current broad `deals` model remains supported during migration, but new capabilities must target explicit domain records and compatibility views/repositories.

## 1.8 Lead pipeline architecture

Pipeline state is modeled as a state machine, not only a text field.

Required behavior:

- allowed transitions are configuration-driven;
- each transition records actor, time, previous stage, next stage, and reason;
- transition side effects are emitted as events;
- drag-and-drop invokes the same transition command as every other UI;
- closed, lost, archived, and reactivated states are explicit;
- stage metrics use history, not only current-stage counts;
- automation triggers after a committed transition.

## 1.9 Seller communication architecture

### Outbound flow

1. User or approved workflow creates a Send Message command.
2. Authorization validates organization, role, seller/deal access, and subscription entitlement.
3. Compliance validates channel consent, opt-out, quiet hours, template rules, and rate limits.
4. A message record is created with `queued` state and idempotency key.
5. Provider adapter sends the message.
6. Provider response updates provider ID and state.
7. Delivery webhook updates lifecycle state.
8. Domain events update conversation and activity read models.

### Inbound flow

1. Provider webhook signature is verified.
2. Payload is normalized and deduplicated.
3. Organization and destination number are resolved.
4. Contact/seller and conversation are matched.
5. Message is persisted before secondary processing.
6. Activity, unread state, notifications, and optional AI analysis are triggered.
7. Provider receives a fast success response.

### Message states

- draft
- queued
- sending
- sent
- delivered
- failed
- received
- suppressed
- cancelled

## 1.10 AI Copilot architecture

### Capabilities

- seller summary;
- motivation and urgency classification;
- conversation summary;
- next best action;
- negotiation coaching;
- objection analysis;
- follow-up drafting;
- deal-risk explanation;
- daily briefing;
- executive insight.

### AI request pipeline

1. Caller requests a named capability.
2. Context builder reads authorized structured data.
3. Data minimizer removes unnecessary PII and secrets.
4. Policy engine selects provider, model, prompt version, limits, and fallback.
5. Provider adapter performs the server-side request.
6. Parser validates a versioned structured response.
7. Result stores provenance, model, prompt version, evidence references, latency, and token/cost metadata.
8. Rule-based fallback is returned when configured and provider execution fails.

### AI governance

- no client-side provider keys;
- no autonomous external communication by default;
- no silent record mutation;
- user-visible AI labeling;
- confidence and reason codes;
- prompt/version auditability;
- bounded context and retention;
- feedback capture;
- provider and model replaceability;
- evaluation datasets and regression tests before model/prompt promotion.

## 1.11 Workflow engine architecture

### Trigger types

- domain event;
- schedule;
- manual command;
- webhook event;
- threshold/SLA condition.

### Action types

- create task;
- update authorized CRM field;
- request message send;
- request AI recommendation;
- notify user/team;
- create approval request;
- invoke integration adapter;
- wait until time/event;
- branch on condition.

### Runtime requirements

- persisted definition versions;
- immutable run history;
- idempotent step execution;
- retry policy with backoff;
- dead-letter/failure state;
- cancellation;
- timeout;
- correlation IDs;
- human approval gates;
- tenant-safe concurrency controls.

## 1.12 Automation engine architecture

Automation templates are product-level policies compiled into workflow definitions. Organization administrators may configure allowed parameters, but cannot insert arbitrary code.

Automation must distinguish:

- **recommendation:** suggests an action;
- **assisted action:** prepares an action for approval;
- **automatic action:** executes within explicit policy and compliance boundaries.

## 1.13 Document management architecture

- Supabase Storage or an approved object store contains file bytes.
- PostgreSQL contains document metadata and relationships.
- Uploads use signed URLs and bounded file policies.
- Malware scanning and content-type validation are required before production document automation.
- Access is tenant- and role-scoped.
- Sensitive documents use private buckets and expiring download URLs.
- Versions are immutable; a new upload creates a new version.
- Deletion follows retention policy and audit requirements.

## 1.14 Reporting architecture

Reporting uses domain read models and event/history facts.

Three report classes:

1. **Operational:** current tasks, overdue work, pipeline, conversations, transactions.
2. **Management:** conversion, source ROI, rep performance, workflow performance, revenue.
3. **Platform:** usage, provider reliability, AI cost/quality, security and audit activity.

Large exports and complex aggregations move to asynchronous jobs when scale requires it. Dashboard components must not load unbounded histories into browser state.

## 1.15 Integration architecture

Every external integration uses:

- a domain-neutral interface;
- a provider adapter;
- server-side credentials;
- validated request and response contracts;
- timeout and retry policy;
- idempotency where available;
- structured sanitized logs;
- health status;
- tenant-aware configuration;
- test/sandbox mode.

Initial adapters:

- Twilio SMS;
- email provider;
- OpenAI;
- Stripe;
- property/comps provider;
- object storage.

## 1.16 Persistence architecture

### Canonical data

PostgreSQL through Supabase is canonical for operational records.

### Access rules

- Client reads/writes use RLS-protected Supabase access where appropriate.
- Privileged operations use authenticated Netlify Functions with service-role access.
- Service-role credentials never reach the browser.
- Repositories own database access for application code.
- Every tenant-owned table includes `organization_id`.
- Foreign keys, unique constraints, checks, and indexes enforce invariants.

### Migration strategy

- one ordered migration authority;
- idempotent or safely repeatable migrations where practical;
- no destructive migration without explicit ADR and backup/rollback plan;
- forward-only production migration by default;
- staging migration validation before production;
- compatibility period for schema transitions.

## 1.17 Security architecture

### Identity

- Supabase Auth issues user sessions.
- Netlify Functions verify bearer tokens server-side.
- Organization membership and permissions are loaded for every privileged request.

### Authorization

- role and permission checks at application service boundaries;
- RLS as database defense-in-depth;
- resource ownership validation;
- entitlement checks for paid features.

### API protection

- strict method validation;
- restricted CORS by environment;
- bounded payloads;
- schema validation;
- rate limiting;
- idempotency keys;
- safe error contracts;
- webhook signature validation;
- replay protection;
- secret redaction.

### Data protection

- TLS in transit;
- provider-managed encryption at rest;
- private object storage;
- PII minimization in logs and AI prompts;
- configurable retention;
- audit logs for security-sensitive actions;
- environment secret rotation process.

### Communication compliance

- consent and source tracking;
- STOP/opt-out enforcement;
- quiet-hour policy;
- sender identity and registration support;
- template and campaign controls;
- suppression list;
- delivery and failure evidence.

## 1.18 Observability architecture

Every request, workflow run, message, and AI request should have a correlation ID.

Required telemetry:

- structured server logs;
- frontend error reporting;
- function latency and error rate;
- provider latency and failures;
- database query failures;
- workflow queue depth and failure counts;
- communication delivery rates;
- AI latency, tokens, cost, fallback rate, and evaluation score;
- deployment version and environment;
- health and readiness endpoints;
- audit events.

Logs must exclude secrets and minimize PII.

## 1.19 Deployment architecture

### Environments

- local;
- preview/branch;
- staging;
- production.

### Runtime

- React/Vite static assets deployed to Netlify CDN;
- Netlify Functions for server APIs and provider integrations;
- Supabase managed Auth, PostgreSQL, Realtime, and Storage;
- external providers accessed only from approved server boundaries.

### Promotion

- pull request validation;
- preview deployment;
- staging smoke validation;
- migration validation;
- production approval;
- production deployment;
- post-deploy smoke and health review.

## 1.20 Release strategy

- semantic versioning;
- compact sprint/Execution Orders;
- one validation cycle per Execution Order;
- one commit and one push after validation;
- feature flags for incomplete or high-risk capabilities;
- release candidate before major production promotion;
- documented rollback criteria;
- database migration and application compatibility checked together;
- no release marked complete while Critical or High security defects remain.

---

# 2. AI Acquisitions OS Implementation Roadmap v1.0

## Roadmap execution rules

- Programs define durable product areas.
- Phases are executed in listed dependency order unless an Architecture Review approves a change.
- Each Execution Order may contain exactly three compact implementation phases.
- An Execution Order references this roadmap, the Enterprise Architecture, and ADRs rather than restating architecture.
- Every phase ends in the single validation cycle defined in Section 4.
- Every roadmap phase and Execution Order must include a Free-First cost and dependency review covering provider tier, licensing, data transfer, cost exposure, fallback, lock-in risk, and internal or self-hosted alternatives.
- Relevant phases must verify that core workflows operate with optional providers disabled, provider absence does not crash a workspace, test mode is clearly labeled, provider code remains behind an adapter, and no external side effect is reported as successful when it did not occur.
- Usage-based actions require explicit configuration and user approval before spending; no phase may make a Tier 2 or Tier 3 provider a hidden prerequisite for the zero-cost core baseline.
- Provider and dependency decisions must preserve the listed roadmap dependency order unless Architecture Review records an approved change.

## Program 1 — CRM Runtime

### CRM-01: Canonical CRM Domain and Schema Baseline

**Objective:** Establish explicit tenant-owned seller, property, lead, deal, stage-history, task, and activity contracts while preserving current behavior.

**Dependencies:** Enterprise Architecture v1.0; ADR-001, ADR-002, ADR-004.

**Implementation scope:**

- inventory current tables and field usage;
- define canonical schema and compatibility mapping from existing `deals` fields;
- establish organization ownership and keys;
- define repository and service contracts;
- create non-destructive migrations and compatibility views/adapters.

**Acceptance criteria:**

- every CRM aggregate has documented ownership and identifiers;
- existing deal loading and seller workspace continue to work;
- new records are tenant-scoped;
- no UI performs new direct Supabase business mutations outside repositories.

**Validation requirements:** migration tests, repository tests, RLS policy tests, current unit suite, build, lint, staging smoke.

**Definition of done:** canonical contracts are merged, documented, tested, and used by at least the primary deal query path.

**Regression scope:** pipeline, search, seller workspace, tasks, activities, dashboard metrics, imports.

### CRM-02: Pipeline State Machine and History

**Objective:** Replace unconstrained stage text changes with validated transitions and immutable history.

**Dependencies:** CRM-01.

**Implementation scope:** stage definitions, transition policy, transition command, stage history, loss/close/reactivation reasons, drag-and-drop integration.

**Acceptance criteria:** every stage change uses one command and records actor/reason/time; invalid transitions fail safely; metrics can use history.

**Validation requirements:** transition unit tests, repository tests, authorization tests, drag-and-drop component tests.

**Definition of done:** all current stage mutation paths use the state machine.

**Regression scope:** pipeline cards, bulk actions, saved views, KPI boards, closeout.

### CRM-03: Seller Workspace Read Model

**Objective:** Provide one bounded, reliable seller workspace query containing seller, properties, active deals, tasks, recent activity, and conversation summary.

**Dependencies:** CRM-01, Communication CP-01.

**Implementation scope:** read model/service, bounded pagination, loading/error states, cache policy, workspace component integration.

**Acceptance criteria:** workspace avoids waterfall queries and unbounded histories; stale or missing relationships do not crash UI.

**Validation requirements:** query contract tests, component tests, performance budget, null-data regression tests.

**Definition of done:** workspace is backed by a documented read contract and stable empty/error states.

**Regression scope:** seller cards, conversation linking, activity timeline, modal navigation.

### CRM-04: Intake, Deduplication, and Attribution

**Objective:** Make manual and CSV/API intake idempotent and source-aware.

**Dependencies:** CRM-01.

**Implementation scope:** normalized address/phone/email keys, duplicate policy, import validation, campaign/source attribution, rejection report.

**Acceptance criteria:** duplicate seller/property/lead creation follows documented rules; imports return row-level outcomes.

**Validation requirements:** fixture imports, duplicate tests, malformed input tests, tenant isolation tests.

**Definition of done:** all supported intake paths use the same normalization service.

**Regression scope:** LeadImporter, DuplicateDetector, DataHealthCenter, search.

## Program 2 — Communication Platform

### CP-01: Canonical Conversation and Message Model

**Objective:** Consolidate message logs and inbox behavior into durable conversation/message aggregates.

**Dependencies:** CRM-01; ADR-003, ADR-006.

**Implementation scope:** conversations, participants, messages, direction, provider IDs, lifecycle states, read/unread state, migration from existing message logs.

**Acceptance criteria:** inbound and outbound messages appear in one conversation; message history persists; pagination is bounded.

**Validation requirements:** migration, repository, conversation matching, component, and RLS tests.

**Definition of done:** Message Center, Conversation Inbox, and Thread use canonical repositories.

**Regression scope:** SMS send, inbound inbox, seller linking, activity timeline.

### CP-02: Authenticated Outbound Messaging Runtime

**Objective:** Provide secure, idempotent outbound SMS through an adapter and queued message lifecycle.

**Dependencies:** CP-01, OPS-01, SEC-01.

**Implementation scope:** authenticated function, authorization, validation, test/live adapter, message queue state, provider response, safe failures, idempotency.

**Acceptance criteria:** unauthorized and cross-tenant sends are denied; duplicate requests do not double-send; test mode is explicit.

**Validation requirements:** endpoint contract tests, provider mocks, auth tests, error-shape tests, rate-limit tests.

**Definition of done:** all UI sends use the authenticated API and persist lifecycle state.

**Regression scope:** MessageCenter, send history, deal conversation linking.

### CP-03: Verified Inbound Messaging and Delivery Status

**Objective:** Securely process inbound messages and provider delivery callbacks.

**Dependencies:** CP-01, CP-02.

**Implementation scope:** signature validation, destination-to-tenant resolution, deduplication, inbound persistence, delivery status updates, opt-out processing.

**Acceptance criteria:** invalid signatures are rejected; replayed callbacks are idempotent; STOP state suppresses future sends.

**Validation requirements:** signed webhook fixtures, replay tests, status transition tests, opt-out tests.

**Definition of done:** inbound and delivery status are production-safe and observable.

**Regression scope:** Conversation Inbox, unread counts, notifications, activity.

### CP-04: Email Channel Adapter

**Objective:** Add email through the same conversation/message contracts.

**Dependencies:** CP-01, SEC-01.

**Implementation scope:** provider adapter, verified sender/domain configuration, templates, delivery callbacks, suppression state.

**Acceptance criteria:** SMS and email share lifecycle contracts without provider-specific UI logic.

**Validation requirements:** adapter contract tests, webhook tests, template rendering tests.

**Definition of done:** email can be drafted, sent, received/status-tracked where provider supports it, and audited.

**Regression scope:** conversation timeline, templates, automation actions.

### CP-05: Communication Compliance and Campaign Controls

**Objective:** Enforce consent, opt-out, quiet hours, sender policy, and campaign limits.

**Dependencies:** CP-02, CP-03.

**Implementation scope:** consent records, suppression lists, quiet hours, messaging policy service, campaign classification, compliance audit events.

**Acceptance criteria:** blocked communications cannot bypass policy through UI, workflow, bulk, or API paths.

**Validation requirements:** policy matrix tests, timezone tests, bulk-send tests, audit tests.

**Definition of done:** every outbound command passes one compliance service.

**Regression scope:** manual sends, sequences, buyer blasts, automations.

## Program 3 — AI Copilot

### AI-01: AI Contract and Governance Baseline

**Objective:** Formalize capability schemas, prompt versions, evidence, confidence, feedback, telemetry, and data minimization.

**Dependencies:** SEC-01, OBS-01; ADR-005.

**Implementation scope:** versioned request/response schemas, model policy, prompt registry, usage records, redaction/minimization, feedback contract.

**Acceptance criteria:** every AI result identifies capability, provider/model, prompt version, fallback mode, and evidence/inputs used.

**Validation requirements:** schema tests, parser fuzz/error tests, secret/PII tests, provider mocks.

**Definition of done:** all existing AI calls use the governed gateway contract.

**Regression scope:** summaries, analysis, Copilot chat, Next Best Action, daily insights.

### AI-02: Seller Intelligence

**Objective:** Produce grounded seller motivation, urgency, objections, and conversation summaries.

**Dependencies:** AI-01, CP-01, CRM-03.

**Implementation scope:** context builder, structured output, evidence references, freshness rules, manual refresh, feedback.

**Acceptance criteria:** output is traceable to authorized conversation/activity facts and safely handles sparse data.

**Validation requirements:** evaluation fixtures, fallback tests, tenant-context tests, component tests.

**Definition of done:** seller workspace displays governed intelligence with feedback and timestamps.

**Regression scope:** seller summary, conversation thread, action inbox.

### AI-03: Next Best Action and Negotiation Copilot

**Objective:** Recommend prioritized, explainable actions and negotiation guidance without autonomous mutation.

**Dependencies:** AI-02, CRM-02, WF-01.

**Implementation scope:** recommendation policy, action taxonomy, objection handling, offer-context integration, approval-ready commands.

**Acceptance criteria:** recommendations include reason, urgency, evidence, confidence, and safe executable intent where applicable.

**Validation requirements:** scenario evaluation set, deterministic fallback tests, unsafe-action tests.

**Definition of done:** recommendations enter Action Inbox and require user approval for mutations or messages.

**Regression scope:** AIInsights, PriorityEngine, ActionInbox, NegotiationTracker.

### AI-04: AI Evaluation and Release Gates

**Objective:** Prevent prompt/model regressions through repeatable evaluation.

**Dependencies:** AI-01 through AI-03.

**Implementation scope:** golden datasets, quality metrics, safety checks, latency/cost budgets, prompt/model promotion report.

**Acceptance criteria:** model or prompt changes cannot promote without passing defined thresholds.

**Validation requirements:** automated eval suite and documented human review sample.

**Definition of done:** AI changes are governed by CI-compatible evaluation gates.

**Regression scope:** all AI capabilities.

## Program 4 — Workflow and Automation Engine

### WF-01: Workflow Definition and Runtime Foundation

**Objective:** Establish persisted, versioned, tenant-safe workflow definitions and runs.

**Dependencies:** CRM-01, SEC-01, OBS-01; ADR-007.

**Implementation scope:** definition schema, run/step schema, trigger interface, action interface, state machine, idempotency, cancellation.

**Acceptance criteria:** a test workflow can trigger, persist each step, retry safely, and complete or fail observably.

**Validation requirements:** runtime state tests, idempotency tests, retry tests, tenant tests.

**Definition of done:** workflow runtime is reusable and independent of any one automation.

**Regression scope:** existing sequence and automation panels.

### WF-02: Approval and Human-in-the-Loop Runtime

**Objective:** Support approval-gated communication and CRM mutations.

**Dependencies:** WF-01, AI-03.

**Implementation scope:** approval requests, role policy, expiration, approve/reject, resumed runs, audit events.

**Acceptance criteria:** gated steps cannot execute before authorized approval; expired/rejected requests resolve predictably.

**Validation requirements:** permission matrix tests, race-condition tests, audit tests.

**Definition of done:** Action Inbox can manage workflow approvals.

**Regression scope:** recommendations, notifications, messages, bulk actions.

### AU-01: Follow-Up Automation Templates

**Objective:** Implement configurable seller follow-up using the workflow runtime.

**Dependencies:** WF-01, WF-02, CP-05.

**Implementation scope:** sequence templates, wait steps, task/message actions, reply/opt-out stop conditions, enrollment state.

**Acceptance criteria:** no duplicate sends, replies stop or branch sequences, compliance blocks are honored.

**Validation requirements:** virtual-clock tests, reply/opt-out scenarios, provider mocks.

**Definition of done:** existing sequence UI manages real persisted workflow enrollments.

**Regression scope:** SequenceEngine, tasks, MessageCenter, conversation inbox.

### AU-02: SLA, Stale Lead, and Pipeline Automations

**Objective:** Generate actionable work from operational conditions.

**Dependencies:** WF-01, CRM-02.

**Implementation scope:** speed-to-lead SLA, missing-next-action, stale lead, contract milestone, overdue task, escalation templates.

**Acceptance criteria:** events create bounded, deduplicated tasks/notifications and resolve when conditions change.

**Validation requirements:** time-based tests, dedup tests, transition tests.

**Definition of done:** AutomationBoard and NotificationsCenter are backed by persisted runtime facts.

**Regression scope:** MorningBriefing, PriorityEngine, TaskDashboard, ActionInbox.

## Program 5 — Deal Intelligence, Transactions, and Dispositions

### DI-01: Versioned Underwriting Engine

**Objective:** Convert analyzer calculations into canonical, versioned analysis snapshots.

**Dependencies:** CRM-01; ADR-008.

**Implementation scope:** assumptions schema, deterministic calculation library, analysis versions, strategy scenarios, saved snapshots.

**Acceptance criteria:** identical inputs produce identical outputs; historical analyses remain immutable; UI explains formulas and assumptions.

**Validation requirements:** calculation fixtures, boundary tests, migration tests, component tests.

**Definition of done:** DealAnalyzer and OfferEngine use the same tested domain library.

**Regression scope:** MAO, wholesale, flip, rental, creative offers, AI context.

### DI-02: Comps and Property Data Integration

**Objective:** Create provider-neutral comparable and property-data ingestion with provenance.

**Dependencies:** DI-01, INT-01.

**Implementation scope:** adapter contract, manual/provider comps, normalization, selection, adjustments, provenance, caching.

**Acceptance criteria:** suggested ARV is explainable and distinguishes manual from provider data.

**Validation requirements:** adapter mocks, normalization tests, stale-data tests, UI tests.

**Definition of done:** CompsEngine uses canonical comp records and provenance.

**Regression scope:** analyzer, offer engine, buyer blast, AI analysis.

### TX-01: Transaction Runtime

**Objective:** Formalize under-contract-to-close operations.

**Dependencies:** CRM-02, DOC-01.

**Implementation scope:** transaction aggregate, milestones, title/escrow, contingencies, checklist, closeout, revenue facts.

**Acceptance criteria:** closing state and revenue are separated from mutable pipeline display fields and fully audited.

**Validation requirements:** milestone state tests, permission tests, closeout regression tests.

**Definition of done:** CloseoutPanel and transaction workspace use canonical transaction services.

**Regression scope:** revenue boards, closed-stage behavior, documents, notifications.

### DS-01: Buyer and Buy-Box Domain

**Objective:** Replace free-text buyer criteria with canonical buyer and buy-box models.

**Dependencies:** CRM-01.

**Implementation scope:** buyer contacts, markets, strategies, price ranges, property criteria, qualification, proof-of-funds metadata.

**Acceptance criteria:** multiple buy boxes per buyer; tenant isolation; validation and search indexes.

**Validation requirements:** repository, validation, RLS, and UI tests.

**Definition of done:** BuyersBoard operates on canonical buyer services.

**Regression scope:** buyer entry, matching, blast generation.

### DS-02: Explainable Buyer Matching and Disposition Tracking

**Objective:** Score and explain buyer matches and track disposition outcomes.

**Dependencies:** DS-01, DI-01.

**Implementation scope:** deterministic match scoring, reason codes, deal campaign, interest, buyer offers, assignment outcome.

**Acceptance criteria:** each match shows criteria passed/failed; no cross-tenant buyer exposure.

**Validation requirements:** scoring fixtures, permission tests, performance tests.

**Definition of done:** BuyerMatches and BuyerBlast use persisted match/campaign records.

**Regression scope:** buyer list, deal workspace, revenue/closeout.

## Program 6 — Documents and Integrations

### DOC-01: Secure Document Storage Runtime

**Objective:** Replace URL-only document records with secure object storage and metadata.

**Dependencies:** SEC-01; ADR-009.

**Implementation scope:** private bucket, signed upload/download, metadata, versions, access checks, file policies.

**Acceptance criteria:** unauthorized downloads fail; file size/type limits enforced; versions and audit events preserved.

**Validation requirements:** storage policy tests, signed URL tests, permission tests.

**Definition of done:** DocumentVault supports secure uploads and downloads.

**Regression scope:** existing linked documents, seller/deal modal, transaction docs.

### INT-01: Integration Adapter Framework

**Objective:** Standardize provider configuration, invocation, health, retries, and errors.

**Dependencies:** OPS-01, SEC-01; ADR-010.

**Implementation scope:** adapter interfaces, provider config, health checks, retry/timeout policy, test doubles.

**Acceptance criteria:** Twilio, OpenAI, email, Stripe, and property data follow common operational contracts where applicable.

**Validation requirements:** adapter contract tests and provider mocks.

**Definition of done:** no new provider integration bypasses the framework.

**Regression scope:** existing server functions and admin health.

### INT-02: Billing and Entitlements

**Objective:** Enforce subscription plans and feature entitlements server-side.

**Dependencies:** Identity baseline, INT-01.

**Implementation scope:** Stripe customer/subscription sync, webhook validation, entitlement service, billing portal, plan limits.

**Acceptance criteria:** client UI cannot bypass paid-feature enforcement; webhook replay is idempotent.

**Validation requirements:** signed webhook tests, entitlement matrix, failure recovery tests.

**Definition of done:** billing panels reflect canonical subscription state and APIs enforce entitlements.

**Regression scope:** organization settings, SaaS readiness, AI/message usage.

## Program 7 — Analytics and Reporting

### AR-01: Canonical Metrics and Event Facts

**Objective:** Define authoritative metric formulas and source facts.

**Dependencies:** CRM-02, CP-01, TX-01; ADR-011.

**Implementation scope:** metric catalog, event facts, stage-duration calculations, source attribution, revenue facts.

**Acceptance criteria:** dashboards reference documented metrics and date/tenant filters consistently.

**Validation requirements:** metric fixtures, timezone tests, reconciliation tests.

**Definition of done:** KPI components use one analytics service/read model.

**Regression scope:** ExecutiveDashboard, KPIBoard, RevenueBoard, SourceBoard, GoalTracker.

### AR-02: Operational Reporting and Exports

**Objective:** Provide bounded filtered reports and CSV exports.

**Dependencies:** AR-01.

**Implementation scope:** report queries, pagination, filters, export job threshold, authorization.

**Acceptance criteria:** reports are tenant-safe and do not load unbounded browser state.

**Validation requirements:** query performance, export boundary, permission, and snapshot tests.

**Definition of done:** primary CRM, communication, source, and revenue reports are available.

**Regression scope:** analytics dashboard and saved views.

### AR-03: Executive and Platform Analytics

**Objective:** Add workflow, communication, AI, provider, and team performance analytics.

**Dependencies:** AR-01, OBS-01, AI-01, WF-01.

**Implementation scope:** delivery rates, automation conversion, AI quality/cost, SLA attainment, provider health, team productivity.

**Acceptance criteria:** metrics identify source data, window, freshness, and exclusions.

**Validation requirements:** metric reconciliation and performance tests.

**Definition of done:** executive workspace provides operational and financial health without duplicative calculations.

**Regression scope:** all executive panels.

## Program 8 — Security, Operations, and Production Readiness

### SEC-01: Tenant-Safe Authentication and Authorization

**Objective:** Enforce authenticated tenant and permission context across database and server APIs.

**Dependencies:** ADR-004.

**Implementation scope:** JWT verification helper, membership/permission service, RLS policies, service-role boundaries, CORS restrictions.

**Acceptance criteria:** anonymous, unauthorized, and cross-tenant access fail consistently; server errors expose no secrets.

**Validation requirements:** RLS integration suite, endpoint auth matrix, CORS tests, security review.

**Definition of done:** every privileged function and tenant table is covered by automated authorization tests.

**Regression scope:** all repositories, functions, inbox, AI, SMS, billing, documents.

### OPS-01: Server API Runtime Standard

**Objective:** Standardize Netlify Function contracts and operational middleware.

**Dependencies:** SEC-01; ADR-006.

**Implementation scope:** request IDs, auth, JSON schema validation, safe responses, logging, timeouts, rate-limit hooks, idempotency.

**Acceptance criteria:** all production functions use shared middleware and versioned API contracts.

**Validation requirements:** contract tests for every endpoint and failure mode.

**Definition of done:** no production function has bespoke security/error plumbing.

**Regression scope:** AI, messaging, billing, inbound webhooks.

### OBS-01: Persistent Observability

**Objective:** Add production-grade errors, metrics, traces, health, and audit correlation.

**Dependencies:** ADR-012.

**Implementation scope:** monitoring provider adapter, frontend error boundary reporting, function telemetry, correlation IDs, health/readiness API, alerts.

**Acceptance criteria:** production failures can be traced from user action through API, workflow/provider, and persistence.

**Validation requirements:** synthetic error tests, health checks, redaction tests, alert routing test.

**Definition of done:** runbooks identify dashboards and alerts for critical workflows.

**Regression scope:** application shell and all server functions.

### OPS-02: Test Pyramid and Release Gates

**Objective:** Make release confidence repeatable.

**Dependencies:** SEC-01, OPS-01.

**Implementation scope:** unit, component, repository integration, RLS, API contract, webhook, E2E, accessibility, performance, and smoke tests.

**Acceptance criteria:** CI blocks promotion on required gates; flaky tests have ownership and thresholds.

**Validation requirements:** the gates themselves execute in CI and preview/staging.

**Definition of done:** release checklist is automated except explicitly documented human approvals.

**Regression scope:** entire product.

### OPS-03: Backup, Recovery, and Incident Readiness

**Objective:** Establish recoverability and operational ownership.

**Dependencies:** OBS-01.

**Implementation scope:** database backup verification, storage recovery, migration rollback playbook, incident severity, on-call/runbooks, recovery exercises.

**Acceptance criteria:** documented RPO/RTO targets are tested; restore exercise produces evidence.

**Validation requirements:** tabletop and staging restore drill.

**Definition of done:** production launch has verified recovery and incident procedures.

**Regression scope:** deployment and data operations.

### UX-01: Route-Level Product Shell and Accessibility

**Objective:** Replace the indefinitely expanding single dashboard with role-aware workspaces while preserving capabilities.

**Dependencies:** stable domain services from CRM-01 and CP-01.

**Implementation scope:** navigation, routes, dashboard, inbox, sellers, deals, transactions, buyers, analytics, admin; design tokens; accessibility baseline.

**Acceptance criteria:** users can locate primary jobs by role; keyboard and mobile workflows meet defined accessibility/responsiveness criteria.

**Validation requirements:** E2E navigation, accessibility scan, responsive visual checks.

**Definition of done:** `AppSections` is no longer the sole long-term product navigation model.

**Regression scope:** every current panel and modal entry point.

---

# 3. Architectural Decision Record Index v1.0

Future ADRs live under `docs/enterprise/adrs/` and use the status values Proposed, Accepted, Superseded, or Rejected. This index is controlling until split into individual ADR files.

## ADR-001 — Domain-Oriented Modular Monolith

**Status:** Accepted.

**Decision:** Maintain one deployable product with explicit domain modules and service contracts. Do not split into microservices before measured scaling or organizational needs justify operational complexity.

**Consequences:** Fast iteration and shared transactions remain possible; domain boundaries must be enforced in code review and tests.

## ADR-002 — Canonical Domain Ownership and Compatibility Migration

**Status:** Accepted.

**Decision:** Move from a deal-table-centered model toward explicit seller, property, lead, deal, conversation, task, workflow, transaction, buyer, and document aggregates. Preserve compatibility during incremental migration.

**Consequences:** Temporary adapters/views are allowed; new features must not deepen the legacy concentration.

## ADR-003 — Conversation and Message Data Ownership

**Status:** Accepted.

**Decision:** The Communication Platform owns conversations, messages, delivery lifecycle, consent, and provider identifiers. CRM consumes communication summaries but does not own message records.

**Consequences:** All channels share one lifecycle model; provider-specific fields remain in adapter metadata.

## ADR-004 — Tenant Isolation and Authorization Strategy

**Status:** Accepted.

**Decision:** Every tenant-owned record contains `organization_id`; Supabase RLS provides database enforcement; application services and Netlify Functions also verify membership, permissions, and ownership.

**Consequences:** Tenant context is mandatory in repositories, cache keys, events, AI requests, workflows, reports, and storage paths.

## ADR-005 — Governed Hybrid AI Architecture

**Status:** Accepted.

**Decision:** AI is accessed through a versioned gateway with rule-based fallback, structured schemas, server-side providers, evidence metadata, and human approval for side effects.

**Consequences:** UI cannot call OpenAI directly; autonomous communication or mutation is prohibited unless a future ADR narrows the policy.

## ADR-006 — Netlify Functions as Privileged API Boundary

**Status:** Accepted for current scale.

**Decision:** Provider calls, webhooks, billing, service-role database operations, and privileged workflows execute through hardened Netlify Functions using shared middleware.

**Consequences:** Functions must verify auth/signatures, use bounded inputs, safe errors, rate limits, idempotency, and observability. A future runtime migration remains possible behind API contracts.

## ADR-007 — Persisted Workflow Runtime and Event-Driven Automation

**Status:** Accepted.

**Decision:** Workflows are persisted state machines that consume events and invoke authorized commands. In-memory UI-derived automation is not authoritative.

**Consequences:** Runs, steps, retries, approvals, schedules, and failures are stored and auditable.

## ADR-008 — Deterministic Underwriting with Versioned Snapshots

**Status:** Accepted.

**Decision:** Financial calculations are deterministic domain functions. Each saved analysis is an immutable versioned snapshot. AI can recommend or explain inputs but cannot redefine formulas silently.

**Consequences:** Analyzer, offers, reports, and AI context share the same calculation library.

## ADR-009 — Private Object Storage for Documents

**Status:** Accepted.

**Decision:** File bytes live in private object storage. PostgreSQL stores metadata, relationships, versions, and policy. Access uses short-lived signed URLs.

**Consequences:** URL-only unmanaged documents are a compatibility state, not the final architecture.

## ADR-010 — Replaceable External Provider Adapters

**Status:** Accepted.

**Decision:** Twilio, email, OpenAI, Stripe, property data, and monitoring providers are accessed through interfaces and adapters with test doubles.

**Consequences:** Domain/application layers do not import provider SDKs.

## ADR-011 — Canonical Event Facts and Analytics Read Models

**Status:** Accepted.

**Decision:** Operational mutations emit versioned domain events after commit. Analytics derives bounded read models from canonical records and event facts.

**Consequences:** Dashboard metrics do not define business truth independently; event schemas require compatibility governance.

## ADR-012 — Correlated Structured Observability

**Status:** Accepted.

**Decision:** User actions, API requests, workflows, AI requests, messages, and provider callbacks carry correlation IDs and structured sanitized telemetry.

**Consequences:** Logs containing secrets or unnecessary PII are prohibited; health, error, latency, and lifecycle metrics become release requirements.

## ADR-013 — Route-Level Workspaces over Infinite Dashboard Aggregation

**Status:** Proposed.

**Decision:** Evolve from a single page containing all panels to route-level role-aware product workspaces while retaining an executive dashboard.

**Decision trigger:** Begin after CRM-01 and CP-01 stabilize domain read contracts.

## ADR-014 — Single Migration Authority

**Status:** Accepted.

**Decision:** All schema changes use one ordered migration path with staging validation and documented rollback/forward recovery. Ad hoc production SQL is prohibited.

**Consequences:** Supabase SQL Editor may be used only to execute reviewed migration content or emergency runbooks with recorded evidence.

## ADR-015 — API and Event Version Compatibility

**Status:** Accepted.

**Decision:** Public/internal API contracts and event payloads are versioned. Additive changes are preferred; breaking changes require an ADR and compatibility period.

**Consequences:** UI, workflows, and integrations can evolve independently without hidden coupling.

---

# 4. Engineering Operating Process v1.0

## 4.1 Permanent workflow

AI Acquisitions OS follows this engineering workflow permanently:

```text
Architecture
↓
Roadmap
↓
Execution Order
↓
Implementation
↓
One Validation Cycle
↓
One Commit
↓
One Push
↓
Architecture Review
↓
Next Sprint
```

## 4.2 Governance rules

1. No giant implementation prompts.
2. No architecture redesign during implementation.
3. No feature implementation without a roadmap phase.
4. No Execution Order may silently expand scope.
5. Architecture changes require an ADR before implementation.
6. Implementation reuses existing services and contracts before creating new ones.
7. Every Execution Order produces one coherent commit after one complete validation cycle.
8. A failed validation cycle returns to implementation; it does not create partial commits.
9. A push occurs only after validation passes or an explicitly approved known-warning exception is documented.
10. Architecture Review decides whether the roadmap or ADR index needs adjustment before the next sprint.
11. No paid or usage-based service may be added silently; configuration and spending require explicit user approval.
12. Every external integration requires an adapter boundary, safe fallback, cost-exposure review, and no-vendor-lock-in validation.
13. Existing infrastructure, internal implementation, and appropriate open-source alternatives must be evaluated before adding a service or production dependency.

## 4.3 Compact three-phase Execution Order format

Every future Execution Order contains exactly three implementation phases.

### Execution Order header

- Execution Order ID
- Roadmap references
- Architecture references
- ADR references
- Objective
- Explicit in-scope items
- Explicit out-of-scope items
- Dependency confirmation
- Risk level
- Free-First and cost-governance review
- New third-party services and production dependencies, including license and provider tier
- Data-transfer and operational-cost exposure
- Fallback, lock-in risk, and internal or self-hosted alternative
- User approval requirement for configuration or spending

### Phase A — Contracts and Persistence

Use only what the feature requires:

- domain types/contracts;
- validation schemas;
- database migration;
- repository interfaces;
- event/API contract changes;
- compatibility mapping.

Phase A must not build UI beyond test fixtures.

### Phase B — Runtime and Services

Use only what the feature requires:

- application use cases;
- domain services;
- server function/API;
- provider adapter;
- workflow/action integration;
- authorization and observability;
- service/repository tests.

Phase B must not redesign contracts established in Phase A. If a contract is invalid, stop and request Architecture Review.

### Phase C — Product Integration and Validation

Use only what the feature requires:

- hooks and view models;
- UI integration;
- loading, empty, error, and permission states;
- accessibility/responsive behavior;
- regression updates;
- documentation updates;
- full validation cycle.

## 4.4 Execution Order acceptance template

Each Execution Order must specify:

- objective;
- dependencies;
- implementation scope;
- acceptance criteria;
- validation requirements;
- definition of done;
- regression scope.

These values are copied by reference from the roadmap and narrowed only where necessary. Architecture is never rewritten inside the prompt.

## 4.5 One validation cycle

Run the complete applicable cycle once after all three phases are implemented:

1. targeted unit and component tests;
2. repository/integration tests;
3. API contract and authorization tests;
4. migration and RLS tests when schema changes;
5. webhook/provider mock tests when integrations change;
6. AI evaluation tests when AI changes;
7. browser E2E and accessibility checks when workflows/UI change;
8. `npm run lint`;
9. `npm run test:run` or approved full test command;
10. `npm run build`;
11. preview/staging smoke check where required;
12. secret and generated-file review;
13. changed-file and scope review.

The validation report records:

- commands;
- pass/fail results;
- pre-existing warnings;
- new warnings;
- migration result;
- security result;
- regression result;
- known limitations.

## 4.6 One commit and one push

After validation passes:

- stage only files belonging to the Execution Order;
- create one descriptive commit;
- push once to the designated branch;
- record commit hash, branch, validation summary, and changed files;
- do not combine unrelated cleanup.

Recommended commit format:

```text
<type>(<program>): <Execution Order objective>
```

Examples:

```text
feat(communication): establish canonical conversation runtime
feat(crm): add validated pipeline transitions
chore(operations): enforce authenticated function middleware
```

## 4.7 Architecture Review

After the push, perform one review answering:

1. Did implementation conform to the referenced architecture sections?
2. Did any dependency or boundary change?
3. Is a new ADR required?
4. Was any technical debt introduced or retired?
5. Did security, observability, performance, or tenant isolation change?
6. Does the roadmap order remain correct?
7. Is the system ready for the next Execution Order?

### Free-First Architecture Review Checklist

Before approving an Execution Order, answer:

- Does it require a new service?
- Does that service require payment or a payment method?
- Can existing infrastructure satisfy the need?
- Can the capability be implemented internally?
- Is an open-source alternative appropriate?
- Is the integration optional?
- Is there a safe fallback?
- Is provider-specific code isolated?
- Is user approval required before spending?
- Does disabling the provider preserve core workflows?

Possible outcomes:

- Approved — continue roadmap.
- Approved with documented debt — create roadmap item.
- Architecture amendment required — stop implementation and update architecture/ADR first.
- Rework required — do not begin next sprint.

## 4.8 Definition of architectural compliance

An implementation is architecturally compliant only when:

- it belongs to a defined subsystem;
- its data owner is explicit;
- it uses approved APIs/repositories/adapters;
- tenant and authorization rules are enforced;
- mutations are auditable;
- external side effects are idempotent and observable;
- AI behavior follows governance;
- workflow behavior follows persisted runtime policy;
- tests cover its contracts and regression scope;
- documentation and ADR references remain accurate.

## 4.9 Prohibited implementation patterns

- provider SDK imports in React components;
- service-role keys in browser code;
- direct cross-domain table mutations from UI;
- new unversioned event payloads;
- silent AI mutations;
- unbounded database reads into dashboard state;
- automation stored only in browser/local state;
- duplicate business calculations in multiple components;
- webhook endpoints without signature validation;
- tenant-owned tables without organization ownership and RLS;
- placeholder production components presented as complete;
- broad unrelated refactors inside feature Execution Orders.

## 4.10 Architecture baseline change process

This v1.0 baseline may change only through:

1. an Architecture Review identifying a required change;
2. a Proposed ADR describing context, decision, alternatives, and consequences;
3. explicit approval;
4. an architecture/roadmap document update;
5. a later Execution Order implementing the approved decision.

Implementation never precedes the approved architecture change.

---

# 5. Initial Execution Sequence

The first recommended sprints are:

1. **Execution Order EO-SEC-01** — SEC-01 tenant-safe authentication and authorization.
2. **Execution Order EO-CRM-01** — CRM-01 canonical CRM domain and schema baseline.
3. **Execution Order EO-OPS-01** — OPS-01 server API runtime standard.
4. **Execution Order EO-CP-01** — CP-01 canonical conversation and message model.
5. **Execution Order EO-CRM-02** — CRM-02 pipeline state machine and history.
6. **Execution Order EO-AI-01** — AI-01 governance baseline.
7. **Execution Order EO-WF-01** — WF-01 workflow runtime foundation.
8. **Execution Order EO-DI-01** — DI-01 versioned underwriting engine.

This order addresses security and data ownership before expanding communication, AI, and automation behavior.

---

# 6. Architecture Phase Completion Statement

This document completes the requested architecture phase by establishing:

- Enterprise Architecture v1.0;
- Implementation Roadmap v1.0;
- Architectural Decision Record Index v1.0;
- Engineering Operating Process v1.0.

No new product functionality is authorized or implemented by this phase. Future work begins only through a compact three-phase Execution Order referencing this baseline.

---

# 7. Decision-First Product and UX Architecture Amendment

## Status

Architecture amendment accepted for future implementation planning. This document governs product architecture, user experience architecture, roadmap sequencing, and ADR alignment for the next evolution of AI Acquisitions OS.

This amendment is documentation-only. It does not authorize immediate production code, database, API, dependency, or workflow changes.

## Architectural Assessment

### Existing Support

- `docs/PRODUCT_OVERVIEW.md` already identifies the current platform as an AI-assisted acquisitions CRM with Seller Workspace, Conversation Hub, AI Copilot, Offer System, Property Intelligence, Buyer CRM, and Transaction Management.
- `docs/AI_COPILOT_ARCHITECTURE.md` already supports server-side AI calls, rule-based fallback behavior, structured deal context, safe response parsing, and review-only AI guidance.
- `docs/ACTION_INBOX_PLAN.md` already introduces reviewable action concepts, local action states, shortcuts, and future workflow approval queue integration.
- `docs/PROPERTY_DATA_INTEGRATION.md` already establishes provider abstraction, normalized property data, confidence, missing data, and server-side provider-key requirements.
- `docs/SAAS_ARCHITECTURE.md` already defines tenant context, role placeholders, and the safety boundary for delayed tenant enforcement.
- `docs/ARCHITECTURE_OVERVIEW.md` already separates UI, services, serverless functions, provider abstractions, and cross-cutting services.

### Required Amendments

- The product model must move from tool-heavy CRM navigation to the **Decision-First Product Model**.
- The Seller Workspace pattern must evolve into the **Deal Decision Room** with contextual tabs rather than many unrelated mounted panels.
- Action Inbox concepts must be elevated into the **Universal Approval Inbox** with tenant-aware, role-aware, auditable, resumable approvals.
- Property analysis must become part of the **Asset Strategy Layer**, and land must be explicitly separated from residential house analysis.
- AI and rule-based outputs must use formal, explainable decision metrics including **Pursuit Score**, **Recommendation Confidence**, **Data Reliability**, **Offer Readiness**, and **Evidence and Provenance**.
- Data gaps must be handled by the **Missing Information Autopilot** and **Research Workbench**, not scattered UI warnings.
- UX must be governed by the **Product Experience and Design System** instead of ad hoc component styling.
- The roadmap must be reorganized into decision intelligence, asset strategy, product experience, research/data intelligence, and productivity automation programs.

### Roadmap Conflicts Resolved

- Current roadmap items list many feature areas without a governing decision flow. This document reorders future work around decision quality, time saved, and background automation.
- Existing AI roadmap language includes automation and briefings but does not define approval boundaries. This document requires human approval for canonical CRM mutations and high-risk actions.
- Existing property-data roadmap treats property intelligence generically. This document requires asset type identification before analysis and prohibits analyzing vacant land as a house.
- Existing UI roadmap is implicit. This document establishes explicit Product Experience and Design System governance before major workspace rebuilds.

### Duplicate Concepts Consolidated

- Action Inbox, notification center, workflow approvals, drafted communications, and AI recommendations are consolidated under the **Universal Approval Inbox**.
- Seller Workspace, AI Intelligence Dashboard, Offer panels, Property Intelligence, Documents, Closing, Activity, and Communication panels are consolidated under the **Deal Decision Room**.
- Data confidence, missing data, source freshness, and external verification are consolidated under **Evidence and Provenance**, **Data Reliability**, and **Missing Information Autopilot**.

### Terminology Standardization

The following terms are canonical and must be used consistently in future architecture, roadmap, ADR, product, and implementation documents:

- **Decision-First Product Model**
- **Today Workspace**
- **Universal Approval Inbox**
- **Deal Decision Room**
- **Asset Strategy Layer**
- **Pursuit Score**
- **Recommendation Confidence**
- **Data Reliability**
- **Offer Readiness**
- **Missing Information Autopilot**
- **Research Workbench**
- **Evidence and Provenance**
- **Product Experience and Design System**
- **Simplicity Guardrail**

## Governing Product Model

### Decision-First Product Model

AI Acquisitions OS is **decision-first, not tool-first**.

The platform must feel like one intelligent acquisition assistant rather than many disconnected dashboards and tools. Users should primarily review prioritized opportunities, approve important actions, communicate with sellers, make acquisition decisions, and handle exceptions.

The platform should automatically organize data, identify missing information, calculate deal potential, verify data reliability, prioritize opportunities, recommend next actions, prepare communication and workflow actions, reduce duplicate work, and surface only meaningful exceptions.

### Core Decision Flow

```text
Identify
  ↓
Verify
  ↓
Decide
  ↓
Act
  ↓
Learn
```

- **Identify:** Ingest or discover opportunities, classify asset type, deduplicate records, detect seller situations, and rank initial potential.
- **Verify:** Check decision-critical facts, assess Data Reliability, resolve conflicts, assign source provenance, and create research tasks.
- **Decide:** Present a recommendation, Pursuit Score, Recommendation Confidence, risk, readiness, action window, and supporting evidence.
- **Act:** Prepare approved communications, offers, workflow actions, stage changes, buyer campaigns, and follow-up tasks.
- **Learn:** Capture outcomes, overrides, seller responses, stale assumptions, conversion results, and team feedback to improve future recommendations.

### Tool-to-Capability Model

Current tools become background capabilities or contextual parts of guided workspaces:

- Pipeline Board becomes a prioritized pipeline view plus source for Today Workspace queues.
- Conversation Inbox becomes part of Inbox and Deal Decision Room communication context.
- Seller Workspace becomes the Deal Decision Room.
- Offer panels become contextual decision and numbers capabilities.
- Property Intelligence becomes asset-strategy-specific verification and underwriting support.
- Buyer CRM becomes buyer matching and disposition readiness support.
- Transaction Management becomes Closing or Disposition workflow context.
- AI Copilot becomes embedded decision assistance, exception explanation, and communication preparation.
- Workflow Engine becomes background orchestration with Universal Approval Inbox checkpoints.

Independent dashboard panels should be retained only when they support a clear decision or action. Otherwise they must be combined, hidden, or converted into background services.

## Simplified Product Navigation

### Target Primary Navigation

- **Today**
- **Pipeline**
- **Inbox**
- **Deals or Properties**
- **Buyers**
- **Reports**
- **Settings**

### Role-Aware Visibility

- Acquisition users see Today, Pipeline, Inbox, Deals or Properties, Reports, and Settings scoped to their permissions.
- Disposition users see Today, Buyers, Deals or Properties, Inbox, Reports, and disposition-specific approval queues.
- Operators and admins see Settings, Reports, Universal Approval Inbox configuration, team capacity, workflow health, and tenant controls.
- Read-only or limited users see only assigned queues, assigned opportunities, permitted reports, and approved communication surfaces.

Navigation visibility must not be the only security boundary. Backend, repository, workflow, and approval enforcement must remain tenant-aware and role-aware.

### Today Workspace

The **Today Workspace** is the primary operating screen. It is not a dashboard of charts; it is the daily decision and action queue.

Required Today sections:

- **Act Now:** highest-priority opportunities and actions requiring immediate user response.
- **Approvals:** pending Universal Approval Inbox items assigned to or permitted for the user.
- **Waiting:** opportunities awaiting seller reply, external data, teammate input, or scheduled follow-up.
- **At Risk:** contracts, hot leads, stale deals, conflicting facts, expiring action windows, or workflow exceptions.
- **Completed:** decisions and actions completed today, with links to underlying evidence and activity.

The Today Workspace must support filtering by role, market, asset type, queue ownership, urgency, risk, and approval type.

## Daily Acquisition Briefing

The Daily Acquisition Briefing is a generated, reviewable summary for the Today Workspace and optional notification channels.

It must summarize:

- urgent new leads
- seller replies
- deals ready for decisions
- missing information
- overdue follow-ups
- contracts at risk
- important opportunity changes
- system or workflow exceptions

Briefings must be explainable and link to source records, evidence, approvals, and Deal Decision Rooms. Briefings must distinguish facts, recommendations, assumptions, and stale or unverified information.

## Universal Approval Inbox

The **Universal Approval Inbox** is the single approval system for:

- offers
- drafted communications
- workflow actions
- stage changes
- AI-extracted CRM updates
- buyer campaigns
- recommendation overrides
- high-risk decisions

Approval records must be:

- tenant-aware
- role-aware
- auditable
- resumable by workflows
- linked to Evidence and Provenance
- assignable to users or roles
- stateful across draft, pending, approved, rejected, expired, canceled, and completed states

Workflow systems may prepare actions, but must pause at approval checkpoints when configured by tenant policy, risk level, role, or action type. Approval decisions must capture who approved, what changed, why, when, and which evidence was available.

## Deal Decision Room

The **Deal Decision Room** is one guided workspace per opportunity. It replaces the current pattern of opening many unrelated panels.

### Residential Tabs

- **Decision**
- **Seller**
- **Property**
- **Numbers**
- **Communication**
- **Activity**
- **Documents**
- **Closing**

### Land Tabs

- **Decision**
- **Seller**
- **Parcel**
- **Buildability**
- **Numbers**
- **Communication**
- **Documents**
- **Disposition**

### Decision Tab Requirements

The Decision tab is the first view and must show:

- recommendation
- Pursuit Score
- Recommendation Confidence
- Data Completeness
- Data Reliability
- Offer Readiness
- risk level
- financial resilience
- deal effort score
- cost of delay
- recommended action window
- missing decision-critical facts
- active approvals
- next recommended action
- evidence summary

Each tab must support contextual actions without forcing users to navigate through unrelated dashboards.

## Asset Strategy Layer

### Strategy Hierarchy

```text
Common Acquisition Core
│
├── Residential Acquisition Strategy
├── Vacant Land Acquisition Strategy
├── Small Multifamily Strategy
├── Manufactured Home Strategy
└── Commercial Strategy, deferred
```

### Supported Priority

1. Residential homes
2. Vacant residential land
3. Small multifamily
4. Manufactured homes later
5. Commercial later

The platform must identify asset type before analysis and must never analyze land as though it were a house.

### Common Acquisition Core

The Common Acquisition Core defines shared concepts:

- seller identity and authority
- communication history
- opportunity source
- acquisition intent
- timeline
- asking price
- decision state
- approvals
- Evidence and Provenance
- Data Reliability
- Data Completeness
- Pursuit Score
- Recommendation Confidence
- activity history
- ownership and tenant context

### Strategy Contract

Each asset strategy must define:

- required facts
- data-completeness rules
- underwriting model
- risk rules
- pursuit scoring
- readiness gates
- offer logic
- exit strategies
- buyer matching rules
- verification requirements

### Residential Acquisition Strategy

Residential analysis must focus on ARV, repairs, occupancy, condition, comparable sales, rent potential, mortgage context, seller motivation, timeline, title/closing readiness, and exit strategies such as wholesale, fix-and-flip, buy-and-hold, seller finance, and subject-to.

### Vacant Land Acquisition Strategy

Vacant land analysis must focus on parcel identity, legal access, road frontage, zoning, permitted use, utilities, water/sewer/septic feasibility, flood zones, wetlands, topography, deed restrictions, subdivision potential, taxes and liens, comparable land sales, builder demand, entitlement friction, and disposition path.

### Small Multifamily Strategy

Small multifamily analysis must focus on unit count, rent roll, vacancy, expenses, NOI, cap rate, DSCR-like resilience, rent upside, repair scope, tenant risk, local rental demand, financing assumptions, and investor buyer fit.

### Manufactured Home Strategy

Manufactured home strategy is deferred. When activated, it must separate land-owned from park-owned homes, title type, age, HUD status, transportability, park rules, lot rent, financing constraints, and buyer pool.

### Commercial Strategy

Commercial strategy is deferred. It must not be implemented until tenant needs, data-provider coverage, underwriting requirements, and compliance boundaries are separately approved.

## Decision Intelligence Model

Decision Intelligence outputs must be explainable, evidence-backed, tenant-aware, and asset-strategy-specific.

### Metric Definitions

- **Pursuit Score:** A 0-100 assessment of whether the opportunity deserves continued acquisition effort, based on strategy-specific economics, motivation, timing, risk, data quality, and execution capacity.
- **Recommendation:** The system’s current suggested decision or action, such as pursue, verify, negotiate, make offer, wait, revisit, assign, disposition, or pass.
- **Recommendation Confidence:** The confidence that the current Recommendation is appropriate, based on data completeness, data reliability, model fit, evidence freshness, conflicts, and historical outcomes.
- **Data Completeness:** The percentage and criticality-weighted status of required facts for the applicable Asset Strategy Layer.
- **Data Reliability:** A grade representing source trust, recency, conflict status, verification level, and provenance quality.
- **Financial Resilience:** Strategy-specific tolerance for adverse changes, including repair overruns, lower ARV, delayed closing, title risk, entitlement friction, vacancy, rent variance, or buyer demand softness.
- **Deal Effort Score:** Estimated operational effort required to reach a decision or close, including research, seller follow-up, negotiation, approvals, underwriting, and coordination.
- **Risk Level:** Current risk severity across financial, legal, data, seller, asset, timeline, workflow, and execution dimensions.
- **Offer Readiness:** Whether the opportunity has enough verified facts, financial inputs, approvals, and strategy-specific gates to prepare or present an offer.
- **Cost of Delay:** Estimated loss or risk increase from waiting, including seller urgency, competition, contract deadlines, stale follow-up, price changes, or expiring approvals.
- **Recommended Action Window:** The time window in which the recommended action should occur.
- **Deal Expiration and Revalidation:** Rules that expire stale recommendations and require revalidation when facts age, conflict, or materially change.
- **Automatic Priority Recalculation:** Background recalculation triggered by new messages, imported facts, verification results, approval decisions, stage changes, buyer changes, deadlines, or manual overrides.

### Explainability Requirements

Every metric must retain:

- input facts
- source record identifiers
- source type
- source timestamp
- source trust level
- verification status
- model version or ruleset version
- user overrides
- prior recommendation state
- explanation text suitable for operators

## Missing Information Autopilot and Research Workbench

### Missing Information Autopilot

The **Missing Information Autopilot** detects missing decision-critical information, identifies conflicting values, creates verification tasks, obtains permitted external data, prepares seller questions, tracks research status, and reduces confidence when facts are stale or unverified.

It must not silently mutate canonical CRM records. It may propose facts and actions through the Universal Approval Inbox.

### Research Workbench

The **Research Workbench** is the operator-facing workspace for verification, source review, conflict resolution, seller authority checks, and external-data status.

Research status values should include needed, requested, in progress, blocked, conflicting, verified, rejected, stale, and expired.

### Land-Specific Verification

Vacant land verification must include:

- parcel identity
- legal access
- road frontage
- zoning
- permitted use
- utilities
- water/sewer/septic feasibility
- flood zones
- wetlands
- topography
- deed restrictions
- subdivision potential
- taxes and liens
- comparable land sales
- builder demand

Land recommendations must degrade when any critical land-specific verification item is missing, stale, conflicting, or unverified.

## Automatic CRM Updating

AI Acquisitions OS may propose CRM updates from:

- calls
- messages
- notes
- uploaded documents
- imported records

The system may propose:

- asking price changes
- motivation changes
- timeline changes
- property-condition facts
- occupancy
- follow-up tasks
- stage changes

AI must not silently mutate canonical CRM records. Proposed mutations must go through human review, show Evidence and Provenance, identify conflicting current values, and record approval or rejection decisions.

## Opportunity Discovery and List Intelligence

Future roadmap support must include:

- opportunity discovery
- list stacking
- seller situation recognition
- target-market rules
- acquisition buy boxes
- prospect ranking
- revisit automation

This architecture amendment does not authorize data-provider integrations. Provider selection, contracts, security review, schema impact, and cost controls require separate implementation planning.

## Product Experience and Design System

### Governing UI Principle

Every interface element must belong to the shared design system, reinforce clear hierarchy, and help the user complete a decision or action with minimal navigation.

The interface must feel calm, focused, consistent, immediate, and professional.

### Design System Scope

The **Product Experience and Design System** program must define:

- professional application shell
- collapsible sidebar
- clean top navigation
- global command/search bar
- consistent tabs
- one icon library
- standardized icon sizes
- typography scale
- spacing scale
- color and status system
- reusable UI components
- responsive behavior
- accessibility requirements
- loading skeletons
- optimistic interactions
- reduced-motion support
- keyboard navigation
- route-level workspaces
- consistent drawers, modals, tables, cards, badges, inputs, and empty states

### Route-Level Workspaces

Primary workspaces must be route-level concepts:

- Today Workspace
- Pipeline
- Inbox
- Deal Decision Room
- Buyers
- Reports
- Settings
- Research Workbench where permissioned

Route-level workspaces must support direct links, browser navigation, loading states, permission states, empty states, and error states.

## Simplicity Guardrail

Every proposed feature must answer:

1. Does it save meaningful time?
2. Does it improve decision accuracy?
3. Can it operate in the background or inside an existing workflow?

Features that fail this test must be removed, combined, hidden, or rejected.

This guardrail applies to product roadmap, design reviews, architecture reviews, implementation planning, and release readiness.

## Implementation Roadmap

Each roadmap phase below includes objective, dependencies, implementation scope, acceptance criteria, validation requirements, definition of done, and regression scope. Phase order is dependency-aware; teams must not implement downstream UX automation before the required decision, evidence, approval, and asset-strategy contracts exist.

### Program: Decision Intelligence

| Phase | Objective | Dependencies | Implementation Scope | Acceptance Criteria | Validation Requirements | Definition of Done | Regression Scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DI-01 Decision Model Foundation | Establish canonical decision entities, states, evidence links, and output contracts. | Tenant context foundation; existing service-result patterns. | Define decision state, recommendation state, metric contracts, evidence references, and override records. | Decisions can represent identify, verify, decide, act, and learn states without UI-specific coupling. | Contract review, sample fixtures, architecture review. | Contracts documented, ADR linked, migration plan deferred. | Existing CRM reads, conversation summaries, AI fallback outputs. |
| DI-02 Pursuit Scoring | Add asset-strategy-aware Pursuit Score definitions. | DI-01; AS-01. | Define score inputs, weights, explanations, and strategy hooks. | Pursuit Score can be explained by input categories and evidence. | Rule fixtures for residential and land examples. | Scoring spec accepted for implementation. | Existing lead priority and deal intelligence semantics. |
| DI-03 Confidence and Reliability | Separate Recommendation Confidence from Data Reliability. | DI-01; RDI-03. | Define reliability grades, confidence calculation factors, conflict impact, freshness impact. | Confidence never substitutes for verified data quality. | Review stale/conflicting examples. | Reliability and confidence contracts documented. | Existing confidence labels in AI and property data docs. |
| DI-04 Readiness Gates | Define Offer Readiness and action readiness gates by asset strategy. | DI-02; AS-02; AS-03. | Specify gate categories, blocking vs advisory gaps, approval triggers. | Offer readiness cannot pass with critical missing facts. | Residential and land readiness scenario review. | Gate definitions ready for implementation. | Existing offer readiness behavior and property intelligence messaging. |
| DI-05 Cost-of-Delay Prioritization | Introduce cost of delay and Recommended Action Window. | DI-02; DI-03. | Define urgency, expiration, risk escalation, and queue ordering rules. | Today Workspace can sort urgent work by transparent logic. | Scenario validation for replies, deadlines, and stale follow-ups. | Prioritization model approved. | Notification priority and follow-up planner outputs. |
| DI-06 Recommendation Recalculation | Define recommendation and priority recalculation orchestration. | DI-01 through DI-05; RDI-04. | Consume material decision changes and RDI-04 freshness/revalidation signals to re-evaluate deterministic outputs, supersede prior read-model recommendations, and recalculate approved priority and timing outputs. | New facts, seller replies, approvals, conflicts, readiness changes, and RDI-04 signals can trigger deterministic recalculation without moving freshness policy into DI-06. | Event and signal matrix review, including factual-event versus command boundaries. | Recalculation trigger contract and read-model orchestration boundary approved. | Existing cache, workflow, notification, Today ordering, and AI summary assumptions. |
| DI-07 Decision Memory and Overrides | Preserve user overrides and learning signals. | DI-01; UAI approval model. | Define override reasons, outcome capture, feedback loops, and audit requirements. | Overrides are auditable and affect future recommendations only through approved learning rules. | Audit review and sample override lifecycle. | Decision memory architecture accepted. | Existing manual statuses, local notification state, and AI recommendation language. |

### Program: Asset Strategy

| Phase | Objective | Dependencies | Implementation Scope | Acceptance Criteria | Validation Requirements | Definition of Done | Regression Scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AS-01 Shared Asset Strategy Contracts | Create common strategy interface and asset classification requirements. | DI-01. | Define required facts, completeness rules, underwriting hooks, risk rules, readiness gates, offer logic, exit strategies, buyer matching, verification. | Every opportunity must have asset type before strategy analysis. | Contract review with residential and land examples. | Strategy contract documented and ADR accepted. | Existing deal analysis, property intelligence, offer, buyer matching concepts. |
| AS-02 Residential Strategy | Formalize residential acquisition strategy. | AS-01; DI-02. | Define residential required facts, ARV/repair/rent assumptions, exits, readiness, risks, buyer fit. | Residential recommendations are explainable and evidence-backed. | Scenario review for wholesale, flip, rental, subject-to. | Residential spec accepted. | Existing residential offer and property analysis assumptions. |
| AS-03 Vacant Land Strategy | Formalize land strategy and prevent house-style analysis. | AS-01; RDI-01. | Define parcel, buildability, zoning, utility, access, environmental, lien, comps, and builder-demand requirements. | Land cannot pass readiness if critical parcel/buildability facts are missing. | Land scenario review including missing legal access and wetlands. | Land separation ADR accepted and strategy documented. | Existing property intelligence, comps, and buyer matching references. |
| AS-04 Small Multifamily Strategy | Formalize small multifamily strategy. | AS-01; DI-03. | Define unit, rent roll, NOI, vacancy, expenses, repair, financing, and investor-buyer rules. | Small multifamily is distinct from residential single-family and land. | Scenario review for rent roll gaps and NOI sensitivity. | Small multifamily spec accepted. | Existing residential analysis language and buyer matching assumptions. |
| AS-05 Future Manufactured Home Strategy | Define deferred manufactured-home architecture boundary. | AS-01; future provider research. | Document title type, land-owned vs park-owned, HUD status, lot rent, transportability, financing, buyer constraints. | Manufactured homes are not analyzed under residential strategy until activated. | Deferral review and future-readiness checklist. | Deferred strategy boundary documented. | Asset classification and unsupported-asset handling. |

### Program: Product Experience and Design System

| Phase | Objective | Dependencies | Implementation Scope | Acceptance Criteria | Validation Requirements | Definition of Done | Regression Scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX-01 Design System Foundation | Establish shared tokens, components, icon rules, states, and accessibility baseline. | Product Experience and Design System ADR. | Typography, spacing, colors, status semantics, icons, tabs, cards, tables, drawers, modals, forms, empty states, skeletons. | New UI cannot use ad hoc styling outside approved patterns. | Design review, accessibility checklist, component inventory. | Foundation documented before UI rebuilds. | Existing visual consistency, responsive behavior, keyboard access. |
| UX-02 Professional Application Shell | Define shell with sidebar, top navigation, search, route states, and role-aware nav. | UX-01; role-aware interface ADR. | Route hierarchy, collapsible sidebar, global command/search, loading/error/empty states, responsive shell. | Navigation matches Today, Pipeline, Inbox, Deals or Properties, Buyers, Reports, Settings. | Navigation matrix and role visibility review. | Shell spec accepted. | Existing route entry, lazy loading, auth state, current navigation. |
| UX-03 Today and Universal Approval Inbox | Make Today Workspace and approvals the primary operating surface. | UX-01; UX-02; UAI model; DI-05. | Act Now, Approvals, Waiting, At Risk, Completed; approval cards and queues. | Users can start the day from prioritized decisions and approvals. | Queue scenario validation and approval lifecycle review. | Today/approval UX spec accepted. | Existing Action Inbox, notifications, workflow approvals, conversation reply flow. |
| UX-04 Decision Room and Contextual Workspaces | Replace panel-heavy Seller Workspace with Deal Decision Room. | UX-01 through UX-03; AS-02; AS-03. | Residential and land tabs, Decision tab, contextual actions, evidence summary, communication context. | One opportunity opens one guided workspace with strategy-specific tabs. | Residential and land task-flow review. | Decision Room spec accepted. | Existing Seller Workspace, AI dashboard, offers, property intelligence, documents, closing. |
| UX-05 Interaction, Accessibility, Responsiveness, and Performance Polish | Standardize interaction quality and performance expectations. | UX-01 through UX-04. | Reduced motion, keyboard navigation, focus states, optimistic interactions, skeletons, responsiveness, route performance budgets. | Workspaces are usable on supported screen sizes and accessible by keyboard. | Accessibility audit, responsive QA, performance budget review. | Interaction standards documented. | Existing keyboard flows, modals, drawers, async states. |
| UX-06 Legacy UI Consistency Migration and Cleanup | Plan migration from legacy panels to design-system components. | UX-01 through UX-05. | Inventory, migration order, deprecation plan, component replacements, duplicate panel removal. | Legacy UI debt is scheduled without breaking current workflows. | Diff risk review and regression plan. | Migration backlog accepted. | Existing dashboards, panels, cards, forms, tables, and empty states. |

### Program: Research and Data Intelligence

| Phase | Objective | Dependencies | Implementation Scope | Acceptance Criteria | Validation Requirements | Definition of Done | Regression Scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RDI-01 Missing-Information Detection | Identify missing decision-critical facts by asset strategy. | AS-01. | Required fact matrix, criticality, blocking/advisory gaps, seller-question generation hooks. | Missing Information Autopilot can state what is missing and why it matters. | Residential and land missing-fact scenarios. | Detection spec accepted. | Existing missing-data labels in AI, offers, property, and action inbox. |
| RDI-02 Conflicting-Data Resolution | Detect and route conflicting values. | RDI-01; Evidence and Provenance ADR. | Conflict models, source ranking, review states, approval routing. | Conflicts reduce confidence and create reviewable work. | Conflict examples for price, timeline, parcel, occupancy. | Conflict-resolution spec accepted. | Existing CRM field reads and AI extraction proposals. |
| RDI-03 Evidence and Provenance | Own source references, trust levels, timestamps, and verification state. | DI-01. | Evidence records, provenance references, freshness, source trust, lineage. | Every recommendation can cite supporting and conflicting evidence. | Provenance lifecycle review. | Evidence model documented and ADR accepted. | Existing property data, AI responses, imported records, messages. |
| RDI-04 Freshness and Revalidation | Define canonical freshness and revalidation state for decision Evidence and facts. | RDI-03; DI-03. | Fact-type freshness policies, source timestamp selection, age rules, revalidation requirements, stale-data effects on decision quality, and deterministic factual signals for DI-06. RDI-04 does not execute recommendation recalculation. | Stale or revalidation-required facts cannot silently support decision quality, and factual freshness signals are available without mutating recommendations or queues. | Staleness and signal scenarios for ARV, zoning, seller timeline, buyer demand, and missing source timestamps. | Freshness policies, revalidation states, and signal contracts accepted. | Existing explicit freshness metadata, cache TTLs, follow-up dates, recommendation summaries, DI-03 outputs. |
| RDI-05 Research Workbench | Define operator surface for verification and research status. | RDI-01 through RDI-04; UX-02. | Verification tasks, source review, conflict resolution, seller questions, external-data status. | Operators can resolve missing or conflicting facts without mutating records silently. | Research task lifecycle review. | Workbench UX and service boundaries accepted. | Existing task, property lookup, document, and notes workflows. |
| RDI-06 Seller Authority Verification | Verify whether the communicating party can transact. | RDI-03; UAI model. | Authority facts, ownership relationship, document evidence, exception routing. | High-risk actions are blocked or routed when seller authority is unverified. | Scenarios for owner, relative, tenant, agent, unknown contact. | Authority verification spec accepted. | Existing seller records, phone matching, communication assumptions. |

### Program: Productivity Automation

| Phase | Objective | Dependencies | Implementation Scope | Acceptance Criteria | Validation Requirements | Definition of Done | Regression Scope |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PA-01 Automatic CRM Update Suggestions | Propose CRM mutations from communications, notes, docs, and imports. | Human approval ADR; RDI-03. | Extraction proposals, diff view, approval routing, rejection reasons. | AI never silently mutates canonical CRM records. | Extraction review examples. | Proposal workflow spec accepted. | Existing deal update paths, imported records, AI summaries. |
| PA-02 Duplicate-Work Prevention | Reduce duplicate tasks, follow-ups, approvals, and research work. | DI-01; RDI-01; UX-03. | Duplicate detection rules, merge suggestions, task suppression, queue consolidation. | Users are not asked to do the same work in multiple places. | Duplicate scenario review. | Duplicate-work rules accepted. | Existing tasks, notifications, action inbox, follow-up planner. |
| PA-03 What Changed Summary | Summarize meaningful opportunity changes since last review. | RDI-03; DI-06. | Change detection, materiality rules, evidence links, Today and Decision Room summaries. | Users can understand why priority or recommendation changed. | Change examples for seller reply, price change, verification result. | Summary contract accepted. | Existing activity timeline, AI briefing, notification center. |
| PA-04 Automatic Pipeline Cleanup | Identify stale, duplicate, invalid, or completed pipeline items. | DI-06; PA-02. | Cleanup suggestions, approval routing, safe archival states, no destructive deletion. | Cleanup actions are reviewable and reversible where possible. | Pipeline cleanup scenarios. | Cleanup spec accepted. | Existing pipeline stages, deal records, activity history. |
| PA-05 Revisit Engine | Schedule and reprioritize future opportunities. | DI-05; RDI-04. | Revisit criteria, timing, reason tracking, seller situation triggers, expiration. | Passed or waiting deals can return when conditions change. | Revisit lifecycle scenarios. | Revisit rules accepted. | Existing follow-up planner, due dates, pipeline stages. |
| PA-06 Team-Capacity-Aware Assignment | Route work based on role, capacity, market, and urgency. | UX-03; role-aware interface ADR; SaaS tenant context. | Assignment rules, capacity signals, escalation paths, permission checks. | Work is assigned to eligible users without hiding critical exceptions. | Assignment matrix review. | Assignment architecture accepted. | Existing role, team, task, and action inbox concepts. |
| PA-07 Voice and Mobile Quick Capture | Capture field notes, seller updates, and quick tasks from mobile/voice. | PA-01; UX-05. | Capture schema, transcription review, extraction proposals, approval routing. | Quick capture creates reviewable suggestions, not silent CRM mutations. | Mobile/voice capture scenarios. | Capture architecture accepted. | Existing notes, tasks, messages, AI extraction proposals. |

## ADR Index

- [ADR-001: Version 1.0 Release Candidate Readiness](../ADR-001-VERSION-1-0-RELEASE-CANDIDATE.md)
- [ADR-016: Decision-First Product Architecture](adrs/ADR-016-DECISION-FIRST-PRODUCT-ARCHITECTURE.md)
- [ADR-017: Asset Strategy Architecture](adrs/ADR-017-ASSET-STRATEGY-ARCHITECTURE.md)
- [ADR-018: Explainable Scoring and Recommendation Architecture](adrs/ADR-018-EXPLAINABLE-SCORING-AND-RECOMMENDATION-ARCHITECTURE.md)
- [ADR-019: Evidence and Provenance Ownership](adrs/ADR-019-EVIDENCE-AND-PROVENANCE-OWNERSHIP.md)
- [ADR-020: Professional Design System Governance](adrs/ADR-020-PROFESSIONAL-DESIGN-SYSTEM-GOVERNANCE.md)
- [ADR-021: Route-Level Workspace Architecture](adrs/ADR-021-ROUTE-LEVEL-WORKSPACE-ARCHITECTURE.md)
- [ADR-022: Human Approval for AI-Proposed Mutations](adrs/ADR-022-HUMAN-APPROVAL-FOR-AI-PROPOSED-MUTATIONS.md)
- [ADR-023: Simplicity Guardrail](adrs/ADR-023-SIMPLICITY-GUARDRAIL.md)
- [ADR-024: Land Acquisition Analysis Separation](adrs/ADR-024-LAND-ACQUISITION-ANALYSIS-SEPARATION.md)
- [ADR-025: Role-Aware Interface Strategy](adrs/ADR-025-ROLE-AWARE-INTERFACE-STRATEGY.md)
- [ADR-026: Free-First and Vendor-Neutral Architecture](adrs/ADR-026-FREE-FIRST-AND-VENDOR-NEUTRAL-ARCHITECTURE.md)
- [ADR-027: Freshness, Revalidation, and Recommendation Recalculation Sequencing](adrs/ADR-027-FRESHNESS-REVALIDATION-RECALCULATION-SEQUENCING.md)

## Recommended First Compact Execution Order

### Phase 1: Decision Foundation and Guardrails

- DI-01 Decision Model Foundation
- RDI-03 Evidence and Provenance
- ADR-008 human approval boundary
- UX-01 Product Experience and Design System foundation

### Phase 2: Strategy Separation and Today Operating Model

- AS-01 Shared Asset Strategy Contracts
- AS-02 Residential Strategy
- AS-03 Vacant Land Strategy
- DI-02 Pursuit Scoring
- UX-02 Professional Application Shell
- UX-03 Today Workspace and Universal Approval Inbox

### Phase 3: Guided Decision Execution

- UX-04 Deal Decision Room
- RDI-01 Missing-Information Detection
- RDI-02 Conflicting-Data Resolution
- DI-04 Readiness Gates
- PA-01 Automatic CRM Update Suggestions
- PA-03 What Changed Summary

## Validation Checklist

- Markdown structure must retain one top-level title and stable section anchors.
- ADR numbering must not conflict with existing ADR-001.
- Roadmap dependencies must flow from contracts and evidence models before automation and UX rebuilds.
- Every roadmap phase must include objective, dependencies, implementation scope, acceptance criteria, validation requirements, definition of done, and regression scope.
- No production source files should be modified by architecture amendments.
- No database migrations, API changes, Netlify Functions, dependency updates, or tests should be modified by architecture amendments.
- Links in the ADR index must resolve before completion.
- ADR-026 must remain unique and its index link must resolve.
- Free-First terminology, provider tiers, adapter boundaries, fallback rules, and cost-governance requirements must remain consistent across architecture, roadmap governance, and ADR-026.
- Architecture amendments must verify that no production source, dependency manifest, lockfile, database, API, function, or test file changed.
