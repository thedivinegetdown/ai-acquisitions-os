# Property Data Integration

## Goal

Provide manual property research plus an optional, owner-requested RentCast evidence path without requiring a paid provider for core operation.

## Current Foundation

The provider-based property data layer includes:

- `propertyDataGateway`: stable entry point for property data lookup.
- `manualPropertyDataProvider`: returns normalized manual/deal-derived data.
- `mockPropertyDataProvider`: returns deterministic demo property, owner, tax, valuation, and comps data.
- `propertyDataNormalizer`: normalizes address, owner, tax, valuation, and comparable sale records.
- `propertyDataCache`: in-memory lookup cache for manual/mock calls only.
- `rentCastPropertyDataProvider`: browser-safe adapter to the authenticated server function.
- `property-data-rentcast`: tenant/policy enforcement, durable normalized cache, and server-only RentCast calls.

The UI uses the gateway through the existing Comps + Property Intelligence panel. Manual property intelligence remains available and is not replaced.

## Provider Architecture

The intended provider model is:

1. Manual provider
2. Mock provider
3. RentCast provider (optional and disabled by default)

No second live provider is included.

## RentCast V1

A stale explicit refresh atomically reserves two organization requests, then calls
the official `GET /v1/properties` and `GET /v1/avm/value` endpoints. The AVM call
is bounded to five comparable listing observations. The normalized result retains
bounded property characteristics, parcel identifiers, tax/assessment context,
sale history, the provider AVM range, and comparable context. It does not retain
the raw response or owner data.

The current official API license permits internal storage and display of API data.
The integration was checked against the official API terms and documentation on
2026-09-24:

- https://www.rentcast.io/terms-api
- https://developers.rentcast.io/reference/property-records
- https://developers.rentcast.io/reference/value-estimate
- https://developers.rentcast.io/reference/security

`RENTCAST_API_KEY` is read only in the server function. The server sends it only
as RentCast's `X-Api-Key` header and uses `suppressLogging=true` on both queries.
The browser, exports, diagnostics, and persisted evidence never receive the key.

Fresh normalized evidence is cached for 24 hours by organization, deal, provider,
and normalized property identity. This TTL controls provider-call reuse only;
RDI-04 remains the canonical fact freshness policy after an owner accepts evidence.

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

The Decision Room research experience shows RentCast availability, retrieval/cache
time, normalized findings, limitations, and differences from stored facts.

Refreshing persists evidence only. It does not update deal facts. The owner may
record a bounded provider-backed fact through the existing research command; a
disagreement remains open until the existing conflict-resolution action selects a
source and explains the decision. Only that canonical change enters DI-06.

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

## Enabling an organization

RentCast is absent/disabled by default. Assisted administration may enable it only
with an explicit positive monthly request cap:

`npm run pilot:admin -- configure-provider --organization-id UUID --provider rentcast --enabled true --monthly-request-cap 100`

## Known Limitations

- RentCast coverage and individual fields vary by geography; public records may lag.
- The AVM is presented as provider evidence and is never automatically treated as ARV.
- Comparable prices are listing observations from the AVM response, not guaranteed closed-sale prices.
- Mock provider output is deterministic and should not be used for real valuation decisions.
- Manual comps, research, and underwriting remain fully usable when RentCast is unavailable.
