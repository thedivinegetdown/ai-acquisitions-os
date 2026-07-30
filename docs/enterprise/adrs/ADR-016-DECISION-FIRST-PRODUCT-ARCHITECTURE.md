# ADR-016: Decision-First Product Architecture

## Status

Accepted.

## Context

AI Acquisitions OS currently exposes many useful acquisition tools, but the product direction requires a more coherent operating model. Users should primarily review prioritized opportunities, approve important actions, communicate with sellers, make acquisition decisions, and handle exceptions.

## Decision

AI Acquisitions OS will use the **Decision-First Product Model** as its governing product architecture.

The core flow is:

```text
Identify -> Verify -> Decide -> Act -> Learn
```

Existing tools become background capabilities or contextual surfaces inside the Today Workspace, Universal Approval Inbox, and Deal Decision Room.

## Consequences

Positive:

- Product work is evaluated by decision value rather than feature count.
- Navigation can be simplified around daily operating work.
- AI, workflow, offer, communication, property, buyer, and closing capabilities can converge into one guided assistant experience.

Negative:

- Legacy dashboards and panels require migration planning.
- Some existing UI concepts may be deprecated, hidden, or combined.
- Implementation must preserve current workflows while introducing route-level replacements.

## Alternatives Considered

Keep tool-first CRM navigation:

- Rejected because it reinforces disconnected dashboards and increases operator burden.

Add more automation without changing product model:

- Rejected because automation without a decision framework creates unclear approvals and low trust.
