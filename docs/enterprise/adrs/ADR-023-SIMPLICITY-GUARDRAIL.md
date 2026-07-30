# ADR-023: Simplicity Guardrail

## Status

Accepted.

## Context

AI Acquisitions OS must avoid becoming a collection of low-value tools. The product should save time, improve decision accuracy, and reduce navigation.

## Decision

The **Simplicity Guardrail** applies permanently.

Every proposed feature must answer:

1. Does it save meaningful time?
2. Does it improve decision accuracy?
3. Can it operate in the background or inside an existing workflow?

Features that fail this test must be removed, combined, hidden, or rejected.

## Consequences

Positive:

- Roadmap scope remains aligned to decision-first outcomes.
- Product reviews have a clear rejection criterion.
- Interface complexity can decrease over time.

Negative:

- Some useful-but-secondary ideas may be deferred or hidden.
- Teams must justify new surfaces more rigorously.

## Alternatives Considered

Accept all plausible acquisition workflow features:

- Rejected because breadth without simplicity would undermine the approved product direction.
