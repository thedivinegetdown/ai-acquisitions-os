# ADR-025: Role-Aware Interface Strategy

## Status

Accepted.

## Context

AI Acquisitions OS is evolving toward team and tenant-aware operation. Users in acquisition, disposition, operations, administration, and read-only roles need different visible work while preserving backend security.

## Decision

The interface will use role-aware visibility for primary navigation, Today Workspace queues, Universal Approval Inbox items, Deal Decision Room actions, Reports, Settings, and Research Workbench access.

Role-aware visibility is not a security boundary by itself. Tenant-aware and role-aware enforcement must also exist in backend, repository, workflow, approval, and audit layers.

## Consequences

Positive:

- Users see work relevant to their responsibilities.
- Today and approval queues can be scoped by role and assignment.
- Administrative controls can be separated from operator workflows.

Negative:

- Permission modeling must be consistent across UI and service boundaries.
- Future implementation must avoid hiding unauthorized actions only in the client.

## Alternatives Considered

Use one shared interface for all roles:

- Rejected because it increases noise and creates operational risk.
