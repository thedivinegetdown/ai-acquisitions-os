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
  const safeDeal = deal || {};

  return (
    getDealAliasText(safeDeal, "address") ||
    safeTrim(safeDeal.property_address) ||
    safeTrim(safeDeal.propertyAddress) ||
    safeTrim(safeDeal.address) ||
    ""
  );
}

export function buildPropertyDataInput({ address = "", deal = {}, manualData = {} } = {}) {
  const safeDeal = deal || {};

  return {
    address: normalizeAddress(address || getPropertyAddressFromDeal(safeDeal)),
    deal: safeDeal,
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
  const safeDeal = deal || {};
  const normalizedAddress = normalizeAddress(address || getPropertyAddressFromDeal(safeDeal));
  const propertyType =
    getDealAliasText(safeDeal, "propertyType") || safeTrim(safeDeal.property_type);
  const propertyId = safeDeal.property_id ?? safeDeal.id ?? "";
  const dealArv = getDealAliasPositiveNumber(safeDeal, "arv");
  const dealRent = getDealAliasPositiveNumber(safeDeal, "rent");
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
      city: safeTrim(safeDeal.city),
      state: safeTrim(safeDeal.state),
      zip: safeTrim(safeDeal.zip ?? safeDeal.postal_code),
      propertyType: propertyType || "Unknown",
      beds: parseSafeNumber(safeDeal.beds ?? safeDeal.bedrooms),
      baths: parseSafeNumber(safeDeal.baths ?? safeDeal.bathrooms),
      squareFeet: parseSafeNumber(safeDeal.square_feet ?? safeDeal.squareFeet),
      yearBuilt: parseSafeNumber(safeDeal.year_built ?? safeDeal.yearBuilt),
      lotSize: parseSafeNumber(safeDeal.lot_size ?? safeDeal.lotSize),
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
