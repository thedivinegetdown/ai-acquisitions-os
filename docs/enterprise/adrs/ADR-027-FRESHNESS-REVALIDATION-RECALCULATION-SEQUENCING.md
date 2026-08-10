# ADR-027: Freshness, Revalidation, and Recommendation Recalculation Sequencing

## Status

Accepted.

## Context

The Decision-First roadmap defined a circular dependency: RDI-04 Freshness and Revalidation depended on DI-06 Recommendation Recalculation, while DI-06 depended on RDI-04. The chain `RDI-04 -> DI-06 -> RDI-04` provided no valid implementation order.

Freshness policy and recommendation recalculation are related but distinct responsibilities. Freshness determines the time-based state of Evidence and facts. Recalculation consumes material changes to the decision basis and re-evaluates deterministic decision outputs. The architecture needs a one-way dependency that preserves those ownership boundaries and does not authorize side effects.

## Decision

The approved dependency direction is:

```text
RDI-03 Evidence and Provenance
  -> DI-03 Data Reliability and Recommendation Confidence
  -> RDI-04 Freshness and Revalidation
  -> DI-06 Recommendation Recalculation
```

DI-05 Cost of Delay and Recommended Action Window remains independently completed before DI-06.

RDI-04 depends on RDI-03 and DI-03. RDI-04 does not depend on DI-06.

DI-06 depends on DI-01 through DI-05 and RDI-04. This creates a one-way dependency from Evidence, through decision quality and freshness, into recalculation orchestration.

### RDI-04 Ownership

RDI-04 owns freshness policy and revalidation state. It may define:

- fact-type freshness policies and policy versions;
- source timestamp selection and age calculations;
- explicit `current`, `stale`, `expired`, and `revalidation-required` states;
- revalidation-due timestamps and Evidence expiration semantics;
- recommendation-support expiration signals;
- deterministic revalidation trigger descriptors and reason codes;
- stale Evidence propagation into Data Reliability and Recommendation Confidence;
- stale-fact visibility in Missing Information and the Deal Decision Room.

RDI-04 may emit factual signals such as `fact-became-stale`, `evidence-expired`, `revalidation-required`, and `critical-fact-revalidation-required`.

RDI-04 does not own recommendation recomputation orchestration, automatic priority recalculation, Today queue mutation, background scheduling, CRM mutation, task creation, seller messaging, offer behavior, or approval execution.

### DI-06 Ownership

DI-06 owns recommendation and priority recalculation orchestration. It consumes material decision signals including:

- a new or changed decision-critical fact;
- a new or resolved conflict;
- a seller reply;
- an approval state change;
- an Offer Readiness change;
- a Pursuit Score input change;
- RDI-04 stale-fact, revalidation-required, or Evidence-expiration signals.

DI-06 may re-evaluate deterministic decision outputs, supersede prior recommendation read-model results, recalculate priority, Cost of Delay, and Recommended Action Window, and update Today read-model ordering when an approved DI-06 Execution Order permits it. DI-06 may mark an earlier recommendation as superseded or expired in the read model. DI-06 does not own the underlying freshness policy.

### Event and Signal Semantics

Events describe completed facts, not commands disguised as events.

- RDI-04 emits `fact-became-stale`, not `recalculate-recommendation-now`.
- RDI-04 emits `revalidation-required`, not `create-task`.
- DI-06 determines whether an allowed deterministic recalculation is required.
- A later workflow or automation phase owns external or persistent side effects.

### Read Model and Persistence Boundary

RDI-04 and DI-06 may initially operate as deterministic read-model services using currently loaded records. This decision does not authorize database tables, migrations, persisted events, queues, cron jobs, background jobs, server functions, or other scheduling infrastructure. A later approved Execution Order must authorize persistence when it is demonstrably required.

### Existing Freshness Metadata

Explicitly supplied `freshnessState`, `stale`, and `current` metadata remains valid Evidence input. RDI-04 adds canonical time-based policy only when sufficient real source timestamps and fact policies exist.

RDI-04 must not fabricate source timestamps, infer source time from evaluation time, silently treat missing source timestamps as fresh, or use record update time as field source time unless an explicit record-level compatibility policy allows it.

### Downstream Ownership Boundaries

DI-03 remains the owner of Data Reliability and Recommendation Confidence. RDI-04 supplies canonical `current`, `stale`, `revalidation-required`, or `unknown` freshness results; it does not calculate either DI-03 output.

DI-05 remains the owner of Cost of Delay and Recommended Action Window. RDI-04 may supply stale or revalidation context but does not calculate timing. DI-06 may later re-run DI-05 when RDI-04 signals materially change the decision basis.

RDI-04 must not directly reorder Today. DI-06 may integrate approved automatic recalculation into Today after consuming RDI-04 signals. The direction is `Freshness policy -> Decision recalculation -> Queue reprioritization`.

RDI-05 Research Workbench remains downstream of RDI-01 through RDI-04. RDI-04 may provide stale-fact descriptors, revalidation requirements, and suggested research targets. RDI-05 owns the future operator research surface.

### Approved Implementation Sequence

The next approved order is:

1. RDI-04 - Freshness and Revalidation
2. DI-06 - Recommendation Recalculation
3. DI-07 - Decision Memory and Overrides

This ADR establishes sequencing and ownership only. It does not authorize implementation of those phases.

### Free-First Boundary

This decision requires no new service, provider, paid or production dependency, external data transfer, database change, API, Netlify Function, operating cost, or vendor lock-in. It remains consistent with ADR-026.

## Consequences

Positive:

- RDI-04 and DI-06 now have a valid, one-way implementation sequence.
- Freshness rules remain independently testable and do not mutate recommendation or queue state.
- Recommendation recalculation can consume canonical freshness signals without owning timestamp policy.
- Read-model-first implementation preserves the Free-First and Simplicity Guardrails.

Negative:

- Automatic reprioritization remains unavailable until DI-06 is separately approved and implemented.
- Persistent scheduling and side effects require later architecture and Execution Order approval.
- Consumers must preserve the distinction between freshness facts and recalculation commands.

## Alternatives Considered

Implement DI-06 before RDI-04:

- Rejected because DI-06 would lack canonical freshness and revalidation signals and would need to invent policy it does not own.

Keep RDI-04 dependent on DI-06:

- Rejected because it preserves the circular dependency and prevents a valid implementation sequence.

Let RDI-04 directly recalculate recommendations and reorder Today:

- Rejected because it combines policy, orchestration, and queue ownership and violates the Decision-First event and simplicity boundaries.

Add persistent events, schedulers, or background jobs now:

- Rejected because the sequencing decision can be implemented as deterministic read-model governance without new infrastructure or operating cost.
