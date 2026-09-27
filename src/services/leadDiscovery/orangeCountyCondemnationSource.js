import { callNetlifyFunction } from "../api/netlifyClient";

export const ORANGE_COUNTY_CONDEMNATION_SOURCE = "orange-county-condemnation";
export const CONDEMNATION_BROWSER_PAGE_SIZE = 100;

export function fetchOrangeCountyCondemnationCandidates({ cursor = 0 } = {}) {
  return callNetlifyFunction("orange-county-condemnation", {
    body: { cursor, pageSize: CONDEMNATION_BROWSER_PAGE_SIZE },
    retries: 0,
  });
}
