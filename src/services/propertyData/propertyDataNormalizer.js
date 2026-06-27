import { getDealAliasPositiveNumber, getDealAliasText } from "../../utils/dealFields";
import { parseSafeNumber } from "../../utils/numbers";
import { safeTrim, uniqueStrings } from "../../utils/text";

export function normalizeAddress(value = "") {
  return safeTrim(value)
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ");
}

export function getPropertyAddressFromDeal(deal = {}) {
  return (
    getDealAliasText(deal, "address") ||
    safeTrim(deal.property_address) ||
    safeTrim(deal.propertyAddress) ||
    safeTrim(deal.address) ||
    ""
  );
}

export function buildPropertyDataInput({ address = "", deal = {}, manualData = {} } = {}) {
  return {
    address: normalizeAddress(address || getPropertyAddressFromDeal(deal)),
    deal: deal || {},
    manualData: manualData || {},
  };
}

export function normalizeComparableSale(comp = {}) {
  return {
    address: normalizeAddress(comp.address),
    soldPrice: parseSafeNumber(comp.soldPrice ?? comp.sold_price),
    soldDate: safeTrim(comp.soldDate ?? comp.sold_date),
    beds: parseSafeNumber(comp.beds),
    baths: parseSafeNumber(comp.baths),
    squareFeet: parseSafeNumber(comp.squareFeet ?? comp.square_feet),
    distanceMiles: parseSafeNumber(comp.distanceMiles ?? comp.distance_miles),
    similarityScore: parseSafeNumber(comp.similarityScore ?? comp.similarity_score),
    source: safeTrim(comp.source) || "manual",
  };
}

export function normalizePropertyDataResult({
  address = "",
  deal = {},
  owner = null,
  tax = null,
  valuation = null,
  comps = [],
  confidence = "Low",
  source = "manual",
  missingData = [],
} = {}) {
  const normalizedAddress = normalizeAddress(address || getPropertyAddressFromDeal(deal));
  const propertyType = getDealAliasText(deal, "propertyType") || safeTrim(deal.property_type);
  const propertyId = deal.property_id ?? deal.id ?? "";
  const dealArv = getDealAliasPositiveNumber(deal, "arv");
  const dealRent = getDealAliasPositiveNumber(deal, "rent");
  const normalizedValuation = valuation
    ? {
        estimatedValue: parseSafeNumber(
          valuation.estimatedValue ?? valuation.estimated_value
        ),
        lowValue: parseSafeNumber(valuation.lowValue ?? valuation.low_value),
        highValue: parseSafeNumber(valuation.highValue ?? valuation.high_value),
        arvEstimate: parseSafeNumber(
          valuation.arvEstimate ?? valuation.arv_estimate ?? dealArv
        ),
        rentEstimate: parseSafeNumber(
          valuation.rentEstimate ?? valuation.rent_estimate ?? dealRent
        ),
        confidence: valuation.confidence || confidence,
        source: safeTrim(valuation.source) || source,
      }
    : null;
  const normalizedMissingData = [
    !normalizedAddress ? "Property address" : null,
    !owner ? "Owner data" : null,
    !tax ? "Tax data" : null,
    !normalizedValuation ? "Valuation data" : null,
    !Array.isArray(comps) || comps.length === 0 ? "Comparable sales" : null,
    ...missingData,
  ].filter(Boolean);

  return {
    property: {
      id: safeTrim(String(propertyId)),
      address: normalizedAddress,
      normalizedAddress,
      city: safeTrim(deal.city),
      state: safeTrim(deal.state),
      zip: safeTrim(deal.zip ?? deal.postal_code),
      propertyType: propertyType || "Unknown",
      beds: parseSafeNumber(deal.beds ?? deal.bedrooms),
      baths: parseSafeNumber(deal.baths ?? deal.bathrooms),
      squareFeet: parseSafeNumber(deal.square_feet ?? deal.squareFeet),
      yearBuilt: parseSafeNumber(deal.year_built ?? deal.yearBuilt),
      lotSize: parseSafeNumber(deal.lot_size ?? deal.lotSize),
      source,
    },
    owner,
    tax,
    valuation: normalizedValuation,
    comps: Array.isArray(comps) ? comps.map(normalizeComparableSale) : [],
    confidence,
    missingData: uniqueStrings(normalizedMissingData),
    source,
    generatedAt: new Date().toISOString(),
  };
}
