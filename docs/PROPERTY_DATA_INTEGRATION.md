# Property Data Integration

## Goal

Prepare AI Acquisitions OS for property records, ownership, tax, valuation, comps, and ARV integrations without requiring a paid provider yet.

## Current Foundation

Epic 22 adds a provider-based property data layer:

- `propertyDataGateway`: stable entry point for property data lookup.
- `manualPropertyDataProvider`: returns normalized manual/deal-derived data.
- `mockPropertyDataProvider`: returns deterministic demo property, owner, tax, valuation, and comps data.
- `propertyDataNormalizer`: normalizes address, owner, tax, valuation, and comparable sale records.
- `propertyDataCache`: in-memory lookup cache for repeated provider calls.

The UI uses the gateway through the existing Comps + Property Intelligence panel. Manual property intelligence remains available and is not replaced.

## Provider Architecture

The intended provider model is:

1. Manual provider
2. Mock provider
3. Future API provider

Future API providers should be added behind the gateway so UI components do not change when a vendor is introduced.

## Current UI Behavior

The Property Intelligence panel includes:

- Address search input
- Provider selector
- Normalized address output
- Owner placeholder
- Tax placeholder
- Valuation placeholder
- Comps placeholder
- Data confidence
- Missing data

The panel is clearly labeled:

`Property data integration foundation - live provider not connected yet.`

Provider valuation data can be applied to the existing manual ARV and rent fields for internal review. This is a user-triggered action and does not persist to the database.

## Data Contracts

Shared contracts live in `src/types/propertyData.ts`:

- `PropertyRecord`
- `OwnerRecord`
- `TaxRecord`
- `ValuationRecord`
- `ComparableSale`
- `PropertyDataProvider`
- `PropertyDataResult`
- `PropertyDataConfidence`

## Security Requirements

- Do not call paid property providers directly from browser code.
- Future provider API keys must remain server-side in Netlify Functions or backend services.
- Do not expose raw provider responses to end users until normalized and filtered.
- Cache only non-sensitive normalized data unless persistence rules are approved.

## Future Provider Integration Plan

When a provider is selected:

1. Add a server-side Netlify Function for that provider.
2. Validate request input server-side.
3. Keep provider API keys in Netlify environment variables.
4. Normalize responses into `PropertyDataResult`.
5. Keep manual and mock providers as fallbacks.
6. Add tests for missing provider keys, malformed responses, and empty results.

## Known Limitations

- No live MLS, tax, ownership, or valuation provider is connected yet.
- Mock provider output is deterministic and should not be used for real valuation decisions.
- Lookup results are not persisted.
- Data is not automatically applied to offer calculations.
- Manual comps/property intelligence remains the source of operational review for now.
