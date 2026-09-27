import { callNetlifyFunction } from "../api/netlifyClient";

export const ORANGE_COUNTY_WATER_CASE_SOURCE = "orange-county-water-case";
export const WATER_CASE_BROWSER_PAGE_SIZE = 100;

export function fetchOrangeCountyWaterCaseCandidates({ cursor = 0 } = {}) {
  return callNetlifyFunction("orange-county-water-case", {
    body: { cursor, pageSize: WATER_CASE_BROWSER_PAGE_SIZE },
    retries: 0,
  });
}
