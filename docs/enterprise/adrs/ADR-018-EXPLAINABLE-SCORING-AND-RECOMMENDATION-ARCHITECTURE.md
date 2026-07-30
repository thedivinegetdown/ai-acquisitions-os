# ADR-018: Explainable Scoring and Recommendation Architecture

## Status

Accepted.

## Context

Acquisition recommendations affect time allocation, seller communication, offer preparation, buyer outreach, and risk management. Operators need to understand why the system recommends an action.

## Decision

Decision Intelligence must separate and explain:

- Pursuit Score
- Recommendation
- Recommendation Confidence
- Data Completeness
- Data Reliability
- Financial Resilience
- Deal Effort Score
- Risk Level
- Offer Readiness
- Cost of Delay
- Recommended Action Window
- Deal Expiration and Revalidation
- Automatic Priority Recalculation

Each output must retain Evidence and Provenance, model or ruleset version, source recency, and explanation text.

## Consequences

Positive:

- Recommendations become auditable and reviewable.
- Operators can trust, override, or challenge recommendations with context.
- Future AI and rule-based engines can share output contracts.

Negative:

- Scoring implementation must avoid opaque aggregate numbers.
- More metadata is required than the current CRM-style fields provide.

## Alternatives Considered

Use a single lead score:

- Rejected because a single score cannot represent readiness, reliability, urgency, risk, and recommendation confidence.
