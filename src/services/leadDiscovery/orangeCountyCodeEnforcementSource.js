import { callNetlifyFunction } from "../api/netlifyClient";

export const ORANGE_COUNTY_CODE_ENFORCEMENT_SOURCE = "orange-county-code-enforcement";
export const CODE_ENFORCEMENT_BROWSER_PAGE_SIZE = 100;

export function fetchOrangeCountyCodeEnforcementCandidates({ cursor = 0 } = {}) {
  return callNetlifyFunction("orange-county-code-enforcement", {
    body: { cursor, pageSize: CODE_ENFORCEMENT_BROWSER_PAGE_SIZE },
    retries: 0,
  });
}
