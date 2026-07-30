# ADR-021: Route-Level Workspace Architecture

## Status

Accepted.

## Context

The current application exposes many panels inside broad screens. The approved product direction requires primary workspaces that are direct, navigable, permission-aware, and decision-focused.

## Decision

Primary product areas will be modeled as route-level workspaces:

- Today Workspace
- Pipeline
- Inbox
- Deal Decision Room
- Buyers
- Reports
- Settings
- Research Workbench where permissioned

Workspaces must support direct links, browser navigation, loading states, empty states, error states, role-aware visibility, and contextual actions.

## Consequences

Positive:

- Users can navigate directly to important work.
- The Deal Decision Room can replace unrelated mounted panels.
- Route ownership clarifies data loading and error boundaries.

Negative:

- Existing component composition will need migration.
- Route-level permissions and loading states must be designed consistently.

## Alternatives Considered

Keep all workspaces as mounted dashboard sections:

- Rejected because it increases cognitive load and weakens direct navigation.
