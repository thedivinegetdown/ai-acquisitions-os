import { callNetlifyFunction } from "../api/netlifyClient";

export const ORANGE_COUNTY_CODE_ENFORCEMENT_LIEN_SOURCE =
  "orange-county-code-enforcement-lien";
export const CODE_ENFORCEMENT_LIEN_BROWSER_PAGE_SIZE = 100;

export function fetchOrangeCountyCodeEnforcementLienCandidates({ cursor = 0 } = {}) {
  return callNetlifyFunction("orange-county-code-enforcement-lien", {
    body: { cursor, pageSize: CODE_ENFORCEMENT_LIEN_BROWSER_PAGE_SIZE },
    retries: 0,
  });
}
