# ADR-020: Professional Design System Governance

## Status

Accepted.

## Context

The current UI contains many independently styled panels. The approved product direction requires a calm, focused, consistent, immediate, and professional interface.

## Decision

AI Acquisitions OS will establish the **Product Experience and Design System** as a formal program.

Every interface element must belong to the shared design system, reinforce clear hierarchy, and help the user complete a decision or action with minimal navigation.

The system must govern shell layout, navigation, tabs, icon library, typography, spacing, color/status semantics, reusable components, responsive behavior, accessibility, skeletons, optimistic interactions, reduced motion, keyboard navigation, drawers, modals, tables, cards, badges, inputs, and empty states.

## Consequences

Positive:

- Future UI work has consistent constraints.
- Legacy panel migration can be planned instead of improvised.
- Product experience quality becomes an architecture concern, not only styling.

Negative:

- Feature work must wait for or conform to shared UI primitives.
- Some existing ad hoc UI will need cleanup.

## Alternatives Considered

Continue styling each panel independently:

- Rejected because it prevents a coherent assistant-like product experience.
