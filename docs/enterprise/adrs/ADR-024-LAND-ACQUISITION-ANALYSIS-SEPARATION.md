# ADR-024: Land Acquisition Analysis Separation

## Status

Accepted.

## Context

Vacant land requires parcel, access, zoning, utility, environmental, entitlement, and builder-demand analysis. Residential house analysis based on ARV, repairs, occupancy, and rent can produce incorrect or misleading land recommendations.

## Decision

Vacant residential land must use a separate strategy under the Asset Strategy Layer.

The system must identify asset type before analysis and must never analyze land as though it were a house.

Land verification must include parcel identity, legal access, road frontage, zoning, permitted use, utilities, water/sewer/septic feasibility, flood zones, wetlands, topography, deed restrictions, subdivision potential, taxes and liens, comparable land sales, and builder demand.

## Consequences

Positive:

- Land opportunities receive appropriate readiness gates and risk analysis.
- Critical land facts can block low-confidence recommendations.
- Residential and land underwriting can evolve independently.

Negative:

- Asset classification and land-specific facts become required before land recommendations.
- Generic property UI must be split or adapted by strategy.

## Alternatives Considered

Use residential property intelligence for land until land support matures:

- Rejected because it creates unacceptable recommendation risk.
