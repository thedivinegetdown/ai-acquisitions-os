# V1.1 Build 2 — research resolution and canonical refresh

Baseline: `74bb233144df38c9c6d58e36aad4d0e5a6ac60d1`.

## Ownership and persistence

Decision Room → `ResearchResolutionPanel` → `saveResearchCommand` →
`buildResearchMutation` → one tenant-scoped `deals` update. The additive migration
stores existing RDI-03 Evidence records in `research_evidence`, existing RDI-02
resolution references in `research_resolutions`, and an optimistic
`research_revision`. No parallel evidence contract or recommendation history is
introduced. The existing deal tenant policies continue to apply.

The bounded operator surface covers asking price, Residential ARV, repairs and
condition, and Vacant Land legal access, zoning and comparable land value.
Unknown numeric values are rejected rather than converted to zero. Source
identity, verification, actor, observation time and optional source time persist.
Updating verification for the same source/value preserves its source timestamp
when the operator leaves the timestamp blank.

A newly represented fact can populate an empty authoritative column. A different
value is retained as evidence alongside the prior CRM value; it cannot silently
replace that value. Explicit resolution requires a persisted candidate and reason
and atomically writes the selected value plus its resolution reference. Historical
candidates remain available to RDI-02 and the research panel; only selected
evidence supports a resolved fact. New evidence or a disagreeing outside fact edit
invalidates the prior resolution. Stale concurrent saves are rejected using the
research revision and the edited columns (plus record update time when supplied).

## Canonical assembly and DI-06

`assembleDecisionRoomInputs` links the currently loaded conversations, seller
tasks, sequences and deal next action to the selected deal. Supplied approval
context remains optional and unavailable when absent. App enables the existing
read-only communication and commitment loaders for Decision Room. Ownership and
mutation commands for these records are unchanged.

The existing canonical builder continues to own asset classification, fact
adaptation, Missing Information, conflicts, Evidence, RDI-04 freshness, strategy,
underwriting, readiness and recommendation precedence. DI-06 runs immediately
before its existing recommendation selector. It compares deterministic serialized
projections of classification, facts, evidence, conflicts, missing information,
freshness, communication, commitments, approvals and strategy/readiness inputs.

The in-memory contract has `unchanged`, `recalculated` and `unavailable` states,
category fingerprints, changed categories, an explanation and the current
selection. Unchanged inputs reuse the selector result. Material changes invoke
the same selector. Canonical fact/freshness/readiness evaluation still runs before
comparison; this is not a cache of source truth. Clock ticks and record-only
metadata do not independently trigger selection. RDI-04 alone selects eligible
timestamps and determines freshness transitions using the supplied evaluation
time. No scheduling, persistence of recommendations, or business commands occur.

The active legacy AI Insights recommendation is unmounted. Numbers uses the
Decision Room's canonical Residential result instead of the separate analyzer
preview; unavailable canonical analysis cannot fall back to a competing preview.
Dormant legacy components remain intact.

## Validation and limits

Focused validation: 193 tests across nine affected files passed, including the
new repository round-trip / DI-06 tests, one UI save → conflict → resolve → refresh
→ remount proof, existing canonical integration, RDI-02/03/04, Residential, and
Vacant Land strategy tests. Changed-source ESLint passed. Persistence tests use a
serialized repository test double and verify the scoped write payload, reload,
concurrent-save rejection, and absence of task/stage/message mutations.

The migration is authored but not applied. No database/RLS validation, full test
suite, broad build, browser E2E, provider/AI calls, push or deployment was run.
Research is intentionally limited to seven scalar fields and at most 48 stored
evidence records per deal / nine per edited field; overflow fails without dropping
records. Approval information is consumed only when supplied. No background
refresh or DI-07 recommendation history is included.
