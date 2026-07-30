# ADR-017: Asset Strategy Architecture

## Status

Accepted.

## Context

Residential houses, vacant land, small multifamily, manufactured homes, and commercial assets require different facts, risks, underwriting models, readiness gates, offer logic, buyer matching, and verification rules.

## Decision

AI Acquisitions OS will implement an **Asset Strategy Layer**:

```text
Common Acquisition Core
│
├── Residential Acquisition Strategy
├── Vacant Land Acquisition Strategy
├── Small Multifamily Strategy
├── Manufactured Home Strategy
└── Commercial Strategy, deferred
```

Every opportunity must be asset-classified before strategy-specific analysis. Strategy contracts must define required facts, data-completeness rules, underwriting model, risk rules, pursuit scoring, readiness gates, offer logic, exit strategies, buyer matching rules, and verification requirements.

## Consequences

Positive:

- Analysis can be accurate for the asset type.
- Future asset classes can be added without contaminating residential logic.
- Readiness and recommendation quality become easier to explain.

Negative:

- Asset classification becomes a required upstream dependency.
- Shared services must avoid hard-coded residential assumptions.

## Alternatives Considered

Use one generic real-estate analysis model:

- Rejected because it risks analyzing land, multifamily, and manufactured homes as if they were single-family houses.
