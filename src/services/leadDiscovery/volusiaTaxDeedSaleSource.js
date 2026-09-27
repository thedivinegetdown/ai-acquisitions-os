import { callNetlifyFunction } from "../api/netlifyClient";

export const VOLUSIA_TAX_DEED_SALE_SOURCE = "volusia-tax-deed-sale";
export const VOLUSIA_TAX_DEED_SALE_DATE_LIMIT = 1;

export function fetchVolusiaTaxDeedSaleCandidates() {
  return callNetlifyFunction("volusia-tax-deed-sale", {
    body: { saleDateLimit: VOLUSIA_TAX_DEED_SALE_DATE_LIMIT },
    retries: 0,
  });
}
