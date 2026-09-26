import { callNetlifyFunction } from "../api/netlifyClient";

export const ORANGE_COUNTY_TAX_SALE_SOURCE = "orange-county-tax-sale";
export const TAX_SALE_BROWSER_PAGE_SIZE = 100;

export function fetchOrangeCountyTaxSaleCandidates({ cursor = 0 } = {}) {
  return callNetlifyFunction("orange-county-tax-sale", {
    body: { cursor, pageSize: TAX_SALE_BROWSER_PAGE_SIZE },
    retries: 0,
  });
}
