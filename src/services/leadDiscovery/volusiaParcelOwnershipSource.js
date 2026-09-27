import { callNetlifyFunction } from "../api/netlifyClient";

export const VOLUSIA_PARCEL_OWNERSHIP_SOURCE = "volusia-parcel-ownership";

export function fetchVolusiaParcelOwnership(verifiedParcelId) {
  return callNetlifyFunction("volusia-parcel-ownership", {
    body: { verifiedParcelId },
    retries: 0,
  });
}
