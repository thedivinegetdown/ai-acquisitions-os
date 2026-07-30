# ADR-022: Human Approval for AI-Proposed Mutations

## Status

Accepted.

## Context

AI can extract seller facts and suggest updates from calls, messages, notes, documents, and imported records. Incorrect automatic updates could corrupt canonical CRM records and trigger bad decisions.

## Decision

AI must not silently mutate canonical CRM records.

AI-proposed changes must become reviewable suggestions routed through the Universal Approval Inbox when they affect canonical fields, stage changes, tasks, offers, communications, buyer campaigns, workflow actions, recommendation overrides, or high-risk decisions.

Approvals must show the proposed change, current value, evidence, confidence, conflicts, approver, decision, timestamp, and workflow continuation state.

## Consequences

Positive:

- Canonical CRM records remain trusted.
- Operators can approve, reject, or correct AI suggestions.
- Workflow automation can resume safely after approval.

Negative:

- Some automation requires explicit human checkpoints.
- Approval UI and audit persistence become required infrastructure.

## Alternatives Considered

Allow AI to update CRM fields automatically:

- Rejected because acquisition records are operationally sensitive and must remain human-reviewed.
