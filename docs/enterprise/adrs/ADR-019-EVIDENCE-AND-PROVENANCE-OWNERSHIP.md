# ADR-019: Evidence and Provenance Ownership

## Status

Accepted.

## Context

Decision quality depends on knowing where facts came from, when they were obtained, whether they conflict, and whether they were verified.

## Decision

AI Acquisitions OS will treat **Evidence and Provenance** as a first-class architecture concern.

Evidence records must be able to reference source type, source identifier, source timestamp, extraction method, trust level, verification state, conflict state, freshness, and related canonical fields.

Canonical CRM records must not erase the evidence trail that supported or challenged their values.

## Consequences

Positive:

- Recommendations can cite facts and conflicts.
- Data Reliability can be computed defensibly.
- Human approvals can show what evidence was available at approval time.

Negative:

- Future persistence design must include provenance structures.
- Imports, AI extraction, messages, documents, and provider data must normalize source metadata.

## Alternatives Considered

Store only current canonical field values:

- Rejected because it prevents reliable audit, conflict resolution, and recommendation explanation.
